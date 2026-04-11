import { getPool } from "@/db/client";
import { decrypt } from "./encryption";
import { generateAgentPackage } from "./agent-packager";
import { assignEditorialBadge } from "./badge-service";

/**
 * Vercel cross-account deploy (t-1.6, t-2.6)
 *
 * Flow:
 *   1. Fetch user's Vercel token from DB (encrypted)
 *   2. Create a Vercel project in the user's account via /v9/projects
 *   3. Deploy to the project via gitSource — Vercel clones the GitHub repo
 *   4. Poll the deployment until it's READY/ERROR.
 *   5. Record agent + deployment in DB, return the URL.
 */

interface DeployResult {
  success: boolean;
  deploymentId?: string;
  url?: string;
  projectId?: string;
  packagedFiles?: Record<string, string>;
  error?: string;
}

interface EnvVar {
  key: string;
  value: string;
  target?: ("production" | "preview" | "development")[];
  type?: "plain" | "secret";
}

interface DeployOptions {
  userId: string;
  githubUrl: string;
  projectName: string;
  envVars?: EnvVar[];
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

// ---------- Vercel project creation (t-2.6) ----------

interface ProjectResult {
  projectId: string;
  name: string;
}

/**
 * Create a Vercel project in the user's account.
 * Uses POST /v9/projects with git source configuration.
 */
export async function createVercelProject(
  accessToken: string,
  projectName: string,
  teamId: string | undefined,
  options?: {
    framework?: string;
    repoFullName?: string;
  },
): Promise<ProjectResult> {
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";

  const body: Record<string, unknown> = {
    name: projectName,
  };

  if (options?.framework) {
    body.framework = options.framework;
  }

  if (options?.repoFullName) {
    body.gitRepository = {
      type: "github",
      repo: options.repoFullName,
    };
  }

  const response = await fetch(
    `https://api.vercel.com/v9/projects${qs}`,
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
    if (response.status === 409) {
      // Project already exists — try to find it by name
      return await findExistingProject(accessToken, projectName, teamId, qs);
    }
    throw new Error(
      `Vercel project creation returned ${response.status}: ${errorText}`,
    );
  }

  const data = (await response.json()) as { id: string; name: string };
  return { projectId: data.id, name: data.name };
}

/**
 * Find an existing project by name when creation fails with 409 conflict.
 */
async function findExistingProject(
  accessToken: string,
  projectName: string,
  teamId: string | undefined,
  qs: string,
): Promise<ProjectResult> {
  // List projects and find by name
  const response = await fetch(
    `https://api.vercel.com/v9/projects${qs}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (response.ok) {
    const data = (await response.json()) as {
      projects: Array<{ id: string; name: string }>;
    };
    const existing = data.projects?.find((p) => p.name === projectName);
    if (existing) {
      return { projectId: existing.id, name: existing.name };
    }
  }

  throw new Error(
    `Project "${projectName}" already exists but could not find it in the project list.`,
  );
}

// ---------- Vercel env var management (t-2.7) ----------

/**
 * Set environment variables on a Vercel project.
 * Uses POST /v9/projects/{projectId}/env for each variable.
 */
export async function setVercelEnvVars(
  accessToken: string,
  projectId: string,
  teamId: string | undefined,
  envVars: EnvVar[],
): Promise<{ set: string[]; skipped: string[] }> {
  const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
  const set: string[] = [];
  const skipped: string[] = [];

  for (const envVar of envVars) {
    const body = {
      key: envVar.key,
      value: envVar.value,
      type: envVar.type ?? ("plain" as const),
      target: envVar.target ?? (["production", "preview", "development"] as const),
    };

    const response = await fetch(
      `https://api.vercel.com/v9/projects/${projectId}/env${qs}`,
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
      await response.text(); // Response body is intentionally unused - we only need to know it's an error
      if (response.status === 409) {
        // Env var already exists — update it via PUT
        const updateResponse = await fetch(
          `https://api.vercel.com/v9/projects/${projectId}/env/${encodeURIComponent(envVar.key)}${qs}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ...body, id: undefined }),
          },
        );

        if (updateResponse.ok) {
          set.push(envVar.key);
        } else {
          skipped.push(`${envVar.key} (update failed: ${updateResponse.status})`);
        }
      } else {
        skipped.push(`${envVar.key} (create failed: ${response.status})`);
      }
    } else {
      set.push(envVar.key);
    }
  }

  return { set, skipped };
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

/**
 * Records agent and deployment via the marketplace API.
 * Uses POST /api/agents for agent registration and direct DB insert for deployment.
 */
async function recordDeploymentViaApi(
  userId: string,
  slug: string,
  name: string,
  githubUrl: string,
  vercelDeploymentId: string,
  vercelProjectId: string,
  url: string,
): Promise<{ agentId: string; deploymentId: string }> {
  // 1. Register agent via API
  const agentResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/agents`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      slug,
      name,
      description: '', // Description will be filled later or can be passed as parameter
      category: 'uncategorized',
      github_url: githubUrl,
      vercel_project_id: vercelProjectId,
      vercel_url: url,
      owner_id: userId, // Use the authenticated user ID
      // Badge will be assigned by the badge service after deployment
      badge: null,
    }),
  });

