# Template C — Safe refactor (NO INTERFACE CHANGE)

Refactor **[specific target]** to **[specific maintainability objective]** without changing behavior.

Reference @AGENTS.md @apps/ai-service/src/conversations @apps/ai-service/src/request-integrity @apps/api-gateway/src/proxy/proxy.controller.ts @apps/api-gateway/src/ai.openapi.spec.ts @apps/ai-service/INTERNAL_DEMO_HANDOFF.md where relevant.

First inventory public HTTP routes, DTOs, schemas, Swagger, error/status shapes, JWT/assertion/proof contracts, stable message ordering, idempotency replay, tenant ownership, default-disabled flags, migrations, config names and existing tests. Propose an exact-file plan and **wait for approval** when 2+ files or sensitive areas are affected. Preserve identical behavior, request/response formats, environment variables, migration history and disabled-mode responses. Do not change historical DEV workflow or dependency versions. Add characterization tests before restructuring when needed. Use `node scripts/verify-codex.mjs --scope=ai` for AI/Gateway or the root command for cross-workspace changes; report actual checks and remaining risk. No push/merge/deploy.
