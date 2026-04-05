# AgentHub - Implementation Plan

## Sprint: 10-Day AI Agents Marketplace

**Key shift:** 24h hackathon → 10 days. We build a real marketplace, not a showcase. Users can submit, deploy, and discover agents. The marketplace is the discovery layer. Agents deploy to the user's own Vercel account — zero infra cost for us.

---

## Core Product Decisions

### What is AgentHub?

An AI Agents Marketplace where:
1. **Developers submit agents** — GitHub repo URL + .env config
2. **AgentHub deploys to user's Vercel account** — no infrastructure burden on us
3. **Marketplace discovers, scores, and demos** — users browse, try, clone, deploy

### Agent Deployment Architecture

**Deploy to user's Vercel account, not ours.**

```
User submits GitHub repo → Marketplace clones + packages → Deploys to user's Vercel →
  Returns deployed URL → Marketplace lists agent with live demo endpoint
```

Why this works:
- **Zero infra cost** for us
- **Agents get own sandboxed environment** — no resource contention
- **Scales beyond one PC** — agents run on Vercel's global edge
- **Real security** — each agent is isolated in its own deployment
- **Vercel is built for this** — Fluid Compute, Functions, AI SDK all support agent runtimes

**⚠️ Risk flagged by CEO review:** Cross-account Vercel deployment complexity may be under-estimated. **Action:** Day 1 must include a proof-of-concept of the Vercel OAuth + cross-account deploy flow. If it takes >1 day, fall back to "clone to your Vercel" button approach.

### Agent Runtime Contract

Every agent must conform to this interface:

```
GET  /api/health        → { status: "ok", agent: "name", version: "1.0.0" }
POST /api/run           → accepts agent input, returns agent output
POST /api/demo          → runs pre-configured demo, returns result
```

This lets the marketplace show live demos, run agents, and display results.

### Trust Scoring Strategy

Trust score is important but meaningless without data. **Phase 1 (Days 1-7):** Use editorial badges ("Staff Pick", "First Edition") + submission date. **Phase 2 (Day 8+):** Once we have real usage, compute actual scores: `(success_rate × 50) + (uptime_norm × 30) + (rating_norm × 20)`.

### Agent Categories (10-day target)

| Category | Examples | Priority |
|-----------|----------|----------|
| API Builder | Schema → REST API | P0 (seed template) |
| Live Debugger | Error fix → GitHub PR | P0 (seed template) |
| Code Reviewer | PR review agent | P1 (seed template) |
| Data Analyst | SQL → Insights | P1 (seed template) |
| User-Submitted | Community agents | P0 (infrastructure) |

---

## Phase 1: Marketplace Foundation (Days 1-2)

### 1.1 Frontend Architecture
- **Next.js App Router** with TypeScript
- **shadcn/ui** component library (Tailwind-based, production-grade)
- **Server + Client components split** — marketplace pages use RSC where possible
- **Route structure**:
  - `/` — Marketplace home (agent grid, search, categories, trending)
  - `/agents/[slug]` — Agent detail page (description, demo, metrics, deploy)
  - `/submit` — Submit your agent (repo URL + .env config + metadata)
  - `/dashboard` — User's deployed agents (status, metrics, manage)
  - `/api/*` — API routes for backend

### 1.2 Backend
- **Neon Postgres** via Vercel Marketplace — serverless, scales to zero, free tier
- **SQLAlchemy** ORM + **Alembic** migrations (FastAPI) or **Drizzle** (if all-in on Next.js)
- **Models**:
  - `Agent`: id, slug, name, description, category, github_url, vercel_project_id, vercel_url, owner_id, status, created_at
  - `Deployment`: id, agent_id, vercel_deployment_id, status, url, deployed_at, owner_id
  - `User`: id, vercel_token (encrypted), vercel_team_id, created_at
  - `UsageMetric`: id, agent_id, metric_type, value, timestamp

### 1.3 Vercel Integration (MUST PROVE ON DAY 1)
- **Proof of concept:** Clone a sample agent repo, deploy to a test Vercel account, capture URL
- If the PoC works → full pipeline. If not → fall back to GitHub template "Deploy to Vercel" button
- **`@vercel/client` SDK** or Vercel REST API for programmatic deploys

