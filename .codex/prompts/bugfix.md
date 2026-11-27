# Template B — Bug fix (ROOT CAUSE FIRST)

Investigate this defect in WorkPhelo: **[paste reproduction and observed/expected output]**.

Inspect @apps/api-gateway/src/proxy/proxy.controller.ts @apps/ai-service/src/eligibility @apps/ai-service/src/dev-deployment.spec.ts @apps/ai-service/DEV_DEPLOYMENT.md @AGENTS.md as relevant; inspect actual callers and existing tests rather than guessing.

Before editing, show: exact request path/call chain; root cause with file/line evidence; minimal safe fix; negative and regression tests; any Auth/tenant, signing, idempotency, persistence or deployment consequences. A 503 `Service 'ai' is not configured` suggests Gateway/upstream deployment, **not automatically an AI eligibility bug**. Do not mistake Swagger availability for an AI service runtime. Apply PLAN FIRST approval rule for 2+ files or sensitive changes. Reproduce first where possible, then patch minimally and test both the failure and affected contracts. Use `node scripts/verify-codex.mjs --scope=ai` (plus isolated DB/Redis tests if configured). State skipped checks. No environment edits, migrations, deployment or unapproved commits.
