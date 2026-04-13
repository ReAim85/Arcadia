import { NextRequest, NextResponse } from "next/server";
import { deployToVercel } from "@/lib/vercel-deploy";
import { getPool } from "@/db/client";
import { withCORS, sanitizeError } from "@/lib/security-middleware";

/**
 * POST /api/deploy/seed
 *
 * Deploy a seed template agent to the user's Vercel account.
 * This is used for deploying the 4 seed templates: API Builder, Live Debugger, Code Reviewer, Data Analyst.
 *
 * Body:
 *   {
 *     userId: string;
 *     template: "api-builder" | "live-debugger" | "code-reviewer" | "data-analyst";
 *     projectName?: string;
 *   }
 *
 * Returns the Vercel deployment URL if successful.
 */
export async function POST(request: NextRequest) {
  try {
    // Apply CORS
    const corsResponse = withCORS(request);
    if (corsResponse) return corsResponse;

    const body = await request.json();
    const {
      userId,
      template,
      projectName,
    }: {
      userId: string;
      template: string;
      projectName?: string;
    } = body;

    // Validate required fields
    if (!userId) {
      return NextResponse.json(
        { error: "userId is required" },
        { status: 400 }
      );
    }

    if (!template) {
      return NextResponse.json(
        { error: "template is required" },
        { status: 400 }
      );
    }

    // Validate userId format (UUID or similar)
    const userIdPattern = /^[a-zA-Z0-9_-]+$/;
    if (!userIdPattern.test(userId)) {
      return NextResponse.json(
        { error: "Invalid userId format" },
        { status: 400 }
      );
    }

    // Validate template type
    const validTemplates = ["api-builder", "live-debugger", "code-reviewer", "data-analyst"];
    if (!validTemplates.includes(template)) {
      return NextResponse.json(
        { error: `template must be one of: ${validTemplates.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate projectName if provided
    if (projectName && projectName.length > 100) {
      return NextResponse.json(
        { error: "projectName must not exceed 100 characters" },
        { status: 400 }
      );
    }

    // Fetch the user's encrypted token
    const pool = getPool();
    const userResult = await pool.query(
      `SELECT id, vercel_token_encrypted, vercel_team_id FROM users WHERE id = $1`,
      [userId],
    );

    if (!userResult.rows.length) {
      return NextResponse.json(
        { error: "User not found. Please connect your Vercel account first." },
        { status: 404 }
      );
    }

    const userRow = userResult.rows[0];

    // For seed templates, we'll use a placeholder GitHub URL pointing to our template
    // In a real implementation, these would be actual GitHub repositories
    const templateMap: Record<string, string> = {
      "api-builder": "https://github.com/agenthub/templates/api-builder",
      "live-debugger": "https://github.com/agenthub/templates/live-debugger",
      "code-reviewer": "https://github.com/agenthub/templates/code-reviewer",
      "data-analyst": "https://github.com/agenthub/templates/data-analyst"
    };

    const githubUrl = templateMap[template];
    const name = projectName || `${template}-${Date.now()}`;

    // Deploy to Vercel using our existing deployToVercel function
    const result = await deployToVercel({
      userId,
      githubUrl,
      projectName: name,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      projectId: result.projectId,
      deploymentId: result.deploymentId,
      url: result.url,
      message: `Deployed ${template} template successfully to ${result.url}`,
    });
  } catch (error) {
    console.error("POST /api/deploy/seed error:", error);
    return NextResponse.json(
      { error: sanitizeError(error).message },
      { status: 500 }
    );
  }
}