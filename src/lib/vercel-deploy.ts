import { getPool } from "@/db/client";
import { decrypt } from "./encryption";

/**
 * Vercel cross-account deploy PoC (t-1.6)
 *
 * Flow:
 *   1. Fetch user's Vercel token from DB (encrypted)
 *   2. Clone GitHub repo via the archive endpoint (no shell required)
 *   3. Create a Vercel deployment via the Vercel REST API
 *   4. Poll for the deployment URL and return it
 */

interface DeployResult {
  success: boolean;
  deploymentId?: string;
  url?: string;
  error?: string;
}

// ---------- GitHub helpers ----------

function archiveUrl(githubUrl: string): string | null {
  // Accept "https://github.com/owner/repo" or "https://github.com/owner/repo/tree/main"
  const m = githubUrl.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)/);
  if (!m) return null;
  const [, owner, repo] = m;
  // Strip .git suffix if present
  const cleanRepo = repo.replace(/\.git$/, "");
  // Default to main branch
  return `https://github.com/${owner}/${cleanRepo}/archive/refs/heads/main.zip`;
}

async function fetchRepoFiles(githubUrl: string): Promise<Record<string, string>> {
  const url = archiveUrl(githubUrl);
  if (!url) throw new Error(`Invalid GitHub URL: ${githubUrl}`);

  const resp = await fetch(url, { redirect: "follow" });
  if (!resp.ok) {
    throw new Error(
      `Failed to fetch repo archive (HTTP ${resp.status}). Check the repo exists and is public.`,
    );
  }

  const zipBuffer = Buffer.from(await resp.arrayBuffer());

  // Minimal Zip parsing — we only need the text files for Vercel deploy.
  // For the PoC we'll use a lightweight unzip via the built-in DecompressionStream.
  const unzipped = await unzipBuffer(zipBuffer);
  return unzipped;
}

async function unzipBuffer(buf: Buffer): Promise<Record<string, string>> {
  const ds = new DecompressionStream("gzip");
  // zip is not gzip — use a small JS unzip instead.
  // Since DecompressionStream won't work, we implement a minimal ZIP reader.
  return unzipMinimal(buf);
}

