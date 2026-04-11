# Code Reviewer — Agent Contract

Analyzes PR URLs and provides structured reviews with severity ratings.

## Required Endpoints

Every agent in the AgentHub marketplace implements the standard agent contract:

```
GET  /api/health  → { status: "ok", agent: "code-reviewer", version: "1.0.0" }
POST /api/run     → { input: ..., output: ... }
POST /api/demo    → { result: ..., demo_config: ... }
```

## Environment Variables

See `.env.example` for required variables.