---

## Phase 2: Agent Submission + Deployment (Days 3-4)

### 2.1 Agent Submission Flow

User visits `/submit`:
1. Enter GitHub repo URL
2. Auto-fetch repo metadata (name, description)
3. Fill agent name, description, category
4. Add environment variables (key-value pairs, encrypted at rest)
5. Define demo configuration (test input + expected output)
6. Connect Vercel account (OAuth or token)
7. Click "Deploy Agent" → backend orchestrates the deployment

### 2.2 Backend Deployment Pipeline

```
POST /api/agents/deploy
  │
  ├── 1. Validate GitHub repo (exists, accessible, valid structure)
  ├── 2. Clone repo to temp dir
  ├── 3. Validate agent structure (main.py/index.py, requirements.txt, .env.example)
  ├── 4. Package as Vercel-deployable project
  ├── 5. Create Vercel project via API (user's token)
  ├── 6. Set env vars securely (encrypted at rest)
  ├── 7. Trigger deploy
  ├── 8. Wait for build complete
  ├── 9. Capture deployment URL
  ├── 10. Run demo test (POST demo-configured test input)
  ├── 11. Register agent in marketplace
  └── 12. Return agent detail to frontend
```

### 2.3 Seed Templates

Pre-built, marketplace-ready agents that demonstrate the platform:
- **API Builder:** Takes SQL/NoSQL schema → generates FastAPI REST API → deploys to Vercel
- **Live Debugger:** Captures errors via WebSocket → LLM analysis → fix suggestion → GitHub PR
- **Code Reviewer:** Accepts PR URL → LLM review → structured output with severity scores
- **Data Analyst:** Accepts natural language query → generates SQL → returns insights

Each template serves as: (a) demo content for empty marketplace, (b) reference implementation for agent developers.

---

## Phase 3: Marketplace UI (Days 5-6)

### 3.1 Home Page

- Search bar with category filtering
- Agent card grid: name, description, trust badge, deployment count, "Deploy" button
- Trending section: recent deployments, rising agents
- Activity feed: "X just deployed Y agent"

### 3.2 Agent Detail Page

- Hero section: name, description, trust badge, deployment count
- Live demo panel: pre-configured test input, "Run Demo" button, result display
- Capabilities checklist
- Deploy stats: uptime, deploy count, success rate
- "Deploy to Vercel" CTA
- Source code link (GitHub)
- Recent deployment history

### 3.3 Dashboard

- User's deployed agents with status indicators (Live, Building, Failed)
- Per-agent management: view, redeploy, settings, analytics
- Recent activity log

---

## Phase 4: Trust Scoring + Metrics (Days 7-8)

### 4.1 Initial Trust Signals (Day 7)
- Editorial badges: "Staff Pick", "First Edition"
- Submission date tracking
- Verification status (verified repo, verified demo works)

### 4.2 Real Trust Scoring (Day 8+)
- Compute trust scores from real usage data
- Vercel Cron: `/api/cron/compute-scores` — runs every 6 hours
- Health checks: probe all deployed agents, record uptime
- Usage aggregation: API calls, response times, error rates

### 4.3 Analytics
- Per-agent analytics page with charts
- Deployment history with success/failure tracking
- User engagement metrics (ratings, favorites, clones)

---

## Phase 5: Polish + Community (Days 9-10)

### 5.1 Community Features
- Agent reviews and ratings
- Fork and customize — clone an agent, modify, redeploy as your variant
- Leaderboard — trending, top rated, most deployed
- Activity feed with real-time updates

### 5.2 Agent Template Library
- Curated templates with one-click deploy
- Each template conforms to the standard agent contract
- Pre-built with demo configurations

### 5.3 Final Polish
- **Performance:** Lighthouse audit, optimize images, code splitting
- **Error handling:** All error paths covered — deployment failures, API timeouts, auth expiry
- **Security:** Token encryption, input validation, rate limiting
- **Documentation:** README, deploy guide, agent spec documentation
- **Demo prep:** End-to-end test flow, recording fallback

---

## Timeline (10 Days)

