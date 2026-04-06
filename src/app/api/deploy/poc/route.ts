import { NextResponse } from "next/server";
import { deployToVercel } from "@/lib/vercel-deploy";

/**
 * POST /api/deploy/poc
 *
 * Cross-account deploy PoC (t-1.6).
 *
 * Body:
 *   { userId: string; githubUrl: string; projectName?: string }
 *
 * Returns the Vercel deployment URL if successful.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      userId,
      githubUrl,
      projectName,
    }: {
      userId: string;
      githubUrl: string;
      projectName?: string;
    } = body;

    if (!userId || !githubUrl) {
      return NextResponse.json(
        { error: "userId and githubUrl are required" },
        { status: 400 },
      );
    }

    const name = projectName || `agent-${Date.now()}`;

    const result = await deployToVercel({
      userId,
      githubUrl,
      projectName: name,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 422 },
      );
    }

    return NextResponse.json({
      success: true,
      deploymentId: result.deploymentId,
      url: result.url,
      message: `Deployed successfully to ${result.url}`,
    });
  } catch (error) {
    console.error("POST /api/deploy/poc error:", error);
    return NextResponse.json(
      { error: "Internal server error during deployment" },
      { status: 500 },
    );
  }
}
