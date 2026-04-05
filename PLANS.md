# AgentHub - Implementation Plan

## Sprint: HackIndia 24-Hour Hackathon

## Phase 1: Foundation (Hours 0-6)

### 1.1 Frontend Scaffold
- [ ] Initialize React project with Vite
- [ ] Install and configure Chakra UI
- [ ] Create base layout: header, navigation, routing
- [ ] Build marketplace home page shell (agent grid/cards)
- [ ] Set up React Router for agent detail pages

### 1.1.1 90s Loading State — Demo Priority #1
- [ ] Multi-stage progress component: "Parsing Schema" → "Generating Endpoints" → "Adding Auth" → "Deploying to Cloud" → "Ready"
- [ ] Each stage updates UI with stage name, icon, and approximate time elapsed
- [ ] Chakra `<Progress>` with indeterminate animation, stage-based color transitions
- [ ] Fallback: plain spinner if stage detection fails

### 1.2 Backend Skeleton
- [ ] Initialize FastAPI project
- [ ] Configure CORS (`allow_origins=["*"]`), middleware, error handlers
- [ ] Set up SQLAlchemy with SQLite (`check_same_thread=False`, `pool_pre_ping=True`)
- [ ] Create initial models: Agent, Deployment, Metrics
- [ ] Seed database with 4 agent entries (2 operational, 2 coming soon)
- [ ] Basic REST endpoints: GET /agents, GET /agents/{id}
- [ ] Startup validation: check DB, API keys, Vercel CLI, GitHub PAT, seed data
- [ ] Add `.env` + `.gitignore` for all credentials (Vercel token, GitHub PAT, LLM keys)

### 1.3 Project Structure
```
backend/
  main.py                    # FastAPI app, CORS, router mounts, startup checks
  config.py                  # Settings: DB URL, API keys, tokens (loads .env)
  db.py                      # SQLAlchemy engine, session, Base
  seed.py                    # Seed script: 4 agents
  models/
    agent.py                 # Agent: id, name, desc, status, trust_score
    deployment.py            # Deployment: job_id, status, url, created_at
  routers/
    marketplace.py            # GET /agents, GET /agents/{id}
    api_builder.py            # POST /parse, /generate, GET /status/{job_id}
    debugger.py               # WS /connect, POST /capture, GET /sessions
  agents/
    crew_api_builder.py       # CrewAI: schema analyst → endpoint designer → auth
    crew_live_debugger.py     # CrewAI: error analyzer → fix engineer (2 roles)
  services/
    job_manager.py            # In-memory job queue with asyncio.create_task
    vercel_deploy.py          # Wraps: vercel deploy --prod --token=XXX
    github_pr.py              # GitHub PR creation via PyGithub or requests
  tests/
    test_marketplace.py       # GET /agents returns 4 seeded agents
    test_api_builder.py       # POST /parse with known schema → structured output
    test_debugger.py          # WS connection + log send/receive
```

## Phase 2: API Builder Agent (Hours 6-12)
**Owner: Krishna**

### 2.1 Schema Parser
- [ ] Accept SQL DDL or NoSQL schema definitions as input
- [ ] Parse schema using `sqlglot` library (not custom parser — handles dialects)
- [ ] Convert parsed schema into internal representation (tables, fields, types, relations)
- [ ] Validate schema syntax and return structured errors with line numbers

### 2.2 API Generator (CrewAI)
- [ ] Define agent crew: schema analyst -> endpoint designer -> auth implementer
- [ ] Generate REST API endpoints for all CRUD operations
- [ ] Add authentication middleware (API key or JWT)
- [ ] Implement rate limiting
- [ ] Generate OpenAPI/Swagger documentation

### 2.3 Vercel Deployment Integration
- [ ] Package generated API as deployable project
- [ ] Trigger Vercel deployment via API
- [ ] Capture and return working URL
- [ ] Target: <90 seconds from schema input to live URL

### 2.4 Backend Endpoints
- [ ] POST /agents/api-builder/parse - Parse and validate schema
- [ ] POST /agents/api-builder/generate - Generate and deploy API
- [ ] GET /agents/api-builder/status/{job_id} - Check deployment status