| Day | Milestone | Owner | Key Deliverables |
|-----|-----------|-------|-----------------|
| 1-2 | Foundation | You | Next.js init, Neon Postgres, **Vercel deploy PoC**, FastAPI scaffold, models |
| 3-4 | Submit + Deploy Pipeline | Krishna | Submit form, repo cloning, Vercel deploy, env var management |
| 5-6 | Marketplace UI | Sagar | Home page, agent detail, live demo panel, dashboard |
| 7-8 | Trust + Metrics | You, Jeet | Editorial badges, health checks, analytics, usage tracking |
| 9-10 | Polish + Community | All | Templates, reviews, leaderboard, fork-and-customize, E2E tests |

---

## Architecture

```
                    ┌──────────────────────────────────────────────┐
                    │  User Browser                                 │
                    └──────────────────┬───────────────────────────┘
                                       │
                    ┌──────────────────▼───────────────────────────┐
                    │  Next.js App Router (Vercel)                  │
                    │  ┌──────────┐ ┌──────────┐ ┌─────────────┐  │
                    │  │/ (Home)  │ │/agents/* │ │/submit      │  │
                    │  │          │ │/dashboard│ │/api/* routes │  │
                    │  └────┬─────┘ └────┬─────┘ └──────┬──────┘  │
                    └───────┼────────────┼──────────────┼─────────┘
                            │            │              │
                            ▼            ▼              ▼
                    ┌─────────────────────────────────────────┐
                    │  Database (Neon Postgres)                 │
                    │  Agents | Deployments | Users | Metrics  │
                    └─────────────────────────────────────────┘
                            │
                    ┌───────▼──────────────────────────────────┐
                    │  Deployment Service (FastAPI or Vercel Fn)│
                    │  ┌──────────────────────────────────┐   │
                    │  │ Clone repo → Package → Deploy    │   │
                    │  │ to user's Vercel account         │   │
                    │  └──────────────────────────────────┘   │
                    └───────────────┬──────────────────────────┘
                                    │
              ┌─────────────────────┼────────────────────────┐
              │                     │                        │
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
                    │  Health Check + Metrics Collector           │
                    │  Probes deployed agents, records stats      │
                    └────────────────────────────────────────────┘
```

---

## Success Criteria

### Functional
- [ ] Marketplace displays agents with rich detail (live demo, metrics, trust badge)
- [ ] Agent submission: GitHub repo → deployed Vercel URL in <2 minutes
- [ ] Live demo panel works on agent detail page
- [ ] Dashboard shows user's deployed agents with status
- [ ] Trust signals visible (editorial badges → algorithm scores by Day 8)

### Infrastructure
- [ ] Next.js deployed to Vercel
- [ ] Neon Postgres connected and seeded
- [ ] Vercel cross-account deploy PoC working (or fallback: GitHub template button)

### Demo / Launch
- [ ] At least 4 seed agents deployed and visible
- [ ] Full user flow: browse → try demo → submit agent → deploy
- [ ] End-to-end tests for critical paths
- [ ] Shareable URL for public launch by Day 5

---

## /autoplan Review Report

### CEO Findings Incorporated

| Finding | Severity | Status |
|---------|----------|--------|
| Cross-account Vercel deploy complexity | High | **Addressed** — Day 1 PoC required, fallback to GitHub template button |
| Trust score needs data | Medium | **Addressed** — Editorial badges first, algorithm scores only after Day 8 |
| Community features too early | High | **Addressed** — Days 9-10 only if core flow works. Cut if needed. |
| Competition from GitHub/Vercel/Replit | Critical | **Flagged** — We become agent packaging + distribution tooling layer |
| Need shareable URL by Day 3-4 | Critical | **Addressed** — Seed templates deploy Days 3-4, public URL ready |

### Previous Review History

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` (24h plan) | Scope & strategy | 1 | SUPERSEDED | 7 findings from 24h plan — replaced by 10-day review |
| Eng Review | `/plan-eng-review` (24h plan) | Architecture & tests | 1 | SUPERSEDED | Plan now 10-day scope |
| Design Review | `/plan-design-review` (24h plan) | UI/UX gaps | 1 | SUPERSEDED | Plan now uses Next.js + shadcn/ui |

**VERDICT:** PLAN UPDATED to 10-day scope. CEO findings from subagent incorporated. Proceed to implementation.
