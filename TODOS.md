# AgentHub - TODOS

## 1. Real Trust Scoring Algorithm
**What:** Implement a meaningful trust score for agents based on actual metrics (usage, success rate, deployment uptime, error rate).
**Why:** Currently trust_score is a hardcoded 0-10 badge. For a real marketplace, users need data-driven trust signals to decide which agents to deploy.
**Pros:** Core differentiator for the marketplace. Without it, AgentHub is just a directory.
**Cons:** Requires telemetry collection, metrics pipeline, and scoring algorithm. Significant backend work.
**Context:** The plan uses trust scores as a UI element now (0-10 badge). The algorithm can start simple: deploy success rate * 50 + avg uptime * 30 + user rating * 20.
**Depends on:** Usage metrics collection, deployment logging, user feedback system.

## 2. Full Test Suite
**What:** Comprehensive unit + integration + E2E test suite with >80% coverage.
**Why:** Only 3 smoke tests in the hackathon. For production use, every codepath needs coverage, especially error paths and the agent orchestration flows.
**Pros:** Catches regressions, enables CI/CD, gives confidence for refactors.
**Cons:** Large effort. Every CrewAI agent flow, WebSocket path, and error handler needs dedicated tests. Mocking external APIs (Vercel, GitHub) is non-trivial.
**Context:** Minimum viable tests (3 smoke tests) exist by hour 18 of the hackathon. The full suite should include: unit tests for schema parser, mocked Vercel deploy tests, mocked GitHub PR tests, WebSocket integration tests, and E2E flows for the full demo journey.
**Depends on:** Stable API, defined agent contracts, CI/CD pipeline.

## 3. Production CORS Configuration
**What:** Replace `allow_origins=["*"]` with a proper domain allowlist and credentials support.
**Why:** Wildcard CORS is fine for the hackathon with ngrok, but a security risk for production. Also blocks cookies/credentials which are needed for user auth.
**Pros:** Proper security posture, enables credential-based auth, prevents XSS origin attacks.
**Cons:** Requires dynamic origin management (users self-host). Need a config system for allowed domains.
**Context:** During the hackathon, ngrok URLs change on every restart, so `["*"]` is the only practical approach. Post-hackathon, implement `CORSMiddleware` with env-configured origins + optional user-configured origins for self-hosted deployments.
**Depends on:** Production deployment strategy, user domain management.