## Phase 3: Live Debugger Agent (Hours 12-18)
**Owner: Jeet**

### 3.1 WebSocket Infrastructure
- [ ] WebSocket endpoint for real-time log streaming
- [ ] Connection management (connect, disconnect, reconnect)
- [ ] Subscribe/unsubscribe to debug sessions

### 3.2 Error Capture
- [ ] Connect to running applications via WebSocket
- [ ] Capture runtime exceptions with full context
- [ ] Collect stack traces and variable states
- [ ] Filter and deduplicate errors

### 3.3 Fix Generation (CrewAI)
- [ ] Define agent crew: error analyzer -> fix engineer (2 roles, not 3)
- [ ] Feed error + stack trace to LLM for analysis and fix suggestion
- [ ] Return fix as a structured patch with confidence level
- [ ] Display fix in UI as diff view (no headless browser reproduction)

### 3.4 GitHub Integration
- [ ] Configure GitHub OAuth token for PR creation
- [ ] Generate detailed PR description with diff view
- [ ] Auto-create pull request with fix
- [ ] Link PR back to debug session

### 3.5 Backend Endpoints
- [ ] WS /agents/debugger/connect/{app_url} - Connect to debug target
- [ ] POST /agents/debugger/capture - Capture and analyze error
- [ ] GET /agents/debugger/sessions - List active debug sessions

## Phase 4: Integration + Polish (Hours 18-22)
**Owner: All**

### 4.1 Frontend-Backend Integration
- [ ] Wire agent showcase pages to real backend data
- [ ] Deploy modal triggers actual API Builder flow
- [ ] Debug console shows real-time WebSocket logs
- [ ] Agent metrics dashboard with live data

### 4.2 Simulated Agent UIs
- [ ] System Architect detail page with roadmap timeline + "Coming Soon" badge
- [ ] Security Auditor detail page with vulnerability scan mock + "Coming Soon" badge
- [ ] Both redirect to static "Coming Soon" state — no fake interactive flows

### 4.3 Infrastructure
- [ ] ngrok setup for frontend hosting
- [ ] VS Code port forwarding for FastAPI backend
- [ ] Test external judge access flow

## Phase 5: Testing + Demo Prep (Hours 22-24)
**Owner: Team Lead (You)**

### 5.1 End-to-End Testing
- [ ] Full marketplace browsing flow
- [ ] API generation and deployment (end-to-end)
- [ ] Debugger error capture to GitHub PR flow
- [ ] Simulated agent interaction verification

### 5.2 Bug Fixes
- [ ] Fix critical path blockers
- [ ] Handle edge cases in demo flow
- [ ] Performance check: API Builder <90s target

### 5.3 Demo Rehearsal
- [ ] Time the 5-minute demo flow
- [ ] Prepare backup/demo data (sample schemas, known bugs)
- [ ] Verify ngrok stability and judge device access

## Success Criteria

### Functional
- [x] Marketplace displays all 4 agents with rich detail
- [ ] API Builder: input schema -> live API URL in <90s
- [ ] Live Debugger: capture error -> generate fix -> create GitHub PR
- [ ] Simulated agents: convincing interactive UI demos

### Infrastructure
- [ ] Frontend accessible via ngrok HTTPS
- [ ] Backend accessible via VS Code port forwarding
- [ ] Judges can interact on their own devices

### Demo
- [ ] 5-minute flow: browse -> build -> debug
- [ ] No crashes or timeouts during demo
- [ ] 5-minute flow: browse -> build -> debug
- [ ] No crashes or timeouts during demo
- [ ] Clear proof that AI agents transcend conversational interfaces

---

## /autoplan Review Report

### Decision Audit Trail

