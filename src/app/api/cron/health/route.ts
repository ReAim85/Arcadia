import { NextRequest, NextResponse } from "next/server";
import { runAllHealthChecks } from "@/lib/health-check";

/**
 * POST /api/cron/health
 *
 * Vercel Cron endpoint — probes GET /api/health on all deployed agents.
 * Runs every 6 hours (configured in vercel.json).
 * Secret-protected so only Vercel Cron can call it.
 */
export async function POST(request: NextRequest) {
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
}
