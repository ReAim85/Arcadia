/**
 * Usage metrics collection service (t-4.5)
 *
 * Collects API calls, response times, and error rates for deployed agents.
 * Data feeds the analytics page (t-4.6) and trust score computation (t-4.4).
 */

const VALID_METRIC_TYPES = ["api_calls", "response_time", "errors"] as const;
type MetricType = (typeof VALID_METRIC_TYPES)[number];

/**
 * Record a single usage metric entry.
 */
export async function recordMetric(
  agentId: string,
  metricType: MetricType,
  value: number,
): Promise<void> {
  if (!VALID_METRIC_TYPES.includes(metricType)) {
    throw new Error(
      `Invalid metric type: "${metricType}". Must be one of: ${VALID_METRIC_TYPES.join(", ")}`,
    );
  }

  const { getPool } = await import("@/db/client");
  const pool = getPool();

  await pool.query(
    `INSERT INTO usage_metrics (agent_id, metric_type, value, timestamp)
     VALUES ($1, $2, $3, NOW())`,
    [agentId, metricType, value.toString()],
  );
}

/**
 * Convenience: record that an agent API call occurred.
 */
export async function recordApiCall(agentId: string): Promise<void> {
  await recordMetric(agentId, "api_calls", 1);
}

/**
 * Convenience: record a response time in milliseconds.
 */
export async function recordResponseTime(
  agentId: string,
  responseTimeMs: number,
): Promise<void> {
  await recordMetric(agentId, "response_time", responseTimeMs);
}

/**
 * Convenience: record an error occurrence.
 */
export async function recordError(
  agentId: string,
  errorCode?: number | string,
): Promise<void> {
  // Store error code as numeric value, default to 1 (count)
  const value = typeof errorCode === "number" ? errorCode : 1;
  await recordMetric(agentId, "errors", value);
}

interface AgentMetricsSummary {
  agentId: string;
  windowHours: number;
  totalApiCalls: number;
  avgResponseTimeMs: number | null;
  p95ResponseTimeMs: number | null;
  totalErrors: number;
  errorRate: number; // percentage of calls that errored
}

/**
 * Aggregated metrics for an agent over the given time window.
 */
export async function getAgentMetrics(
  agentId: string,
  hours: number = 24,
): Promise<AgentMetricsSummary> {
  const { getPool } = await import("@/db/client");
  const pool = getPool();

  const windowSql = `NOW() - interval '${hours} hours'`;

  // total API calls
  const callsResult = await pool.query(
    `SELECT COALESCE(SUM(value::numeric), 0)::int as total
     FROM usage_metrics
     WHERE agent_id = $1 AND metric_type = 'api_calls' AND timestamp > ${windowSql}`,
    [agentId],
  );
  const totalApiCalls = Number(callsResult.rows[0]?.total ?? 0);

  // average + p95 response time
  const rtResult = await pool.query(
    `SELECT
       AVG(value::numeric) as avg_rt,
       PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY value::numeric) as p95_rt
     FROM usage_metrics
     WHERE agent_id = $1 AND metric_type = 'response_time' AND timestamp > ${windowSql}`,
    [agentId],
  );
  const avgResponseTimeMs = rtResult.rows[0]?.avg_rt
    ? Number(rtResult.rows[0].avg_rt)
    : null;
  const p95ResponseTimeMs = rtResult.rows[0]?.p95_rt
    ? Number(rtResult.rows[0].p95_rt)
    : null;

  // total errors
  const errorResult = await pool.query(
    `SELECT COALESCE(SUM(value::numeric), 0)::int as total
     FROM usage_metrics
     WHERE agent_id = $1 AND metric_type = 'errors' AND timestamp > ${windowSql}`,
    [agentId],
  );
  const totalErrors = Number(errorResult.rows[0]?.total ?? 0);

  const errorRate =
    totalApiCalls > 0
      ? Number(((totalErrors / totalApiCalls) * 100).toFixed(2))
      : 0;

  return {
    agentId,
    windowHours: hours,
    totalApiCalls,
    avgResponseTimeMs,
    p95ResponseTimeMs,
    totalErrors,
    errorRate,
  };
}

/**
 * Get recent error events for an agent (for debugging/retracing).
 */
export async function getRecentErrors(
  agentId: string,
  limit: number = 10,
): Promise<Array<{ value: number; timestamp: string }>> {
  const { getPool } = await import("@/db/client");
  const pool = getPool();

  const result = await pool.query(
    `SELECT value::numeric, timestamp
     FROM usage_metrics
     WHERE agent_id = $1 AND metric_type = 'errors'
     ORDER BY timestamp DESC
     LIMIT $2`,
    [agentId, limit],
  );

  return result.rows.map((row) => ({
    value: Number(row.value),
    timestamp: row.timestamp.toISOString(),
  }));
}