| # | Phase | Decision | Classification | Principle | Rationale | Rejected |
|---|-------|----------|-----------|-----------|----------|
| 1 | CEO | Keep 4-agent plan with safety net | Taste | P2 + P6 | Team committed. Add fallback demo by hour 18. | Single-agent deep demo |
| 2 | CEO | Add fallback demo assets by hour 18 | Mechanical | P1 | Non-negotiable for live demo risk. | Skip fallback |
| 3 | CEO | Mode = SELECTIVE_EXPANSION | Mechanical | P3 | Clear goals, greenfield hackathon. | Scope reduction |
| 4 | CEO | Reusable library over custom infra | Mechanical | P4 (DRY) | Use CrewAI, FastAPI, Vercel APIs. | Build custom framework |
| 5 | Design | Multi-stage progress for 90s generation | Mechanical | P1 | 90s dead air kills demo. | Plain spinner |
| 6 | Design | Detail page for info, modal for deploy only | Mechanical | P5 (explicit) | Plan has conflicting patterns. | Both patterns |
| 7 | Design | Debug console = scrolling terminal, color logs | Mechanical | P5 (explicit) | Concrete spec for implementer. | Structured event list |
| 8 | Design | Trust score = 0-10 badge, color coded | Mechanical | P5 (explicit) | Concrete spec. | Complex trust algo |
| 9 | Design | Simulated agents get "Coming Soon" badge | Mechanical | P5 (explicit) | Judges won't try broken flows. | No distinction |
| 10 | Design | Min viable a11y (semantic HTML, keyboard nav) | Mechanical | P3 (pragmatic) | 24h hackathon, full a11y is ocean. | Full WCAG |
| 11 | Design | Single-col mobile, card grid tablet+, 44px min | Mechanical | P1 (completeness) | Judge device UX. | No responsive spec |
| 12 | Eng | Cut headless browser reproduction | User Challenge | P5 + P3 | Cannot implement in 6h. LLM analysis works. | Full headless browser |
| 13 | Eng | Add 3 smoke tests by hour 18 | Mechanical | P1 | 15 min. Catches CORS, routing, serialization. | Skip tests |
| 14 | Eng | In-memory job queue (dict str->JobState) | Mechanical | P5 (explicit) | No Celery/Redis needed for hackathon. | Full task queue |
| 15 | Eng | CORS allow_origins=["*"] for hackathon | Mechanical | P3 (pragmatic) | ngrok URLs change constantly. | Production CORS |
| 16 | Eng | Use throwaway GitHub account for PR | Mechanical | P1 (completeness) | Prevents credential leak. | Personal token |
| 17 | Eng | Fast model for CrewAI (mini/Haiku) | Mechanical | P3 (pragmatic) | 90s target tight. | GPT-4 or Opus |

### NOT in Scope (CEO Phase)

| Item | Rationale |
|------|-----------|
| Marketplace multi-user features | Hackathon demo is single-user only |
| Agent trust scoring algorithm | Not in 5-min demo flow |
| Production reliability/SLAs | Demo-time only |
| Headless browser error reproduction | Cannot implement in 6h; replaced with LLM analysis |

### What Already Exists

| Sub-problem | Existing Solution |
|-------------|-------------------|
| Agent marketplace UI patterns | Chakra UI cards, grids, modals |
| REST API auto-docs | FastAPI auto-generates OpenAPI/Swagger |
| WebSocket streaming | FastAPI built-in WebSocket support |
| GitHub PR creation | GitHub REST API |
| Vercel deployment | Vercel API/CLI, programmatic access |
| Agent orchestration | CrewAI framework |

### Error & Rescue Registry

| Method/Codepath | What Can Go Wrong | Exception | Rescued? | Rescue Action | User Sees |
|-----------------|-------------------|-----------|----------|---------------|-----------|
| API Builder→Vercel deploy | Auth expired | VercelAuthError | Y | Return error, re-auth required | "API key expired" |
| API Builder→Vercel deploy | Rate limited | VercelRateLimit | Y | Backoff 5s, retry once | "Queued, please wait..." |
| API Builder→Vercel deploy | Timeout >90s | VercelTimeout | Y | Show partial + status URL | "Deploy in progress, check 30s" |
| API Builder→Schema parse | Malformed input | SchemaParseError | Y | Structured errors | "Schema error line X: ..." |
| Debugger→WS connect | Connection refused | WSConnectError | Y | Show unreachable + retry | "Cannot connect. Retry?" |
| Debugger→GitHub PR | PAT revoked | GitHubAuthError | Y | Return fix as diff | "PR failed. Here's fix:" |
| Debugger→GitHub PR | Rate limited | GitHubRateLimit | Y | Return fix as diff | "Rate limited. Fix attached." |

