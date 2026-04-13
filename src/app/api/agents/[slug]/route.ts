import { getPool } from "@/db/client";
import { NextResponse } from "next/server";
import { withCORS, sanitizeError } from "@/lib/security-middleware";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // Apply CORS
    const corsResponse = withCORS(request);
    if (corsResponse) return corsResponse;

    const { slug } = await params;

    // Validate slug format
    const slugPattern = /^[a-zA-Z0-9_-]+$/;
    if (!slugPattern.test(slug)) {
      return NextResponse.json(
        { error: "Invalid slug format" },
        { status: 400 }
      );
    }

    const pool = getPool();
    const agentResult = await pool.query(
      `SELECT
        a.id, a.slug, a.name, a.description, a.category,
        a.github_url, a.vercel_project_id, a.vercel_url,
        a.badge, a.status, a.created_at,
        COUNT(DISTINCT d.id) AS deploy_count,
        (SELECT COUNT(*) FROM deployments WHERE agent_id = a.id AND status = 'live') AS live_deploys,
        (SELECT COUNT(*) FROM deployments WHERE agent_id = a.id AND status = 'failed') AS failed_deploys
      FROM agents a
      LEFT JOIN deployments d ON d.agent_id = a.id
      WHERE a.slug = $1
      GROUP BY a.id`,
      [slug]
    );

    if (!agentResult.rows.length) {
      return NextResponse.json(
        { error: "Agent not found" },
        { status: 404 }
      );
    }

    // Fetch recent deployments
    const depResult = await pool.query(
      `SELECT id, vercel_deployment_id, url, status, error_message, deployed_at, created_at
       FROM deployments
       WHERE agent_id = $1
       ORDER BY created_at DESC
       LIMIT 10`,
      [agentResult.rows[0].id]
    );

    return NextResponse.json({
      ...agentResult.rows[0],
      deployments: depResult.rows,
    });
  } catch (error) {
    console.error("GET /api/agents/[slug] error:", error);
    return NextResponse.json(
      { error: sanitizeError(error).message },
      { status: 500 }
    );
  }
}