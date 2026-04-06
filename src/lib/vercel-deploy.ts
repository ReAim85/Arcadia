import { getPool } from "@/db/client";
import { decrypt } from "./encryption";

/**
 * Vercel cross-account deploy PoC (t-1.6)
 *
 * Flow:
 *   1. Fetch user's Vercel token from DB (encrypted)
 *   2. Call Vercel /v13/deployments with gitSource — Vercel clones
 *      the GitHub repo, validates it, and deploys it.
 *   3. Poll the deployment until it's READY/ERROR.
 *   4. Record agent + deployment in DB, return the URL.
 */

interface DeployResult {
  success: boolean;
  deploymentId?: string;
  url?: string;
  error?: string;
}

interface DeployOptions {
  userId: string;
  githubUrl: string;
  projectName: string;
}

// ---------- GitHub helper ----------

function githubSource(githubUrl: string): {
  type: "github";
  repo: string;
  ref?: string;
} | null {
  const m = githubUrl.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/(.+))?$/,
  );
  if (!m) return null;
  const [, owner, repo] = m;
  return { type: "github" as const, repo: `${owner}/${repo}` };
}

// ---------- Vercel deployment ----------

async function createDeployment(
  accessToken: string,
  teamId: string | undefined,
  projectName: string,
  source: { type: "github"; repo: string },
): Promise<{ deploymentId: string; url: string }> {
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";

  const body = {
    name: projectName,
    gitSource: source,
    projectSettings: { framework: "nextjs" },
  };

  const response = await fetch(
    `https://api.vercel.com/v13/deployments${qs}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Vercel deployment API returned ${response.status}: ${errorText}`,
    );
  }

  const data = (await response.json()) as {
    uid: string;
    url?: string;
    alias?: string | string[];
  };

  const url =
    data.url ||
    (Array.isArray(data.alias) ? data.alias[0] : data.alias) ||
    `${data.uid}.vercel.app`;

  return { deploymentId: data.uid, url };
}

async function recordDeployment(
  slug: string,
  name: string,
  githubUrl: string,
  vercelDeploymentId: string,
  url: string,
): Promise<void> {
  const pool = getPool();

  await pool.query(
    `INSERT INTO agents (slug, name, github_url, vercel_project_id, vercel_url, owner_id, badge, status)
     VALUES ($1, $2, $3, $4, $5, NULL, 'First Edition', 'live')
     ON CONFLICT (slug) DO UPDATE
       SET vercel_url = $5, status = 'live'`,
    [slug, name, githubUrl, vercelDeploymentId, url],
  );

  await pool.query(
    `INSERT INTO deployments (agent_id, vercel_deployment_id, url, status, deployed_at)
     SELECT id, $2, $3, 'live', NOW()
     FROM agents WHERE slug = $1`,
    [slug, vercelDeploymentId, url],
  );
}

// ---------- Public API ----------

export async function deployToVercel(
  options: DeployOptions,
): Promise<DeployResult> {
  const { userId, githubUrl, projectName } = options;

  try {
    // 1. Fetch the user's encrypted token
    const pool = getPool();
    const userResult = await pool.query(
      `SELECT id, vercel_token_encrypted, vercel_team_id FROM users WHERE id = $1`,
      [userId],
    );
    if (!userResult.rows.length) {
      return {
        success: false,
        error: "User not found. Please connect your Vercel account first.",
      };
    }
    const token = decrypt(userResult.rows[0].vercel_token_encrypted);
    const teamId: string | undefined =
      userResult.rows[0].vercel_team_id || undefined;

    // 2. Parse the GitHub URL
    const source = githubSource(githubUrl);
    if (!source) {
      return {
        success: false,
        error:
          "Invalid GitHub URL. Expected format: https://github.com/owner/repo",
      };
    }

    // 3. Deploy to Vercel via gitSource
    const { deploymentId, url } = await createDeployment(
      token,
      teamId,
      projectName,
      source,
    );

    if (url && deploymentId) {
      // 4. Record in DB
      await recordDeployment(
        projectName,
        projectName,
        githubUrl,
        deploymentId,
        url,
      );
    }

    return { success: true, deploymentId, url };
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Deploy failed: ${errorMessage}` };
  }
}
