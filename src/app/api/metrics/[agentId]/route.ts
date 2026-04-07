import { NextRequest, NextResponse } from "next/server";
import { getAgentMetrics, getRecentErrors } from "@/lib/usage-metrics";

/**
 * GET /api/metrics/[agentId]
 *
 * Get aggregated usage metrics for a specific agent.
 * Query params: hours? (default 24)
 *
 * Returns: summary of API calls, response times, error rates.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> },
) {
  try {
    const { agentId } = await params;

    const searchParams = _request.nextUrl.searchParams;
    const hours = parseInt(searchParams.get("hours") ?? "24", 10);

    if (isNaN(hours) || hours <= 0) {
      return NextResponse.json(
        { error: "hours must be a positive number" },
        { status: 400 },
      );
    }

    const metrics = await getAgentMetrics(agentId, hours);
    if (!metrics) {
      return NextResponse.json(
        { error: "No metrics found for this agent" },
        { status: 404 },
      );
    }

    const recentErrors = await getRecentErrors(agentId, 5);

    return NextResponse.json({
      agentId,
      windowHours: hours,
      summary: {
        totalApiCalls: metrics.totalApiCalls,
        avgResponseTimeMs: metrics.avgResponseTimeMs,
        p95ResponseTimeMs: metrics.p95ResponseTimeMs,
        totalErrors: metrics.totalErrors,
        errorRate: metrics.errorRate,
      },
      recentErrors: recentErrors.map((e) => ({
        value: e.value,
        timestamp: e.timestamp,
      })),
    });
  } catch (error) {
    console.error("GET /api/metrics/[agentId] error:", error);
    return NextResponse.json(
      { error: "Internal server error fetching metrics" },
      { status: 500 },
    );
  }
}