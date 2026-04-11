/**
 * Deployment history service (t-4.7)
 *
 * Tracks deployment success/failure history for agents.
 * Data feeds the deployment history page and trust score computation.
 */

import { getPool } from "@/db/client";

interface DeploymentHistoryEntry {
  id: string;
  agentId: string;
  vercelDeploymentId: string | null;
  url: string | null;
  status: string; // pending, building, live, failed
  errorMessage: string | null;
  deployedAt: string | null;
  createdAt: string;
}

interface DeploymentHistorySummary {
  agentId: string;
  totalDeployments: number;
  successfulDeployments: number;
  failedDeployments: number;
  successRate: number; // percentage
  lastDeployment: string | null;
  lastDeploymentStatus: string | null;
}

/**
 * Record a deployment outcome
 */
export async function recordDeploymentOutcome(
  agentId: string,
  vercelDeploymentId: string | null,
  url: string | null,
  status: string,
  errorMessage: string | null = null
): Promise<void> {
  const { getPool } = await import("@/db/client");
  const pool = getPool();

  await pool.query(
    `INSERT INTO deployments (agent_id, vercel_deployment_id, url, status, error_message, deployed_at, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
    [agentId, vercelDeploymentId, url, status, errorMessage ?? null, new Date().toISOString()]
  );
}

/**
 * Get deployment history for an agent
 */
export async function getDeploymentHistory(
  agentId: string,
  limit: number = 50
): Promise<DeploymentHistoryEntry[]> {
  const { getPool } = await import("@/db/client");
  const pool = getPool();

  const result = await pool.query(
    `SELECT id, agent_id, vercel_deployment_id, url, status, error_message, deployed_at, created_at
     FROM deployments
     WHERE agent_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [agentId, limit]
  );

  return result.rows.map(row => ({
    id: row.id,
    agentId: row.agent_id,
    vercelDeploymentId: row.vercel_deployment_id,
    url: row.url,
    status: row.status,
    errorMessage: row.error_message,
    deployedAt: row.deployed_at ? new Date(row.deployed_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString()
  }));
}

/**
 * Get deployment history summary for an agent
 */
export async function getDeploymentHistorySummary(
  agentId: string
): Promise<DeploymentHistorySummary> {
  const { getPool } = await import("@/db/client");
  const pool = getPool();

  // Get deployment counts and latest deployment
  const result = await pool.query(`
    SELECT
      COUNT(*) as total_deployments,
      COUNT(CASE WHEN status = 'live' THEN 1 END) as successful_deployments,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_deployments,
      MAX(created_at) as last_deployment_date,
      (ARRAY_AGG(status ORDER BY created_at DESC))[1] as last_deployment_status
    FROM deployments
    WHERE agent_id = $1
  `, [agentId]);

  const row = result.rows[0];
  const totalDeployments = Number(row?.total_deployments ?? 0);
  const successfulDeployments = Number(row?.successful_deployments ?? 0);
  const failedDeployments = Number(row?.failed_deployments ?? 0);

  const successRate =
    totalDeployments > 0
      ? Number(((successfulDeployments / totalDeployments) * 100).toFixed(2))
      : 0;

  return {
    agentId,
    totalDeployments,
    successfulDeployments,
    failedDeployments,
    successRate: Math.round(successRate * 10) / 10, // Round to 1 decimal place
    lastDeployment: row?.last_deployment_date
      ? new Date(row.last_deployment_date).toISOString()
      : null,
    lastDeploymentStatus: row?.last_deployment_status ?? null
  };
}

/**
 * Get deployment history summaries for multiple agents
 */
export async function getMultipleDeploymentHistorySummaries(
  agentIds: string[]
): Promise<DeploymentHistorySummary[]> {
  const promises = agentIds.map(id => getDeploymentHistorySummary(id));
  return Promise.all(promises);
}

/**
 * Get agents with deployment history, sorted by success rate
 */
export async function getAgentsByDeploymentSuccessRate(
  limit: number = 10
): Promise<Array<DeploymentHistorySummary & { agentName: string }>> {
  const { getPool } = await import("@/db/client");
  const pool = getPool();

  // Get all agents with their basic info
  const agentsResult = await pool.query(`
    SELECT id, name
    FROM agents
    WHERE status = 'live'
    ORDER BY name
  `);

  const agentIds = agentsResult.rows.map(row => row.id);

  if (agentIds.length === 0) {
    return [];
  }

  // Get deployment history summaries for all agents
  const deploymentSummaries = await getMultipleDeploymentHistorySummaries(agentIds);

  // Join with agent names and sort by success rate descending
  const agentsWithHistory = deploymentSummaries
    .map(summary => {
      const agent = agentsResult.rows.find(a => a.id === summary.agentId);
      return {
        ...summary,
        agentName: agent ? agent.name : "Unknown Agent",
      };
    })
    .filter(summary => summary.totalDeployments > 0) // Only agents with deployment history
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, limit);

  return agentsWithHistory;
}