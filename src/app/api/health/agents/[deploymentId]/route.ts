import { NextRequest, NextResponse } from "next/server";
import { runSingleHealthCheck } from "@/lib/health-check";

/**
 * POST /api/health/agents/[deploymentId]
 *
 * Run a health check against a single deployed agent.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ deploymentId: string }> },
) {
  try {
    const { deploymentId } = await params;

    const result = await runSingleHealthCheck(deploymentId);

    if (!result) {
      return NextResponse.json(
        { error: "No deployment found with that ID" },
        { status: 404 },
      );
    }

    if (result.healthy) {
      return NextResponse.json({
        agentName: result.agentName,
        agentSlug: result.agentSlug,
        healthy: true,
        url: result.url,
        statusCode: result.statusCode,
        responseTimeMs: result.responseTimeMs,
        checkedAt: result.checkedAt,
      });
    }

    return NextResponse.json(
      {
        agentName: result.agentName,
        agentSlug: result.agentSlug,
        healthy: false,
        url: result.url,
        error: result.error,
        responseTimeMs: result.responseTimeMs,
        checkedAt: result.checkedAt,
      },
      { status: 422 },
    );
  } catch (error) {
    console.error("POST /api/health/agents/[deploymentId] error:", error);
    return NextResponse.json(
      { error: "Internal server error during health check" },
      { status: 500 },
    );
  }
}