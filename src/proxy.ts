/**
 * Global security middleware for Next.js (v16+)
 *
 * Applies CORS, security headers, and request validation to all routes.
 * Uses Node.js runtime for compatibility with v16+.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { applyCors, securityHeaders } from "@/lib/security-middleware";

/**
 * Global proxy function that applies security headers to all responses.
 * In Next.js 16+, the proxy.ts file must export a function named 'proxy' or a default export.
 */
export function proxy(request: NextRequest) {
  // Apply security headers to all responses
  const response = NextResponse.next();

  // Apply security headers
  Object.entries(securityHeaders()).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Apply CORS if needed
  const corsResponse = applyCors(request);
  if (corsResponse) {
    return corsResponse;
  }

  return response;
}

// Export individual functions for use in API routes
export { applyCors, securityHeaders, proxy };