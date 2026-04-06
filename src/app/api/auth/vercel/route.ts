import { NextResponse } from "next/server";
import { getPool } from "@/db/client";
import { encrypt } from "@/lib/encryption";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, teamId } = body;

    if (!token) {
      return NextResponse.json(
        { error: "token is required" },
        { status: 400 }
      );
    }

    // Validate token by calling Vercel API
    const vercelRes = await fetch("https://api.vercel.com/v2/user", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!vercelRes.ok) {
      return NextResponse.json(
        { error: "Invalid Vercel token" },
        { status: 401 }
      );
    }

    const vercelUser = await vercelRes.json();
    const vercelId = vercelUser?.id as string | undefined;
    const username = vercelUser?.username as string | undefined;

    if (!vercelId) {
      return NextResponse.json(
        { error: "Could not identify Vercel user" },
        { status: 502 }
      );
    }

    // Encrypt the Vercel token and upsert the user record
    const pool = getPool();
    const encrypted = encrypt(token);
    const result = await pool.query(
      `INSERT INTO users (vercel_team_id, vercel_token_encrypted, vercel_id, username)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (vercel_id) DO UPDATE
         SET vercel_token_encrypted = $2, vercel_team_id = $1, username = $4
       RETURNING id`,
      [teamId || null, encrypted, vercelId, username || null]
    );

    return NextResponse.json({
      success: true,
      userId: result.rows[0].id,
      vercelId,
      username,
    });
  } catch (error) {
    console.error("POST /api/auth/vercel error:", error);
    return NextResponse.json(
      { error: "Failed to authenticate Vercel account" },
      { status: 500 }
    );
  }
}
