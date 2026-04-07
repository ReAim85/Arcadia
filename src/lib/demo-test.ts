/**
 * Demo test runner (t-2.9)
 *
 * Validates deployed agents by calling POST /api/demo on their deployed URL
 * and checking that the response matches the agent contract:
 *   { result: ..., demo_config: ... }
 */

export interface DemoTestResult {
  success: boolean;
  agentId: string;
  agentName?: string;
  agentUrl: string;
  deploymentId: string;
  statusCode?: number;
  responseTime: number;
  response?: Record<string, unknown>;
  error?: string;
  testedAt: string;
}

const DEMO_TIMEOUT_MS = 15_000;

/**
 * Run a POST /api/demo test against a deployed agent URL.
 * Validates the response structure matches the agent contract.
 */
export async function runDemoTest(
  agentId: string,
  agentName: string | null,
  vercelUrl: string,
  deploymentId: string,
): Promise<DemoTestResult> {
  const agentUrl = vercelUrl.replace(/\/+$/, "");
  const demoUrl = `${agentUrl}/api/demo`;
  const testedAt = new Date().toISOString();
  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DEMO_TIMEOUT_MS);

    const response = await fetch(demoUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - startTime;
    const statusCode = response.status;

    let data: Record<string, unknown>;
    try {
      data = await response.json();
    } catch (parseError: unknown) {
      return {
        success: false,
        agentId,
        agentName: agentName ?? undefined,
        agentUrl: demoUrl,
        deploymentId,
        statusCode,
        responseTime,
        error: `Response is not valid JSON`,
        testedAt,
      };
    }

    // Validate agent contract: should have at least one of result or demo_config
    const hasValidStructure =
      data !== null &&
      typeof data === "object" &&
      ("result" in data || "demo_config" in data);

    if (!hasValidStructure) {
      return {
        success: false,
        agentId,
        agentName: agentName ?? undefined,
        agentUrl: demoUrl,
        deploymentId,
        statusCode,
        responseTime,
        response: data,
        error: `Response missing required fields: expected { result } or { demo_config }`,
        testedAt,
      };
    }

    return {
      success: true,
      agentId,
      agentName: agentName ?? undefined,
      agentUrl: demoUrl,
      deploymentId,
      statusCode,
      responseTime,
      response: data,
      testedAt,
    };
  } catch (e: unknown) {
    const responseTime = Date.now() - startTime;
    const message =
      e instanceof Error ? e.message : "Unknown error during demo test";

    return {
      success: false,
      agentId,
      agentName: agentName ?? undefined,
      agentUrl: demoUrl,
      deploymentId,
      responseTime,
      error: message,
      testedAt,
    };
  }
}

/**
 * Record a demo test result in the DB.
 */
export async function recordDemoTestResult(result: DemoTestResult): Promise<void> {
  const { getPool } = await import("@/db/client");
  const pool = getPool();

  await pool.query(
    `UPDATE deployments
     SET status = $1
     WHERE vercel_deployment_id = $2`,
    [result.success ? "live" : "failed", result.deploymentId],
  );

  await pool.query(
    `INSERT INTO deployment_tests (deployment_id, success, status_code, response_time_ms, error_message, tested_at)
     VALUES (
       (SELECT id FROM deployments WHERE vercel_deployment_id = $1),
       $2, $3, $4, $5, $6
     )`,
    [
      result.deploymentId,
      result.success ? 1 : 0,
      result.statusCode ?? null,
      result.responseTime,
      result.error ?? null,
      result.testedAt,
    ],
  );
}