// ---------- minimal ZIP reader (synchronous, local-file entries only) ----------
function unzipMinimal(buf: Buffer): Record<string, string> {
  const files: Record<string, string> = {};

  // Find End of Central Directory
  let eocdOffset = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocdOffset = i;
      break;
    }
  }
  if (eocdOffset === -1) throw new Error("No EOCD found — not a valid ZIP file");

  const cdOffset = buf.readUInt32LE(eocdOffset + 16);
  const cdEntries = buf.readUInt16LE(eocdOffset + 10);

  let offset = cdOffset;
  for (let i = 0; i < cdEntries; i++) {
    if (buf.readUInt32LE(offset) !== 0x02014b50) break;

    const compMethod = buf.readUInt16LE(offset + 10);
    const compSize = buf.readUInt32LE(offset + 20);
    const nameLen = buf.readUInt16LE(offset + 28);
    const extraLen = buf.readUInt16LE(offset + 30);
    const commentLen = buf.readUInt16LE(offset + 32);
    const localHeaderOffset = buf.readUInt32LE(offset + 42);
    const name = buf.subarray(offset + 46, offset + 46 + nameLen).toString("utf8");

    // Read from local file header for accurate offset
    const localNameLen = buf.readUInt16LE(localHeaderOffset + 26);
    const localExtraLen = buf.readUInt16LE(localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localNameLen + localExtraLen;

    const raw = buf.subarray(dataOffset, dataOffset + compSize);

    if (!name.endsWith("/")) {
      // Only store files (skip directories)
      let content: Buffer;
      if (compMethod === 0) {
        // Stored (no compression)
        content = raw;
      } else if (compMethod === 8) {
        // Deflate — use DecompressionStream (raw deflate)
        // raw inflate with gzip header trick
        content = inflateRawSync(raw);
      } else {
        content = raw;
      }

      // Strip the top-level directory (e.g. "repo-main/") that GitHub adds
      const strippedName = name.replace(/^[^/]+\//, "");
      if (strippedName) {
        files[strippedName] = content.toString("utf8");
      }
    }

    offset += 46 + nameLen + extraLen + commentLen;
  }

  return files;
}

function inflateRawSync(raw: Buffer): Buffer {
  // We use the zlib module via dynamic import because top-level `require`
  // is not available, but in Next.js Edge runtime we need to import explicitly.
  const zlib = require("zlib");
  return zlib.inflateRawSync(raw);
}

// ---------- Vercel API helpers ----------

interface VercelTeam {
  id: string;
}

async function getUserTeam(
  accessToken: string,
): Promise<{ ownerId: string; teamId: string | undefined }> {
  // Determine if the user has teams; if so use the first one.
  const teamsRes = await fetch("https://api.vercel.com/v2/teams", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  let teamId: string | undefined;
  if (teamsRes.ok) {
    const teams = (await teamsRes.json())?.teams as VercelTeam[] | undefined;
    if (teams && teams.length > 0) teamId = teams[0].id;
  }

  // Get user info for the owner ID fallback
  const userRes = await fetch("https://api.vercel.com/v2/user", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) throw new Error(`Failed to identify Vercel user (HTTP ${userRes.status})`);
  const user = (await userRes.json()) as { id: string };
  return { ownerId: user.id, teamId };
}

// ---------- Deploy via Vercel /v13/deployments (blob upload, no SDK needed) ----------

interface DeployOptions {
  userId: string;
  githubUrl: string;
  projectSlug: string;
  projectName: string;
}

export async function deployToVercel(options: DeployOptions): Promise<DeployResult> {
  const { userId, githubUrl, projectSlug, projectName } = options;

  try {
    // 1. Fetch the user's encrypted token
    const pool = getPool();
    const userResult = await pool.query(
      `SELECT id, vercel_token_encrypted, vercel_team_id FROM users WHERE id = $1`,
      [userId],
    );
    if (!userResult.rows.length) {
      return { success: false, error: "User not found. Please connect your Vercel account first." };
    }
    const token = decrypt(userResult.rows[0].vercel_token_encrypted);
    const teamId: string | undefined = userResult.rows[0].vercel_team_id || undefined;

    // 2. Fetch and unzip GitHub repo files
    let files: Record<string, string>;
    try {
      files = await fetchRepoFiles(githubUrl);
    } catch (e: unknown) {
      return { success: false, error: (e as Error).message };
    }

    const fileCount = Object.keys(files).length;
    if (fileCount === 0) {
      return { success: false, error: "Repo appears empty — are files on the `main` branch?" };
    }

    // 3. Ensure the project exists (or reuse existing one)
    const { deploymentId, url } = await createDeployment(
      token,
      teamId,
      projectSlug,
      projectName,
      files,
    );

    if (url && deploymentId) {
      // 4. Record agent + deployment in the DB
      await recordDeployment(
        projectSlug,
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

async function createDeployment(
  accessToken: string,
  teamId: string | undefined,
  name: string,
  projectLabel: string,
  files: Record<string, string>,
): Promise<{ deploymentId: string; url: string | undefined }> {
  const queryParams: Record<string, string> = {
    name,
    projectSettings: JSON.stringify({ framework: "nextjs" }),
    // `project` query param creates the project if it doesn't exist
  };
  if (teamId) queryParams.teamId = teamId;
  const qs = new URLSearchParams(queryParams).toString();

  // Build multipart form-data body for /v13/deployments
  const boundary = `--------vercel-deploy-${Date.now()}`;
  const parts: Buffer[] = [];

  // Required `files` field — array of { file: name, data: content }
  const fileArray = Object.entries(files).map(([, content], idx) => {
    return `{"file":"${idx}","data":"${Buffer.from(content).toString("base64")}","encoding":"base64"}`;
  });

  const meta = {
    name: projectLabel,
    files: fileArray.map((f) => JSON.parse(f)),
    projectSettings: { framework: "nextjs" },
  };

  // Use JSON body approach — simpler and well-supported by the Vercel API
  // The /v13/deployments endpoint accepts JSON with a `files` array.
  const body = {
    name: projectLabel,
    files: Object.entries(files).map(([fileName, content]) => ({
      file: fileName,
      data: Buffer.from(content).toString("base64"),
      encoding: "base64",
    })),
    projectSettings: { framework: "nextjs" },
  };

  const response = await fetch(`https://api.vercel.com/v13/deployments?${qs}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vercel deployment API returned ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as {
    uid: string;
    url?: string;
    alias?: string | string[];
    readyState?: string;
  };

  // The URL may be in `alias` or `url` — Vercel returns both in different versions
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

  // Upsert the agent record
  await pool.query(
    `INSERT INTO agents (slug, name, github_url, vercel_project_id, vercel_url, owner_id, badge, status)
     VALUES ($1, $2, $3, $4, $5, NULL, 'First Edition', 'live')
     ON CONFLICT (slug) DO UPDATE
       SET vercel_url = $5, status = 'live'`,
    [slug, name, githubUrl, vercelDeploymentId, url],
  );

  // Record the deployment
  await pool.query(
    `INSERT INTO deployments (agent_id, vercel_deployment_id, url, status, deployed_at)
     SELECT id, $2, $3, 'live', NOW()
     FROM agents WHERE slug = $1`,
    [slug, vercelDeploymentId, url],
  );
}
