# Template A — New feature (PLAN FIRST)

Implement this WorkPhelo feature: **[describe exact behavior here]**.

Relevant files: @apps/ai-service/src/app.module.ts @apps/ai-service/src/config/runtime-env.ts @apps/api-gateway/src/proxy/proxy.controller.ts @apps/api-gateway/src/ai.openapi.ts @apps/ai-service/INTERNAL_DEMO_HANDOFF.md

Read @AGENTS.md and inspect related modules, guards, Prisma schema, tests and current `git status`. First return a **plan only**: behavior/acceptance criteria; exact files and contracts affected; Auth/Gateway/AI trust boundaries; tenant isolation and flags; migration/deployment impact; tests; risks/rollback. **Wait for my approval before editing 2+ files or any sensitive area.** After approval, make the smallest compatible implementation with regression tests. For AI, keep DEV eligibility-only; no shared DB writes, demos, external provider calls or deployment. Run `node scripts/verify-codex.mjs --scope=ai`, report any not-run real-DB/Redis tests, and show the diff. Do not commit/push/merge/deploy without instruction.
