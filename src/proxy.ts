/**
 * Global security middleware for Next.js (v16+)
 *
 * Applies CORS, security headers, and request validation to all routes.
 * Uses Node.js runtime for compatibility with v16+.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { applyCors, securityHeaders } from "@/lib/security-middleware";

// Apply security headers to all responses
export function withSecurityHeaders(request: NextRequest) {
  const response = NextResponse.next();

  // Apply security headers
  Object.entries(securityHeaders()).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

// Apply CORS and security headers
export function withCORS(request: NextRequest) {
  // Apply CORS
  const corsResponse = applyCors(request);
  if (corsResponse) {
    return corsResponse;
  }

  return withSecurityHeaders(request);
}

// Apply rate limiting
export function withRateLimit(request: NextRequest, maxRequests: number = 100) {
  // Use a simple in-memory rate limiter
  // For production, consider Redis or a dedicated rate limiting service
  const ip = request.ip ?? request.headers.get("x-forwarded-for") ?? "unknown";
  const now = Date.now();
  const key = `rate_limit:${ip}`;

  const rateLimit = (global as any)[key];

  if (!rateLimit || now > rateLimit.resetTime) {
    (global as any)[key] = {
      count: 1,
      resetTime: now + 60 * 1000, // 1 minute
    };
  } else if (rateLimit.count >= maxRequests) {
    return new NextResponse(
      JSON.stringify({ error: "Too many requests" }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "X-RateLimit-Remaining": "0",
          "Retry-After": "60",
        },
      }
    );
  } else {
    rateLimit.count++;
  }

  return withSecurityHeaders(request);
}

// Export for direct use in API routes
export { applyCors, securityHeaders, withSecurityHeaders, withCORS, withRateLimit } from "@/lib/security-middleware";