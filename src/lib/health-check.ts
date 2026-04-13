/**
 * Health check service (t-4.2)
 *
 * Probes GET /api/health on all deployed agents and records results.
 * Used by both manual checks and Vercel Cron (t-4.3).
 */

export interface AgentHealthResult {
  agentId: string;
  agentName: string;
  agentSlug: string;
  deploymentId: string;
  url: string;
  healthy: boolean;
  statusCode: number | null;
  responseTimeMs: number;
  error: string | null;
  checkedAt: string;
}

const HEALTH_TIMEOUT_MS = 10_000;

/**
 * Fetch all live deployments with a vercel_url.
 */
async function getLiveDeployments(): Promise<
  Array<{
    agent_id: string;
    agent_name: string;
    agent_slug: string;
    vercel_deployment_id: string | null;
    deployment_url: string;
  }>
> {
  const { getPool } = await import("@/db/client");
  const pool = getPool();

  const result = await pool.query(
    `SELECT a.id as agent_id, a.name as agent_name, a.slug as agent_slug,
            d.vercel_deployment_id, d.url as deployment_url
     FROM agents a
     JOIN deployments d ON d.agent_id = a.id
     WHERE a.status = 'live' AND d.url IS NOT NULL AND d.url != ''`,
  );

  return result.rows;
}

/**
 * Probe a single agent's GET /api/health endpoint.
 */
async function probeAgent(
  agentId: string,
  agentName: string,
  agentSlug: string,
  deploymentId: string | null,
  url: string,
): Promise<AgentHealthResult> {
  const healthUrl = `${url.replace(/\/+$/, "")}/api/health`;
  const checkedAt = new Date().toISOString();
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);

    const response = await fetch(healthUrl, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseTimeMs = Date.now() - startTime;

    let status: "ok" | null;
    try {
      const body = await response.json();
      status = (body as Record<string, unknown>).status === "ok" ? "ok" : null;
    } catch {
      status = null;
    }

    const healthy = response.ok && status === "ok";

    return {
      agentId,
      agentName,
      agentSlug,
      deploymentId: deploymentId ?? "unknown",
      url: healthUrl,
      healthy,
      statusCode: response.status,
      responseTimeMs,
      error: healthy ? null : `Response status ${response.status}, status field: ${status ?? "missing"}`,
      checkedAt,
    };
  } catch (e: unknown) {
    const responseTimeMs = Date.now() - startTime;
    const message =
      e instanceof Error ? e.message : "Unknown error during health check";

    return {
      agentId,
      agentName,
      agentSlug,
      deploymentId: deploymentId ?? "unknown",
      url: healthUrl,
      healthy: false,
      statusCode: null,
      responseTimeMs,
      error: message,
      checkedAt,
    };
  }
}

/**
 * Record health check results in the DB.
 */
async function recordHealthCheck(result: AgentHealthResult): Promise<void> {
  const { getPool } = await import("@/db/client");
  const pool = getPool();

  // Update latest deployment status for this agent
  if (result.deploymentId && result.deploymentId !== "unknown") {
    await pool.query(
      `UPDATE deployments SET status = $1 WHERE vercel_deployment_id = $2`,
      [result.healthy ? "live" : "failed", result.deploymentId],
    );
  }

  // Record in health_check_history table
  await pool.query(
    `INSERT INTO health_check_history
       (agent_id, deployment_id, healthy, status_code, response_time_ms, error_message, checked_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      result.agentId,
      result.deploymentId,
      result.healthy,
      result.statusCode ?? null,
      result.responseTimeMs,
      result.error ?? null,
      result.checkedAt,
    ],
  );
}

/**
 * Run health checks on all deployed live agents.
 * Returns an array of results for each agent probed.
 */
export async function runAllHealthChecks(): Promise<AgentHealthResult[]> {
  const deployments = await getLiveDeployments();

  if (deployments.length === 0) {
    return [];
  }

  // Run checks in parallel (all independent HTTP calls)
  const results = await Promise.all(
    deployments.map((d) =>
      probeAgent(
        d.agent_id,
        d.agent_name,
        d.agent_slug,
        d.vercel_deployment_id,
        d.deployment_url!,
      ),
    ),
  );

  // Record each result
  await Promise.all(
    results.map((r) => recordHealthCheck(r).catch(() => {})),
  );

  return results;
}

/**
 * Run health check on a single deployment identified by vercel_deployment_id.
 */
export async function runSingleHealthCheck(
  vercelDeploymentId: string,
): Promise<AgentHealthResult | null> {
  const { getPool } = await import("@/db/client");
  const pool = getPool();

  const result = await pool.query(
    `SELECT a.id as agent_id, a.name as agent_name, a.slug as agent_slug,
            d.vercel_deployment_id, d.url as deployment_url
     FROM agents a
     JOIN deployments d ON d.agent_id = a.id
     WHERE d.vercel_deployment_id = $1`,
    [vercelDeploymentId],
  );

  if (!result.rows.length) return null;

  const d = result.rows[0];
  const healthResult = await probeAgent(
    d.agent_id,
    d.agent_name,
    d.agent_slug,
    d.vercel_deployment_id,
    d.deployment_url,
  );

  await recordHealthCheck(healthResult);
  return healthResult;
}