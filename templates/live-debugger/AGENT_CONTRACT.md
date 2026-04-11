# Live Debugger — Agent Contract

Captures errors, uses LLM to suggest fixes, and creates GitHub PRs.

## Required Endpoints

Every agent in the AgentHub marketplace implements the standard agent contract:

```
GET  /api/health  → { status: "ok", agent: "live-debugger", version: "1.0.0" }
POST /api/run     → { input: ..., output: ... }
POST /api/demo    → { result: ..., demo_config: ... }
```

## Environment Variables

See `.env.example` for required variables.