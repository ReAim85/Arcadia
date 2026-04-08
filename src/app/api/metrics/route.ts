import { NextRequest, NextResponse } from "next/server";
import { recordMetric } from "@/lib/usage-metrics";

const VALID_TYPES = ["api_calls", "response_time", "errors"] as const;

/**
 * POST /api/metrics
 *
 * Record a single usage metric for an agent.
 * Body: { agentId, metricType: "api_calls" | "response_time" | "errors", value: number }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { agentId, metricType, value } = body as {
      agentId?: string;
      metricType?: string;
      value?: number;
    };

    if (!agentId || !metricType || value === undefined || value === null) {
      return NextResponse.json(
        { error: "agentId, metricType, and value are required" },
        { status: 400 },
      );
    }

    if (!VALID_TYPES.includes(metricType as (typeof VALID_TYPES)[number])) {
      return NextResponse.json(
        { error: `metricType must be one of: ${VALID_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    if (typeof value !== "number" || value < 0) {
      return NextResponse.json(
        { error: "value must be a non-negative number" },
        { status: 400 },
      );
    }

    await recordMetric(agentId, metricType as (typeof VALID_TYPES)[number], value);

    return NextResponse.json({
      success: true,
      agentId,
      metricType,
      value,
    });
  } catch (error) {
    console.error("POST /api/metrics error:", error);
    return NextResponse.json(
      { error: "Internal server error recording metric" },
      { status: 500 },
    );
  }
}