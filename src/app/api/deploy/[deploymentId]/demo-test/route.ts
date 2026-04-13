import { NextRequest, NextResponse } from "next/server";
import { runDemoTest, recordDemoTestResult } from "@/lib/demo-test";
import { getPool } from "@/db/client";
import { withCORS, sanitizeError } from "@/lib/security-middleware";

/**
 * POST /api/deploy/[deploymentId]/demo-test
 *
 * Run a demo test against a deployed agent's /api/demo endpoint.
 * Validates the response matches the agent contract.
 * Records the test result in the DB.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ deploymentId: string }> },
) {
  try {
    const { deploymentId } = await params;

    // Validate deploymentId format
    const deploymentIdPattern = /^[a-zA-Z0-9_-]+$/;
    if (!deploymentIdPattern.test(deploymentId)) {
      return NextResponse.json(
        { error: "Invalid deploymentId format" },
        { status: 400 }
      );
    }

    // Fetch the deployment with agent info
    const pool = getPool();
    const deployResult = await pool.query(
      `SELECT d.id, d.vercel_deployment_id, d.url, d.status, a.id as agent_id, a.name
       FROM deployments d
       JOIN agents a ON a.id = d.agent_id
       WHERE d.vercel_deployment_id = $1`,
      [deploymentId],
    );

    if (!deployResult.rows.length) {
      return NextResponse.json(
        { error: "Deployment not found" },
        { status: 404 },
      );
    }

    const row = deployResult.rows[0];

    if (!row.url) {
      return NextResponse.json(
        { error: "No deployment URL available for this agent" },
        { status: 400 },
      );
    }

    // Run the demo test
    const testResult = await runDemoTest(
      row.agent_id,
      row.name,
      row.url,
      deploymentId,
    );

    // Record in DB
    await recordDemoTestResult(testResult);

    if (testResult.success) {
      return NextResponse.json({
        success: true,
        message: "Demo test passed",
        agentName: testResult.agentName,
        testedUrl: testResult.agentUrl,
        statusCode: testResult.statusCode,
        responseTime: testResult.responseTime,
        response: testResult.response,
        testedAt: testResult.testedAt,
      });
    }

    return NextResponse.json(
      {
        success: false,
        message: "Demo test failed",
        agentName: testResult.agentName,
        testedUrl: testResult.agentUrl,
        error: testResult.error,
        responseTime: testResult.responseTime,
        testedAt: testResult.testedAt,
      },
      { status: 422 },
    );
  } catch (error) {
    console.error("POST /api/deploy/demo-test error:", error);
    return NextResponse.json(
      { error: sanitizeError(error).message },
      { status: 500 },
    );
  }
}