  if (!agentResponse.ok) {
    throw new Error(`Failed to register agent: ${await agentResponse.text()}`);
  }

  const agentData = await agentResponse.json();
  const agentId = agentData.id;

  // 2. Record deployment directly in DB (no API endpoint for deployments yet)
  const pool = getPool();
  const deploymentResult = await pool.query(
    `INSERT INTO deployments (agent_id, vercel_deployment_id, url, status, deployed_at)
     VALUES ($1, $2, $3, 'live', NOW())
     RETURNING id`,
    [agentId, vercelDeploymentId, url],
  );

  return {
    agentId,
    deploymentId: deploymentResult.rows[0].id,
  };
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

    // 3. Create a Vercel project in the user's account (t-2.6)
    const project = await createVercelProject(token, projectName, teamId, {
      framework: framework !== "unknown" ? framework : undefined,
      repoFullName: repo.fullName,
    });

    // 3b. Set user's env vars on the project (t-2.7)
    if (options.envVars && options.envVars.length > 0) {
      await setVercelEnvVars(token, project.projectId, teamId, options.envVars);
    }

    // 4. Deploy to the project via gitSource
    const { deploymentId, url } = await createDeployment(
      token,
      teamId,
      projectName,
      { type: "github", repo: repo.fullName },
      framework,
    );

    // 4b. Poll for deployment completion
    const status = await pollDeploymentStatus(token, deploymentId, teamId);

    if (status === "ERROR") {
      return { success: false, error: `Deployment ${deploymentId} failed during build.` };
    }

    // 5. Package agent with Vercel config
    const packaging = generateAgentPackage({
      name: projectName,
      framework: framework,
    });

    const packagedFiles = packaging.success ? packaging.files : undefined;

    // 6. Record via API - we don't need the IDs here but the function returns them for consistency
    const agentResult = await recordDeploymentViaApi(
      userId,
      projectName,
      projectName,
      githubUrl,
      deploymentId,
      project.projectId,
      url,
    );

    // Assign First Edition badge to newly deployed agents
    try {
      await assignEditorialBadge(agentResult.agentId, "First Edition");
    } catch (badgeError) {
      console.warn("Failed to assign First Edition badge:", badgeError);
      // Don't fail the deployment if badge assignment fails
    }

    if (status !== "READY") {
      return { success: true, deploymentId, url, projectId: project.projectId, packagedFiles };
    }

    return { success: true, deploymentId, url, projectId: project.projectId, packagedFiles };
  } catch (e: unknown) {
    const errorMessage = e instanceof Error ? e.message : String(e);
    return { success: false, error: `Deploy failed: ${errorMessage}` };
  }
}

