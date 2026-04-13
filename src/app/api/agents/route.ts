import { NextRequest, NextResponse } from "next/server";
import { getAllAgents } from "@/lib/agent-utils";
import { withCORS, sanitizeError } from "@/lib/security-middleware";

/**
 * GET /api/agents
 *
 * List all available agents with their metadata.
 * Returns array of agent objects.
 */
export async function GET(request: NextRequest) {
  try {
    // Apply CORS
    const corsResponse = withCORS(request);
    if (corsResponse) return corsResponse;

    const searchParams = await request.nextUrl.searchParams;
    const category = searchParams.get("category");
    const limit = parseInt(searchParams.get("limit") ?? "100", 10);

    if (isNaN(limit) || limit < 1) {
      return NextResponse.json(
        { error: "limit must be a positive number" },
        { status: 400 },
      );
    }

    if (limit > 500) {
      return NextResponse.json(
        { error: "limit cannot exceed 500" },
        { status: 400 },
      );
    }

    const agents = await getAllAgents({ category, limit });

    return NextResponse.json({
      total: agents.length,
      agents,
    });
  } catch (error) {
    console.error("GET /api/agents error:", error);
    return NextResponse.json(
      { error: sanitizeError(error).message },
      { status: 500 },
    );
  }
}