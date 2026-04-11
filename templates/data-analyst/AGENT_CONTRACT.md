# Data Analyst — Agent Contract

Converts natural language to SQL queries and provides insights.

## Required Endpoints

Every agent in the AgentHub marketplace implements the standard agent contract:

```
GET  /api/health  → { status: "ok", agent: "data-analyst", version: "1.0.0" }
POST /api/run     → { input: ..., output: ... }
POST /api/demo    → { result: ..., demo_config: ... }
```

## Environment Variables

See `.env.example` for required variables.