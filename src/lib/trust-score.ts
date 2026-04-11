/**
 * Trust score computation service (t-4.4)
 *
 * Computes trust scores for agents based on:
 * - Success rate (from demo tests and health checks): 50% weight
 * - Uptime (from health check history): 30% weight
 * - Rating norm (from user ratings): 20% weight (placeholder for future)
 *
 * Formula: score = (success_rate × 50) + (uptime_norm × 30) + (rating_norm × 20)
 */

import { getPool } from "@/db/client";

interface TrustScoreComponents {
  successRate: number; // 0-100 percentage
  uptimeNorm: number; // 0-100 percentage
  ratingNorm: number; // 0-100 percentage (placeholder)
}

interface TrustScoreResult {
  agentId: string;
  score: number; // 0-100
  successRate: number;
  uptimeNorm: number;
  ratingNorm: number;
  computedAt: string;
}

/**
 * Compute success rate percentage from usage metrics and health checks
 * Success rate = (1 - error rate) * 100, where error rate = errors / api_calls
 */
async function computeSuccessRate(agentId: string, hours: number = 24): Promise<number> {
  const { getPool } = await import("@/db/client");
  const pool = getPool();

  const windowSql = `NOW() - interval '${hours} hours'`;

  // Get API calls and errors
  const metricsResult = await pool.query(`
    SELECT
      COALESCE(SUM(CASE WHEN metric_type = 'api_calls' THEN value::numeric ELSE 0 END), 0) as api_calls,
      COALESCE(SUM(CASE WHEN metric_type = 'errors' THEN value::numeric ELSE 0 END), 0) as errors
    FROM usage_metrics
    WHERE agent_id = $1 AND timestamp > ${windowSql}
  `, [agentId]);

  const row = metricsResult.rows[0];
  const apiCalls = Number(row?.api_calls ?? 0);
  const errors = Number(row?.errors ?? 0);

  if (apiCalls === 0) {
    // No data yet - return neutral score
    return 50;
  }

  const errorRate = errors / apiCalls;
  const successRate = Math.max(0, Math.min(100, (1 - errorRate) * 100));
  return successRate;
}

/**
 * Compute uptime percentage from health check history
 * Uptime = (healthy checks / total checks) * 100
 */
async function computeUptimeNorm(agentId: string, hours: number = 24): Promise<number> {
  const { getPool } = await import("@/db/client");
  const pool = getPool();

  const windowSql = `NOW() - interval '${hours} hours'`;

  const result = await pool.query(`
    SELECT
      COALESCE(SUM(CASE WHEN healthy = 1 THEN 1 ELSE 0 END), 0) as healthy_checks,
      COALESCE(COUNT(*), 0) as total_checks
    FROM health_check_history
    WHERE agent_id = $1 AND checked_at > ${windowSql}
  `, [agentId]);

  const row = result.rows[0];
  const healthyChecks = Number(row?.healthy_checks ?? 0);
  const totalChecks = Number(row?.total_checks ?? 0);

  if (totalChecks === 0) {
    // No health check data yet - return neutral score
    return 50;
  }

  const uptimeNorm = (healthyChecks / totalChecks) * 100;
  return Math.max(0, Math.min(100, uptimeNorm));
}

/**
 * Compute rating norm from user ratings
 * Placeholder implementation - returns neutral score until rating system is implemented (t-5.1)
 */
async function computeRatingNorm(agentId: string): Promise<number> {
  // TODO: Implement when t-5.1 (Agent reviews and ratings system) is completed
  // For now, return neutral score
  return 50;
}

/**
 * Compute overall trust score for an agent
 */
export async function computeTrustScore(
  agentId: string,
  hours: number = 24
): Promise<TrustScoreResult> {
  const [successRate, uptimeNorm, ratingNorm] = await Promise.all([
    computeSuccessRate(agentId, hours),
    computeUptimeNorm(agentId, hours),
    computeRatingNorm(agentId),
  ]);

  // Apply weights: success_rate (50%), uptime_norm (30%), rating_norm (20%)
  const score =
    (successRate * 0.5) +
    (uptimeNorm * 0.3) +
    (ratingNorm * 0.2);

  return {
    agentId,
    score: Math.round(score * 10) / 10, // Round to 1 decimal place
    successRate: Math.round(successRate * 10) / 10,
    uptimeNorm: Math.round(uptimeNorm * 10) / 10,
    ratingNorm: Math.round(ratingNorm * 10) / 10,
    computedAt: new Date().toISOString(),
  };
}

/**
 * Get trust scores for multiple agents
 */
export async function getMultipleTrustScores(
  agentIds: string[],
  hours: number = 24
): Promise<TrustScoreResult[]> {
  const promises = agentIds.map(id => computeTrustScore(id, hours));
  return Promise.all(promises);
}

/**
 * Get top N agents by trust score
 */
export async function getTopAgentsByTrustScore(
  limit: number = 10,
  hours: number = 24
): Promise<Array<TrustScoreResult & { agentName: string }>> {
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

  // Compute trust scores for all agents
  const trustScores = await getMultipleTrustScores(agentIds, hours);

  // Join with agent names and sort by score descending
  const scoredAgents = trustScores
    .map(score => {
      const agent = agentsResult.rows.find(a => a.id === score.agentId);
      return {
        ...score,
        agentName: agent ? agent.name : "Unknown Agent",
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scoredAgents;
}