import { getPool } from "@/db/client";
import { decrypt } from "./encryption";
import { generateAgentPackage } from "./agent-packager";

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
  packagedFiles?: Record<string, string>;
  error?: string;
}

interface DeployOptions {
  userId: string;
  githubUrl: string;
  projectName: string;
}

// ---------- GitHub helpers ----------

interface RepoInfo {
  owner: string;
  repo: string;
  fullName: string;
  defaultBranch: string;
}

export function parseGitHubUrl(githubUrl: string): RepoInfo | null {
  const m = githubUrl.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?(?:\/tree\/.+)?$/,
  );
  if (!m) return null;
  const [, owner, repo] = m;
  return { owner, repo, fullName: `${owner}/${repo}`, defaultBranch: "main" };
}

export async function validateGitHubRepo(
  githubUrl: string,
): Promise<{ repo: RepoInfo; hasAgentStructure: boolean }> {
  const repo = parseGitHubUrl(githubUrl);
  if (!repo) {
    throw new Error(
      "Invalid GitHub URL. Expected: https://github.com/owner/repo",
    );
  }

  // Check the repo exists and is accessible
  const resp = await fetch(
    `https://api.github.com/repos/${repo.fullName}`,
  );
  if (!resp.ok) {
    if (resp.status === 404) {
      throw new Error(
        `Repo not found: ${repo.fullName}. Check the URL and make sure the repo is public.`,
      );
    }
    throw new Error(
      `GitHub API returned ${resp.status} for ${repo.fullName}`,
    );
  }
  const data = (await resp.json()) as { default_branch?: string };
  if (data.default_branch) repo.defaultBranch = data.default_branch;

  // Check for minimal project structure via GitHub Contents API:
  // we expect at least a package.json or vercel.json at the root
  const contentsResp = await fetch(
    `https://api.github.com/repos/${repo.fullName}/contents/`,
  );
  let hasAgentStructure = false;
  if (contentsResp.ok) {
    const files = (await contentsResp.json()) as { name?: string }[];
    if (Array.isArray(files)) {
      const names = files.map((f) => f.name).filter(Boolean) as string[];
      hasAgentStructure =
        names.includes("package.json") ||
        names.includes("vercel.json") ||
        names.includes("pyproject.toml") ||
        names.includes("requirements.txt") ||
        names.includes("next.config.ts") ||
        names.includes("next.config.js");
    }
  }

  return { repo, hasAgentStructure };
}

// ---------- Framework detection ----------

export async function detectFramework(
  repo: RepoInfo,
): Promise<"nextjs" | "astro" | "nuxt" | "python" | "unknown"> {
  try {
    const contentsResp = await fetch(
      `https://api.github.com/repos/${repo.fullName}/contents/`,
    );
    if (!contentsResp.ok) return "unknown";

    const files = (await contentsResp.json()) as { name?: string }[];
    if (!Array.isArray(files)) return "unknown";

    const names = files.map((f) => f.name).filter(Boolean) as string[];

    if (names.includes("next.config.ts") || names.includes("next.config.js")) {
      return "nextjs";
    }
    if (names.includes("astro.config.ts") || names.includes("astro.config.mjs")) {
      return "astro";
    }
    if (names.includes("nuxt.config.ts") || names.includes("nuxt.config.js")) {
      return "nuxt";
    }
    if (names.includes("pyproject.toml") || names.includes("requirements.txt") || names.includes("setup.py")) {
      return "python";
    }
    if (names.includes("package.json")) {
      return "nextjs";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

// ---------- Vercel deployment ----------

async function createDeployment(
  accessToken: string,
  teamId: string | undefined,
  projectName: string,
  source: { type: "github"; repo: string },
  framework: string,
): Promise<{ deploymentId: string; url: string }> {
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";

  const body = {
    name: projectName,
    gitSource: source,
    projectSettings: framework !== "unknown" ? { framework } : undefined,
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

async function pollDeploymentStatus(
  accessToken: string,
  deploymentId: string,
  teamId: string | undefined,
  timeoutMs: number = 120_000,
): Promise<"READY" | "ERROR" | "BUILDING" | "INITIALIZING"> {
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
  const start = Date.now();
  const pollInterval = 5_000;

  while (Date.now() - start < timeoutMs) {
    const resp = await fetch(
      `https://api.vercel.com/v6/deployments/${deploymentId}${qs}`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (resp.ok) {
      const data = (await resp.json()) as { state: string };
      if (data.state === "READY") return "READY";
      if (data.state === "ERROR" || data.state === "CANCELED") return "ERROR";
      if (data.state === "BUILDING" || data.state === "INITIALIZING") {
        await new Promise((r) => setTimeout(r, pollInterval));
        continue;
      }
    }

    await new Promise((r) => setTimeout(r, pollInterval));
  }

  return "BUILDING"; // timed out — still building
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

    // 2. Validate the GitHub repo exists and has minimum structure
    let repoInfo: Awaited<ReturnType<typeof validateGitHubRepo>>;
    try {
      repoInfo = await validateGitHubRepo(githubUrl);
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }

    const { repo, hasAgentStructure } = repoInfo;
    if (!hasAgentStructure) {
      return {
        success: false,
        error:
          `Repo "${repo.fullName}" does not appear to be a deployable project. Expected package.json, vercel.json, or similar at the root.`,
      };
    }

    // 2b. Detect the framework from repo contents
    const framework = await detectFramework(repo);

    // 3. Deploy to Vercel via gitSource
    const { deploymentId, url } = await createDeployment(
      token,
      teamId,
      projectName,
      { type: "github", repo: repo.fullName },
      framework,
    );

    // 3b. Poll for deployment completion
    const status = await pollDeploymentStatus(token, deploymentId, teamId);

    if (status === "ERROR") {
      return { success: false, error: `Deployment ${deploymentId} failed during build.` };
    }

    if (status !== "READY") {
      // Still building after timeout — return success with a warning.
      // The URL may be provisional but will resolve once Vercel finishes.
      return { success: true, deploymentId, url };
    }

    // 4. Package agent with Vercel config
    const packaging = generateAgentPackage({
      name: projectName,
      framework: framework as any,
    });

    const packagedFiles = packaging.success ? packaging.files : undefined;

    // 5. Record in DB
    await recordDeployment(
      projectName,
      projectName,
      githubUrl,
      deploymentId,
      url,
    );

    return { success: true, deploymentId, url, packagedFiles };
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Deploy failed: ${errorMessage}` };
  }
}
