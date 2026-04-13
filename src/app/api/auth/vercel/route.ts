import { NextRequest, NextResponse } from "next/server";
import { verifyVercelAuthToken } from "@/lib/auth-utils";
import { withCORS, sanitizeError } from "@/lib/security-middleware";

/**
 * POST /api/auth/vercel
 *
 * Exchange Vercel OAuth token for session token.
 * Uses Vercel-provided session tokens for secure agent hub access.
 */
export async function POST(request: NextRequest) {
  try {
    // Apply CORS
    const corsResponse = withCORS(request);
    if (corsResponse) return corsResponse;

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: "Vercel token is required" },
        { status: 400 }
      );
    }

    // Verify and validate token
    const validationResult = await verifyVercelAuthToken(token);

    if (!validationResult.valid) {
      return NextResponse.json(
        {
          error: validationResult.error || "Invalid Vercel token"
        },
        { status: 401 }
      );
    }

    // Return session token and user info
    return NextResponse.json({
      success: true,
      sessionToken: validationResult.sessionToken,
      userId: validationResult.userId,
      vercelTeamId: validationResult.vercelTeamId,
    });
  } catch (error) {
    console.error("POST /api/auth/vercel error:", error);
    return NextResponse.json(
      { error: sanitizeError(error).message },
      { status: 500 }
    );
  }
}