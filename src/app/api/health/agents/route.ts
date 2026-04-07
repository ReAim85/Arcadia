import { NextResponse } from "next/server";
import { getPool } from "@/db/client";

/**
 * GET /api/health/agents
 *
 * Returns health status of all deployed marketplace agents.
 * Probes each agent's GET /api/health endpoint and records the result.
 */
export async function GET() {
  try {
    // Check if any live agents exist
    const pool = getPool();
    const agentsResult = await pool.query(
      `SELECT a.id, a.name, a.slug, d.vercel_deployment_id, d.url,
              d.status as deployment_status,
              hch.healthy as last_healthy, hch.checked_at as last_checked
       FROM agents a
       JOIN deployments d ON d.agent_id = a.id
       LEFT JOIN LATERAL (
         SELECT healthy, checked_at FROM health_check_history
         WHERE health_check_history.agent_id = a.id
         ORDER BY checked_at DESC LIMIT 1
       ) hch ON true
       WHERE a.status = 'live' AND d.url IS NOT NULL`,
    );

    if (agentsResult.rows.length === 0) {
      return NextResponse.json({
        agents: [],
        message: "No live agents deployed",
      });
    }

    // Run live health checks
    const { runAllHealthChecks } = await import("@/lib/health-check");
    const results = await runAllHealthChecks();

    const healthyCount = results.filter((r) => r.healthy).length;

    return NextResponse.json({
      total: results.length,
      healthy: healthyCount,
      unhealthy: results.length - healthyCount,
      agents: results.map((r) => ({
        agentId: r.agentId,
        agentName: r.agentName,
        agentSlug: r.agentSlug,
        url: r.url,
        healthy: r.healthy,
        statusCode: r.statusCode,
        responseTimeMs: r.responseTimeMs,
        error: r.error,
        checkedAt: r.checkedAt,
      })),
    });
  } catch (error) {
    console.error("GET /api/health/agents error:", error);
    return NextResponse.json(
      { error: "Internal server error during health check" },
      { status: 500 },
    );
  }
}