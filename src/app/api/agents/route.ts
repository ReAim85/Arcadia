import type { NextRequest } from "next/server";
import { getPool } from "@/db/client";
import { NextResponse } from "next/server";
import { withCORS, validateRequest, sanitizeError } from "@/lib/security-middleware";

interface CreateAgentRequest {
  slug: string;
  name: string;
  description: string;
  category: string;
  github_url?: string;
  vercel_project_id?: string;
  vercel_url?: string;
  owner_id?: string;
  badge?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Apply CORS
    const corsResponse = withCORS(request);
    if (corsResponse) return corsResponse;

    const searchParams = await request.nextUrl.searchParams;
    const category = searchParams.get("category");
    const search = searchParams.get("search");
    const sort = searchParams.get("sort") || "created_at";

    let text = `
      SELECT
        a.id, a.slug, a.name, a.description, a.category,
        a.github_url, a.vercel_url, a.badge, a.status, a.created_at,
        COUNT(DISTINCT d.id) AS deploy_count
      FROM agents a
      LEFT JOIN deployments d ON d.agent_id = a.id AND d.status = 'live'
      WHERE 1=1
    `;
    const values: unknown[] = [];

    if (category) {
      const idx = values.length + 1;
      text += ` AND a.category = $${idx}`;
      values.push(category);
    }
    if (search) {
      const idx = values.length + 1;
      text += ` AND (a.name ILIKE $${idx} OR a.description ILIKE $${idx})`;
      values.push(`%${search}%`);
    }
    text += ` GROUP BY a.id ORDER BY a.${sort === "created_at" ? "created_at" : "name"} DESC`;

    const pool = getPool();
    const result = await pool.query(text, values);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("GET /api/agents error:", error);
    return NextResponse.json(
      { error: sanitizeError(error).message },
      { status: 500 }
    );
  }
}

// POST /api/agents - register a new agent (internal use by deploy pipeline)
// Note: This endpoint is for internal use only and requires authentication
export async function POST(request: NextRequest) {
  try {
    // Apply CORS
    const corsResponse = withCORS(request);
    if (corsResponse) return corsResponse;

    // Validate request body
    const rules = [
      { field: "slug", type: "string", required: true, minLength: 3, maxLength: 100 },
      { field: "name", type: "string", required: true, minLength: 1, maxLength: 200 },
      { field: "description", type: "string", required: true, minLength: 1, maxLength: 1000 },
      { field: "category", type: "string", required: true },
      { field: "github_url", type: "string", maxLength: 2000 },
      { field: "vercel_project_id", type: "string", maxLength: 100 },
      { field: "vercel_url", type: "string", maxLength: 2000 },
      { field: "owner_id", type: "string" },
      { field: "badge", type: "string" },
    ];

    const validation = validateRequest(await request.json(), rules);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.errors.join(", ") },
        { status: 400 }
      );
    }

    const data = validation.data as CreateAgentRequest;

    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO agents (slug, name, description, category, github_url, vercel_project_id, vercel_url, owner_id, badge)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [data.slug, data.name, data.description, data.category, data.github_url || null, data.vercel_project_id || null, data.vercel_url || null, data.owner_id || null, data.badge || null]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    console.error("POST /api/agents error:", error);

    // Handle duplicate slug
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "23505"
    ) {
      return NextResponse.json(
        { error: "Agent with this slug already exists" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: sanitizeError(error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const category = searchParams.get("category");
  const search = searchParams.get("search");
  const sort = searchParams.get("sort") || "created_at";

  let text = `
    SELECT
      a.id, a.slug, a.name, a.description, a.category,
      a.github_url, a.vercel_url, a.badge, a.status, a.created_at,
      COUNT(DISTINCT d.id) AS deploy_count
    FROM agents a
    LEFT JOIN deployments d ON d.agent_id = a.id AND d.status = 'live'
    WHERE 1=1
  `;
  const values: unknown[] = [];

  if (category) {
    const idx = values.length + 1;
    text += ` AND a.category = $${idx}`;
    values.push(category);
  }
  if (search) {
    const idx = values.length + 1;
    text += ` AND (a.name ILIKE $${idx} OR a.description ILIKE $${idx})`;
    values.push(`%${search}%`);
  }
  text += ` GROUP BY a.id ORDER BY a.${sort === "created_at" ? "created_at" : "name"} DESC`;

  try {
    const pool = getPool();
    const result = await pool.query(text, values);
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("GET /api/agents error:", error);
    return NextResponse.json(
      { error: "Failed to fetch agents" },
      { status: 500 }
    );
  }
}

// POST /api/agents - register a new agent (internal use by deploy pipeline)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      slug,
      name,
      description,
      category,
      github_url,
      vercel_project_id,
      vercel_url,
      owner_id,
      badge,
    } = body;

    if (!slug || !name || !description || !category) {
      return NextResponse.json(
        { error: "slug, name, description, and category are required" },
        { status: 400 }
      );
    }

    const pool = getPool();
    const result = await pool.query(
      `INSERT INTO agents (slug, name, description, category, github_url, vercel_project_id, vercel_url, owner_id, badge)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [slug, name, description, category, github_url || null, vercel_project_id || null, vercel_url || null, owner_id || null, badge || null]
    );

    const agent = result.rows;

    return NextResponse.json(agent[0], { status: 201 });
  } catch (error) {
    // Handle duplicate slug
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "23505"
    ) {
      return NextResponse.json(
        { error: "Agent with this slug already exists" },
        { status: 409 }
      );
    }
    console.error("POST /api/agents error:", error);
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}
