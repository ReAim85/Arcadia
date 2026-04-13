/**
 * Health check endpoint
 *
 * For use by monitoring systems and cron jobs.
 * Includes rate limiting and Vercel-specific headers validation.
 */

import { NextRequest, NextResponse } from "next/server";
import { checkHealthCheckRateLimit, sanitizeError } from "@/lib/security-middleware";

// Vercel-specific headers for cron job validation
const VERCEL_HEADER = "x-vercel-id";
const CRON_SECRET = process.env.CRON_SECRET || "dev-cron-secret";

export async function GET(request: NextRequest) {
  try {
    // Rate limiting for health checks
    const rateLimitResponse = checkHealthCheckRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Basic authentication for health checks
    // In production, verify the Vercel-specific header
    const headerValue = request.headers.get(VERCEL_HEADER);
    if (!headerValue || headerValue !== CRON_SECRET) {
      return NextResponse.json(
        { status: "unauthorized", error: "Invalid health check token" },
        { status: 401 }
      );
    }

    // Check if this is a Vercel deployment
    const isVercel = request.headers.get("x-vercel-id") !== null;

    // Perform basic health checks
    const healthChecks = {
      status: "healthy",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      isVercel,
      checks: {
        database: false,
        vencel: false,
      },
    };

    // Database health check
    try {
      const { getPool } = await import("@/db/client");
      const pool = getPool();
      await pool.query("SELECT 1");
      healthChecks.checks.database = true;
    } catch (error) {
      healthChecks.status = "degraded";
      healthChecks.checks.database = false;
      console.error("Database health check failed:", error);
    }

    // Vercel API health check
    try {
      // This is a placeholder - implement actual health check
      healthChecks.checks.vencel = true;
    } catch (error) {
      healthChecks.status = "degraded";
      healthChecks.checks.vencel = false;
      console.error("Vercel health check failed:", error);
    }

    // If all checks pass, return 200
    // If some checks fail, return 200 but with degraded status
    // If critical checks fail, return 503 (optional)
    return NextResponse.json(healthChecks);
  } catch (error) {
    console.error("Health check error:", error);
    return NextResponse.json(
      { error: sanitizeError(error).message },
      { status: 500 }
    );
  }
}

// POST endpoint for manual health check (for debugging)
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = checkHealthCheckRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Basic authentication for manual health checks
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { status: "unauthorized", error: "Authorization required" },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];
    if (token !== CRON_SECRET) {
      return NextResponse.json(
        { status: "unauthorized", error: "Invalid authorization token" },
        { status: 401 }
      );
    }

    // Execute health checks
    const healthChecks = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      checks: {
        database: false,
        vencel: false,
      },
    };

    // Database health check
    try {
      const { getPool } = await import("@/db/client");
      const pool = getPool();
      await pool.query("SELECT 1");
      healthChecks.checks.database = true;
    } catch (error) {
      healthChecks.status = "degraded";
      healthChecks.checks.database = false;
      console.error("Database health check failed:", error);
    }

    // Vercel API health check
    try {
      healthChecks.checks.vencel = true;
    } catch (error) {
      healthChecks.status = "degraded";
      healthChecks.checks.vencel = false;
      console.error("Vercel health check failed:", error);
    }

    return NextResponse.json(healthChecks);
  } catch (error) {
    console.error("Health check POST error:", error);
    return NextResponse.json(
      { error: sanitizeError(error).message },
      { status: 500 }
    );
  }
}
