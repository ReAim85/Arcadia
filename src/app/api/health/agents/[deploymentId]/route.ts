import { NextRequest, NextResponse } from "next/server";
import { runSingleHealthCheck } from "@/lib/health-check";
import { withCORS, sanitizeError } from "@/lib/security-middleware";

/**
 * GET /api/health/agents/[deploymentId]
 *
 * Health check for a specific deployment.
 * Returns HTTP status code and response time for the deployment's /api/demo endpoint.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ deploymentId: string }> }
) {
  try {
    const { deploymentId } = await params;

    const healthResult = await runSingleHealthCheck(deploymentId);

    if (!healthResult.healthy) {
      return NextResponse.json(
        {
          healthy: false,
          error: healthResult.error || "Health check failed",
          responseTime: healthResult.responseTime,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({
      healthy: true,
      responseTime: healthResult.responseTime,
      statusCode: healthResult.statusCode,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("GET /api/health/agents/[deploymentId] error:", error);
    return NextResponse.json(
      { error: sanitizeError(error).message },
      { status: 500 }
    );
  }
}