import { NextRequest, NextResponse } from "next/server";
import { runAllHealthChecks } from "@/lib/health-check";
import { checkHealthCheckRateLimit, withCORS, sanitizeError } from "@/lib/security-middleware";

/**
 * POST /api/cron/health
 *
 * Vercel Cron endpoint — probes GET /api/health on all deployed agents.
 * Runs every 6 hours (configured in vercel.json).
 * Secret-protected so only Vercel Cron can call it.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting for cron jobs
    const rateLimitResponse = checkHealthCheckRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Apply CORS
    const corsResponse = withCORS(request);
    if (corsResponse) return corsResponse;

    // Protect: only Vercel Cron can call this endpoint
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: "Unauthorized" },
          { status: 401 },
        );
      }
    }

    const results = await runAllHealthChecks();

    return NextResponse.json({
      checked: results.length,
      healthy: results.filter((r) => r.healthy).length,
      unhealthy: results.filter((r) => !r.healthy).length,
      agents: results.map((r) => ({
        agent: `${r.agentName} (${r.agentSlug})`,
        healthy: r.healthy,
        responseTimeMs: r.responseTimeMs,
        error: r.error,
      })),
    });
  } catch (error) {
    console.error("POST /api/cron/health error:", error);
    return NextResponse.json(
      { error: sanitizeError(error).message },
      { status: 500 }
    );
  }
}