### Failure Modes Registry

| Failure Mode | Trigger | Impact | Mitigation | Status |
|-------------|---------|--------|------------|--------|
| ngrok disconnects | Free tier timeout, sleep | Judges lose access | Pre-recorded demo + USB | Gap→add hr 18 |
| Vercel deploy queue | Many concurrent builds | 90s target blown | Pre-generated URL fallback | Gap→add seed |
| WebSocket zombie | Tab close w/o cleanup | Memory/resource leak | 5-min auto-kill heartbeat | Gap→implement |
| Main thread blocked | Sync agent task | API unresponsive | asyncio.create_task | Gap→background tasks |
| CORS on ngrok restart | Static origin | Frontend blocked | allow_origins=["*"] | Decided |

### Architecture Diagram

```
  Judge Browser ─────── ngrok ───────┐
                                     ▼
  ┌─────────────────────────────────────────────────────┐
  │  React Frontend (Vite + Chakra UI)                  │
  │  ┌──────────┐ ┌────────────┐ ┌────────────────┐    │
  │  │Marketplace│ │Deploy Modal│ │Debug Console   │    │
  │  │Cards     │ │(schema in) │ │(term, colored) │    │
  │  └────┬─────┘ └─────┬──────┘ └──┬─────────────┘    │
  └───────┼─────────────┼───────────┼───────────────────┘
          │             │           │
          ▼             ▼           ▼
  ┌─────────────────────────────────────────┐
  │  FastAPI Backend                        │
  │  ┌──────────┐ ┌──────────┐ ┌─────────┐ │
  │  │MarketAPI │ │API Builder│ │Debugger │ │
  │  │/agents   │ │/api-build│ │/debug   │ │
  │  └────┬─────┘ └────┬─────┘ └────┬────┘ │
  │       └─────────────┴────────────┘      │
  │         In-Memory Job Queue (dict)      │
  └────────────────┬────────────────────────┘
                   │
          ┌────────┴────────┐
          ▼                 ▼
     ┌─────────┐       ┌──────────┐
     │  Vercel │       │  GitHub  │
     │  Deploy │       │  PR API  │
     └─────────┘       └──────────┘
          │
     ┌─────────┐
     │  CrewAI │
     └────┬────┘
          ▼
     ┌─────────┐
     │  SQLite │
     └─────────┘
```

### Cross-Phase Themes

**Theme: Fallback/Degradation** — flagged in Phases 1, 2, 3. Every phase independently identified the need for graceful degradation when live services fail during demo. This is the highest-confidence signal across the review.
  - CEO: ngrok single point of failure, no redundancy
  - Design: 90s loading state needs progressive narrative
  - Eng: Vercel/GitHub error paths all need graceful fallback

**Theme: Scope Inflation** — flagged in Phases 1, 2, 3.
  - CEO: Cut to 1-2 agents deep, simulated waste time
  - Design: Hours 18-22 wasted on "polished simulated interactions"
  - Eng: Headless browser reproduction is a research problem, not a 6h task

### Deferred to TODOS.md (post-hackathon)

1. Real trust scoring algorithm and metrics dashboard
2. Multi-agent comparison tooling
3. Production CORS configuration
4. Full test suite (unit + integration)
5. Agent submission portal
6. User account management
7. Performance optimization for concurrent usage

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | ISSUES_OPEN | 7 findings, 1 critical (ngrok SPOF) |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES_OPEN | 10 issues, 2 critical gaps |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | ISSUES_OPEN | 10 findings (via /autoplan) |

**UNRESOLVED:** 0 decisions
**VERDICT:** ENG CLEARED (PLAN) — all decisions resolved, 2 critical gaps noted (startup validation, SQLite threading)
