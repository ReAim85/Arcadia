# AgentHub - Architecture

## System Overview

AgentHub is an AI Agents Marketplace where developers discover, evaluate, and deploy autonomous AI agents. Users submit agent code from GitHub, deploy to their own Vercel account, and the marketplace surfaces them with live demos, metrics, and trust signals.

## 10-Day Timeline (was 24h hackathon)

| Day | Milestone |
|-----|-----------|
| 1-2 | Next.js init, Neon Postgres, Vercel deploy PoC, models |
| 3-4 | Agent submission + Vercel deployment pipeline |
| 5-6 | Marketplace UI (home, detail, live demo, dashboard) |
| 7-8 | Trust signals, health checks, analytics |
| 9-10 | Templates, community, E2E tests, public launch |

## Architecture Diagram

```
                    ┌──────────────────────────────────────────────┐
                    │  User Browser                                 │
                    └──────────────────┬───────────────────────────┘
                                       │
                    ┌──────────────────▼───────────────────────────┐
                    │  Next.js App Router (Vercel)                  │
                    │  ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
                    │  │/         │ │/agents/* │ │/submit      │  │
                    │  │/dashboard│ │/api/*    │ │/health      │  │
                    │  └────┬─────┘ └────┬─────┘ └──────┬──────┘  │
                    └───────┼────────────┼──────────────┼─────────┘
                            │            │              │
                            ▼            ▼              ▼
                    ┌─────────────────────────────────────────┐
                    │  Neon Postgres (Vercel Marketplace)      │
                    │  Agents | Deployments | Users | Metrics  │
                    └─────────────────────────────────────────┘
                            │
                    ┌───────▼──────────────────────────────────┐
                    │  Deployment Service (FastAPI or Vercel Fn)│
                    │  Clone repo → Package → Deploy to Vercel │
                    └───────────────┬──────────────────────────┘
                                    │
              ┌─────────────────────┼────────────────────────┐
              ▼                     ▼                        ▼
     ┌──────────────┐      ┌──────────────┐        ┌──────────────┐
     │ User A's     │      │ User B's     │        │ User C's     │
     │ Vercel Agent │      │ Vercel Agent │        │ Vercel Agent │
     │ (API Builder)│      │ (Debugger)   │        │ (Custom)     │
     └──────────────┘      └──────────────┘        └──────────────┘
              │                     │                        │
              └─────────────────────┼────────────────────────┘
                                    │
                    ┌───────────────▼────────────────────────────┐
                    │  Health Checks + Metrics (6h Vercel Cron)  │
                    └────────────────────────────────────────────┘
```

## Components

### Frontend (Next.js App Router + shadcn/ui)
- **Marketplace Home** - Browse/search agent catalog with filters
- **Agent Detail** - Live demo panel, deploy CTA, metrics, source link
- **Submit Agent** - GitHub repo URL + .env config + metadata form
- **Dashboard** - User's deployed agents, status, manage, analytics

### Backend (Neon Postgres + API Routes or FastAPI)
- Neon Postgres via Vercel Marketplace — serverless, scales to zero
- SQLAlchemy ORM + Alembic migrations (FastAPI) or Drizzle (Next.js native)
- Vercel Cron for periodic trust score computation and health checks

### Deployment Service
- Clones GitHub repo, validates agent structure
- Creates Vercel project via `@vercel/client` or REST API
- Sets env vars, triggers deploy, captures URL
- Registers agent in marketplace database

## Agent Contract

Every agent deployed to the marketplace must implement:

```
GET  /api/health  → { status: "ok", agent: "name", version: "1.0.0" }
POST /api/run     → { input: ..., output: ... }
POST /api/demo    → { result: ..., demo_config: ... }
```

## Data Flow

1. **Submit Flow**: User connects Vercel → enters GitHub repo + env vars → backend clones → packages → deploys to user's Vercel → returns live URL → lists on marketplace
2. **Demo Flow**: User clicks "Run Demo" on agent detail → POST /api/demo on deployed agent → result displayed in-browser
3. **Health Flow**: Vercel Cron (6h) → probes GET /api/health on all deployed agents → updates metrics in Neon Postgres → recomputes trust scores

## Decision: Vercel Cross-Account Deploy

**⚠️ Day 1 PoC required.** The cross-account deployment flow is the critical path.

**Plan:**
1. Day 1: Clone sample agent, deploy to test Vercel account, confirm URL capture
2. If PoC succeeds → build full pipeline
3. If PoC fails (OAuth complexity, API limits) → fallback: provide GitHub "Deploy to Vercel" button + manual registration

**Rationale:** This decision gates the entire architecture. If we can't deploy to user accounts automatically, we pivot to a simpler model where users click "Deploy" on a pre-configured Vercel template and manually register the URL.

## Seed Templates (4 agents)

| Agent | Description | Priority |
|-------|-------------|----------|
| API Builder | SQL schema → REST API + auth + docs → deploy | P0 |
| Live Debugger | Error capture → LLM fix → GitHub PR | P0 |
| Code Reviewer | PR URL → structured review with severity | P1 |
| Data Analyst | Natural language → SQL → insights | P1 |

## Trust Scoring

**Days 1-7:** Editorial badges ("Staff Pick", "First Edition", "Verified")
**Days 8+:** Computed scores when usage data exists:
```
score = (success_rate × 50) + (uptime_norm × 30) + (rating_norm × 20)
```

## Infrastructure
- Hosting: Vercel (both frontend + functions)
- Database: Neon Postgres (Vercel Marketplace)
- Agent execution: User's own Vercel deployments
- Health monitoring: Vercel Cron + HTTP probes
- Credentials: `.env` + encrypted token storage

## Team Responsibilities

| Role | Owner | Scope |
|------|-------|-------|
| Team Lead / Full Stack | You | Next.js, Neon Postgres, Vercel integration, deployment pipeline |
| Frontend Lead | Sagar | Next.js UI, agent detail, dashboard, submit form |
| Backend / Deployment | Krishna | FastAPI deploy service, Vercel API integration, agent packaging |
| Backend / Metrics | Jeet | Health checks, trust scoring, analytics, cron jobs |
