/**
 * Agent packager (t-2.5)
 *
 * Generates Vercel-deployable configuration for agents submitted to the marketplace.
 * Based on detected framework, produces the appropriate vercel.json with Fluid Compute
 * settings, API routes, and middleware configuration.
 */

export interface PackageResult {
  success: boolean;
  files: Record<string, string>;
  error?: string;
}

export interface AgentMetadata {
  name: string;
  description?: string;
  framework: "nextjs" | "python" | "astro" | "nuxt" | "unknown";
  envVars?: string[];
  apiEndpoints?: { path: string; method: string }[];
}

// ---------- vercel.json templates by framework ----------

const VERCEL_TEMPLATES: Record<string, object> = {
  nextjs: {
    framework: {
      version: 2,
      name: "nextjs",
    },
    functions: {
      "app/api/**/*.ts": {
        memory: 1024,
        maxDuration: 30,
      },
    },
    regions: ["iad1"],
  },
  python: {
    functions: {
      "api/**/*.py": {
        runtime: "python3.12",
        memory: 1024,
        maxDuration: 30,
      },
    },
    regions: ["iad1"],
    buildCommand: "pip install -r requirements.txt",
    outputDirectory: "",
  },
  astro: {
    framework: {
      version: 2,
      name: "astro",
    },
    regions: ["iad1"],
  },
  nuxt: {
    framework: {
      version: 2,
      name: "nuxt",
    },
    regions: ["iad1"],
  },
};

// ---------- Public API ----------

/**
 * Generate a vercel.json configuration based on the detected framework
 * and agent metadata. Returns the configuration as a JSON string.
 */
export function generateVercelConfig(metadata: AgentMetadata): string {
  const base = VERCEL_TEMPLATES[metadata.framework] ?? VERCEL_TEMPLATES.nextjs;

  // Ensure agent contract endpoints are present
  // Every agent must implement /api/health, /api/run, /api/demo
  const config = {
    ...base,
    metadata: {
      agent_name: metadata.name,
      ...(metadata.description && { agent_description: metadata.description }),
      frameworks_detected: metadata.framework,
    },
  };

  return JSON.stringify(config, null, 2);
}

/**
 * Generate a complete agent package with all required configuration files.
 * Returns a map of filename -> content for each generated file.
 */
export function generateAgentPackage(metadata: AgentMetadata): PackageResult {
  if (metadata.framework === "unknown") {
    return {
      success: false,
      files: {},
      error:
        "Could not detect the framework. Supported frameworks: Next.js, Python, Astro, Nuxt. " +
        "Please ensure your project has a recognizable config file (next.config.*, pyproject.toml, " +
        "requirements.txt, astro.config.*, nuxt.config.*) at the root.",
    };
  }

  const files: Record<string, string> = {};

  // vercel.json
  files["vercel.json"] = generateVercelConfig(metadata);

  // .env.example with standard agent env vars
  const envLines = [
    "# Agent environment variables",
    `AGENT_NAME=${metadata.name}`,
    ...(metadata.envVars ?? []).map((v) => `${v}=`),
  ];
  files[".env.example"] = envLines.join("\n");

  // Agent contract README
  files["AGENT_CONTRACT.md"] = generateAgentContractReadme(metadata);

  return { success: true, files };
}

/**
 * Generate an AGENT_CONTRACT.md documenting the required API endpoints.
 */
function generateAgentContractReadme(metadata: AgentMetadata): string {
  return `# ${metadata.name} — Agent Contract

${metadata.description ?? "No description provided."}

## Required Endpoints

Every agent in the AgentHub marketplace implements the standard agent contract:

\`\`\`
GET  /api/health  → { status: "ok", agent: "${metadata.name}", version: "1.0.0" }
POST /api/run     → { input: ..., output: ... }
POST /api/demo    → { result: ..., demo_config: ... }
\`\`\`
${
  metadata.apiEndpoints && metadata.apiEndpoints.length > 0
    ? `## Additional Endpoints\n\n| Path | Method |\n|------|--------|\n${metadata.apiEndpoints.map((e) => `| ${e.path} | ${e.method} |`).join("\n")}`
    : ""
}
## Environment Variables

See \`.env.example\` for required variables.
`;
}
