# API Builder — Agent Contract

Converts SQL schema to REST API with authentication and documentation.

## Required Endpoints

Every agent in the AgentHub marketplace implements the standard agent contract:

```
GET  /api/health  → { status: "ok", agent: "api-builder", version: "1.0.0" }
POST /api/run     → { input: ..., output: ... }
POST /api/demo    → { result: ..., demo_config: ... }
```

## Environment Variables

See `.env.example` for required variables.