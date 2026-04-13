/**
 * Security middleware utilities
 *
 * Provides rate limiting, CORS, input validation, and error sanitization
 * for API routes.
 */

import { NextRequest, NextResponse } from "next/server";

// ---------- Rate Limiting ----------

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_RATE_LIMIT = 100; // requests per window

interface RateLimitOptions {
  windowMs?: number;
  maxRequests?: number;
  keyExtractor?: (request: NextRequest) => string;
}

export function createRateLimiter(options: RateLimitOptions = {}) {
  const { windowMs = RATE_LIMIT_WINDOW_MS, maxRequests = DEFAULT_RATE_LIMIT } = options;

  return {
    check(request: NextRequest): NextResponse | null {
      const key = options.keyExtractor
        ? options.keyExtractor(request)
        : request.ip ?? request.headers.get("x-forwarded-for") ?? "unknown";

      const now = Date.now();
      const record = rateLimitStore.get(key);

      if (!record || now > record.resetTime) {
        rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
        return null;
      }

      if (record.count >= maxRequests) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);
        return new NextResponse(
          JSON.stringify({ error: "Too many requests" }),
          {
            status: 429,
            headers: {
              "Content-Type": "application/json",
              "X-RateLimit-Remaining": "0",
              "X-RateLimit-Reset": String(Math.ceil(record.resetTime / 1000)),
              "Retry-After": String(retryAfter),
            },
          }
        );
      }

      record.count++;
      return null;
    },
  };
}

// ---------- CORS ----------

export const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

export function applyCors(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");

  if (CORS_ORIGIN === "*" || !origin) {
    return null; // Allow all or no origin provided
  }

  // If CORS_ORIGIN is a specific origin, check it
  if (CORS_ORIGIN !== "*" && origin !== CORS_ORIGIN) {
    return new NextResponse(
      JSON.stringify({ error: "CORS origin not allowed" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }

  return null; // Allow the request
}

// ---------- Request Size Limits ----------

export const MAX_REQUEST_SIZE = 10 * 1024 * 1024; // 10MB

export function checkRequestSize(request: NextRequest): NextResponse | null {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) return null;

  const size = parseInt(contentLength, 10);
  if (isNaN(size) || size > MAX_REQUEST_SIZE) {
    return new NextResponse(
      JSON.stringify({ error: "Request body too large" }),
      { status: 413, headers: { "Content-Type": "application/json" } }
    );
  }

  return null;
}

// ---------- Error Sanitization ----------

export interface SanitizedError {
  message: string;
  type?: string;
  code?: string;
}

export function sanitizeError(error: unknown): SanitizedError {
  if (error instanceof Error) {
    return {
      message: error.message,
      type: error.constructor.name,
      code: (error as { code?: string }).code,
    };
  }

  return { message: "An unexpected error occurred" };
}

// ---------- Request Validation ----------

export interface ValidationRule {
  field: string;
  type: "string" | "number" | "boolean" | "array";
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  enum?: string[];
}

export function validateRequest(
  body: unknown,
  rules: ValidationRule[]
): { valid: true; data: Record<string, unknown> } | { valid: false; errors: string[] } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      valid: false,
      errors: ["Request body must be an object"],
    };
  }

  const errors: string[] = [];
  const data: Record<string, unknown> = {};

  for (const rule of rules) {
    const value = (body as Record<string, unknown>)[rule.field];

    // Check required
    if (rule.required && (value === undefined || value === null || value === "")) {
      errors.push(`${rule.field} is required`);
      continue;
    }

    // Skip optional fields with missing values
    if (!rule.required && value === undefined) {
      continue;
    }

    // Check type
    if (value !== undefined) {
      const typeMatch =
        rule.type === "string"
          ? typeof value === "string"
          : rule.type === "number"
          ? typeof value === "number" && !isNaN(value)
          : rule.type === "boolean"
          ? typeof value === "boolean"
          : rule.type === "array"
          ? Array.isArray(value)
          : true;

      if (!typeMatch) {
        errors.push(`${rule.field} must be of type ${rule.type}`);
        continue;
      }
    }

    // Check string constraints
    if (typeof value === "string") {
      if (rule.minLength && value.length < rule.minLength) {
        errors.push(`${rule.field} must be at least ${rule.minLength} characters`);
      }
      if (rule.maxLength && value.length > rule.maxLength) {
        errors.push(`${rule.field} must not exceed ${rule.maxLength} characters`);
      }
      if (rule.pattern && !rule.pattern.test(value)) {
        errors.push(`${rule.field} format is invalid`);
      }
      if (rule.enum && !rule.enum.includes(value)) {
        errors.push(`${rule.field} must be one of: ${rule.enum.join(", ")}`);
      }
    }

    data[rule.field] = value;
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true, data };
}

// ---------- Health Check Rate Limiter ----------

const HEALTH_CHECK_LIMITS = new Map<string, { count: number; resetTime: number }>();
const HEALTH_CHECK_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const HEALTH_CHECK_MAX = 100; // requests per 5 minutes

export function checkHealthCheckRateLimit(request: NextRequest): NextResponse | null {
  const ip = request.ip ?? request.headers.get("x-forwarded-for") ?? "unknown";
  const now = Date.now();
  const record = HEALTH_CHECK_LIMITS.get(ip);

  if (!record || now > record.resetTime) {
    HEALTH_CHECK_LIMITS.set(ip, { count: 1, resetTime: now + HEALTH_CHECK_WINDOW_MS });
    return null;
  }

  if (record.count >= HEALTH_CHECK_MAX) {
    return new NextResponse(
      JSON.stringify({ error: "Too many health checks" }),
      {
        status: 429,
        headers: { "Content-Type": "application/json", "Retry-After": "300" },
      }
    );
  }

  record.count++;
  return null;
}

// ---------- Environment Variable Validation ----------

export function validateRequiredEnvVars(vars: string[]): string[] {
  return vars.filter((varName) => !process.env[varName]);
}

// ---------- Security Headers ----------

export function securityHeaders() {
  return {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
}