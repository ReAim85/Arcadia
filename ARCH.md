# AgentHub - Architecture

## System Overview

AgentHub is an AI Agents Marketplace platform built for the HackIndia 24-hour hackathon. It enables developers to discover, evaluate, and deploy autonomous software engineering agents with live demos, metrics, and trust scores.

## Architecture Diagram

```
                    (ngrok: HTTPS endpoint)
                            |
                            v
                    +-------------------+
                    |   React Frontend  |
                    |  (Vite + Chakra)  |
                    |  - Marketplace    |
                    |  - Agent Pages    |
                    |  - Deploy Modal   |
                    |  - Debug Console  |
                    +--------+----------+
                             | HTTP / WS
                             v
                    +-------------------+
                    |  FastAPI Backend  |
                    |  - REST API       |
                    |  - WebSocket Hub  |
                    |  - SQLAlchemy ORM |
                    +---+----+----+-----+
                        |    |    |
                +-------+    |    +--------+
                v            v             v
         +------------+ +--------+ +---------------+
         | API Builder| |Live Dbg| | Simulated Agents|
         |  (CrewAI)  | |(CrewAI)| | System Architect|
         +------+-----+ +---+----+ | Security Auditor|
                |          |      +---------------+
                v          v
         +------------+ +--------+
         | Vercel API | | GitHub |
         | Deployment | | PR API |
         +------------+ +--------+
```

## Components

### Frontend (React + Vite + Chakra UI)
- **Marketplace View** - Browse/search agent catalog
- **Agent Showcase Pages** - Rich detail pages per agent
- **Deployment Modals** - Configure and trigger agent deployment
- **Real-time Debug Console** - WebSocket-powered live log streaming

### Backend (FastAPI + SQLAlchemy)
- REST API for marketplace data, agent status, metrics
- WebSocket endpoint for real-time log streaming
- SQLAlchemy ORM for user, agent, and deployment records

### Agents

| Agent | Status | Tech | Function |
|-------|--------|------|----------|
| API Builder | Fully operational | CrewAI, FastAPI | SQL/NoSQL schema input -> REST API + auth + OpenAPI docs -> Vercel deploy (90s target) |
| Live Debugger | Fully operational | CrewAI, WebSocket | Error capture + LLM analysis -> fix suggestion with diff -> GitHub PR |
| System Architect | Coming Soon | React static page | Detail page with roadmap timeline |
| Security Auditor | Coming Soon | React static page | Detail page with scan mock + roadmap |

## Data Flow

1. **API Builder Flow**: User provides schema -> Backend parses -> CrewAI generates API -> Deploys to Vercel -> Returns working URL
2. **Live Debugger Flow**: App connects via WebSocket -> Exceptions captured -> LLM analyzes error + suggests fix -> GitHub PR created
3. **Marketplace Flow**: Frontend queries FastAPI -> SQLAlchemy fetches agent metadata -> Renders showcase

## Infrastructure

- **Hosting**: ngrok tunnel from local machine for frontend
- **Backend**: VS Code port forwarding exposing FastAPI
- **Database**: SQLAlchemy-managed SQLite (`check_same_thread=False`, `pool_pre_ping=True`)
- **Agent Orchestration**: CrewAI for both operational agents
- **Job Queue**: In-memory dict with `asyncio.create_task` background workers
- **SQL Parsing**: sqlglot library (not custom parser)
- **Vercel Deploy**: `vercel deploy --prod --token=XXX` via subprocess
- **Credentials**: `.env` + `.gitignore`, validated on startup
- **CORS**: `allow_origins=["*"]` for hackathon (ngrok URL changes)

## Team Responsibilities

| Role | Owner | Scope |
|------|-------|-------|
| Team Lead / Full Stack | You | System integration, ngrok infra, final pitch |
| Frontend Lead | Sagar | React + Vite + Chakra UI marketplace UI |
| Backend / Debugger | Jeet | FastAPI, Live Debugger agent, WebSocket streaming |
| Backend / API Builder | Krishna | FastAPI, API Builder agent, Vercel deploy automation |

## 24-Hour Execution Timeline

| Hours | Milestone |
|-------|-----------|
| 0-6 | Frontend scaffold + Backend skeleton + DB schema |
| 6-12 | API Builder agent core (schema parsing + Vercel deploy) |
| 12-18 | Live Debugger agent (error capture + fix + GitHub PR) |
| 18-22 | Integration + Simulated agent UIs + ngrok setup |
| 22-24 | E2E testing + Bug fixes + Demo rehearsal |

## Demo Flow (5 min)
1. Browse marketplace
2. Generate and deploy a live API (API Builder)
3. Trigger autonomous bug detection and resolution (Live Debugger)
