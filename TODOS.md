# AgentHub - TODOS

## 1. Billing/Monetization
**What:** Add pricing tiers (free, paid, enterprise) and Stripe integration for paid agent usage.
**Why:** Marketplace needs sustainability. Free agents get discovered, paid agents bring revenue. Platform takes a cut.
**Pros:** Turns marketplace into a business. Agents with proven value can monetize.
**Cons:** Large effort. Needs Stripe integration, usage metering, billing UI, tax handling. Deferring to post-launch.
**Context:** The current plan focuses on adoption first. Monetization requires a working marketplace with real users. Without trust and traffic, charging for anything kills growth early on.
**Depends on:** Real usage metrics, at least 100+ active users, stable deployment pipeline.

## 2. IDE Integration (VS Code Extension, Cursor Plugin)
**What:** IDE plugins that let developers discover and run agents directly from their editor.
**Why:** Agents are developer tools — the best place to use them is inside the IDE, not a web browser. VS Code and Cursor already have extension ecosystems.
**Pros:** Dramatically increases utility. Developers don't leave their workflow. Competitive moat against GitHub/Vercel.
**Cons:** Need VS Code extension TypeScript dev, Cursor plugin compatibility. Another distribution channel to maintain.
**Context:** Currently AgentHub is web-only. The IDE is where developers actually spend time. This is the biggest growth lever post-launch.
**Depends on:** Stable marketplace API, agent contract API documented.

## 3. Agent Execution Sandbox (for agents that don't deploy to Vercel)
**What:** Run agent code in isolated Docker/firecracker containers instead of requiring Vercel deployment.
**Why:** Not all agents are web-compatible. Some need GPU, long-running processes, or specific system dependencies. Vercel doesn't support everything.
**Pros:** Supports any agent type. Full compatibility with all agent architectures. Removes the Vercel dependency constraint.
**Cons:** Requires building compute infrastructure — containers, resource limits, security isolation, billing for compute. This is the "ocean" not the "lake."
**Context:** If we get serious about non-Vercel agents (data scientists with heavy ML, agents needing file system access), we need this. Day 10+ or post-launch.
**Depends on:** Real demand for non-Vercel agents, infrastructure budget, security review.

## 4. Agent Versioning + Rollback
**What:** Track agent versions, allow rollback to previous deployment, A/B test agent configurations.
**Why:** Agent developers iterate. When a new version breaks, they need to roll back. A/B configs help optimize agent performance.
**Pros:** Better developer experience. Production reliability. Performance optimization.
**Cons:** Needs deployment history tracking, version comparison UI, config diff tooling. Moderate effort.
**Context:** Each current deployment is one-shot. Redeploy overwrites the previous. Version history with rollback is a quality-of-life improvement post-launch.
**Depends on:** Stable deployment pipeline, multi-deployment support.

## 5. Agent Performance Benchmarking
**What:** Standardized test suites that score agents on speed, accuracy, cost per request.
**Why:** Trust scoring from reviews is subjective. Objective benchmarks let developers compare agents head-to-head.
**Pros:** Core differentiator for marketplace. Helps users make data-driven decisions. Incentivizes agent quality.
**Cons:** Need to build benchmark suites per category. Benchmarks can be gamed. Requires ongoing curation.
**Context:** Trust scoring (Phase 4) covers subjective metrics. Benchmarks are the objective complement. Add after Days 1-10.
**Depends on:** At least 5+ agents per category, standardized input/output format.

## 6. Enterprise SSO + Audit Logs
**What:** SAML SSO, team workspaces, deployment audit logs, role-based access.
**Why:** Enterprise buyers need identity integration, compliance, and visibility into agent usage.
**Pros:** Opens B2B revenue channel. Higher ACV. Compliance requirement for many orgs.
**Cons:** Significant auth infrastructure. SAML is non-trivial. Audit logs need a separate index.
**Context:** Current auth is per-user Vercel OAuth. Enterprise needs are orthogonal. Post-launch, post-PMF.
**Depends on:** Product-market fit with individual developers, enterprise demand signal.

## 7. Agent Forking & Collaboration
**What:** Fork an agent, customize, publish as your variant. Original gets credit. Collaboration on shared agents.
**Why:** The "fork-and-customize" pattern works for GitHub repos. It would work even better for agents — discover, fork, tweak system prompt, redeploy.
**Pros:** Viral growth loop. Every fork is a new listing. Original agent gets attribution traffic.
**Cons:** Needs agent dependency graph, attribution tracking, fork tree UI. Moderate complexity.
**Context:** Mentioned in Phase 5 as a community feature. If there's time on Days 9-10, implement. Otherwise, TODO.
**Depends on:** Working marketplace with submissions, agent metadata schema.
