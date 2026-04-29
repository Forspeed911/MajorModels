# AGENTS.md

## Scope

This file defines **mandatory rules** for AI agents working on the
MajorModels project.

📌 **Business requirements, domain rules, and functional scope are defined in
[`./docs/spec.md`](./docs/spec.md).**
Agents must treat `spec.md` as the single source of truth for business logic.

If instructions conflict, follow this file.

---

## Stack (fixed)

- Backend: **Node.js 18+, TypeScript (strict)**
- Framework: **NestJS**
- ORM: **Prisma**
- DB: **PostgreSQL**
- API: **REST (OpenAPI)**
- Validation: class-validator / class-transformer

❌ Python / FastAPI / Django / Flask — **forbidden**

---

## Architecture Rules

- Layered architecture only:
  `Controller → Service → Repository`
- No business logic in controllers
- No DB access outside repositories
- Services must be deterministic and testable


---

## API Rules

- REST only, nouns in URLs
- DTOs required for input/output
- Validation before service execution
- Versioning: `/api/v1/*`

---

## ExecPlans

When writing **complex features**, **cross-module changes**, or
**significant refactors**:

- Use an **ExecPlan** from design to implementation
- Follow the format described in [`./docs/PLANS.md`](./docs/PLANS.md)
- ExecPlan must cover:
  - problem statement
  - assumptions & constraints
  - design decisions
  - implementation steps
  - risks & rollback

Agents must **not** skip ExecPlans for non-trivial work.

---

## Methodology Quality Gate

Before publishing any analysis report or remediation plan, agents must run a fact-check gate against the current codebase.

Mandatory checks:

- verify every referenced method/class/file name exists in the repository right now
- verify every numeric claim (line count, hook count, number of tests, coverage baseline) with commands, not by estimation
- mark date of verification in the document (`verified at YYYY-MM-DD`)
- include at least one concrete evidence reference per critical finding (file + line)
- if a finding is stale or partially fixed, mark it explicitly instead of repeating old status

If the gate fails, the document must be corrected before implementation starts.

## Agent Behavior

- Prefer simple, explicit solutions
- Do not introduce new frameworks
- Do not refactor unrelated code
- Ask before making architectural changes

## Problem Solving

- all resolutions after resolving problems, write in in [`./docs/solutions.md`](./docs/solutions.md), and if you will have new problems use this file for researching how to resolve problem in priority, and only then try resolve it by your self

## QUALITY of CODE

review documentation via MCP Conext7 for react, Vercel, Next.js and supabase, use best practices from that server

## Releases

use `release.md` to short description of changes which i will commit, use rules of numbvers of versions, no commits from you side
