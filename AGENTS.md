# AGENTS.md — WorkPhelo ERP (Codex repository instructions)

Applies to the whole `Datrix-Tech-Solutions/work-phelo` repository. Read nested AGENTS.md files if they exist. Preserve existing interfaces and deployment behavior unless the task explicitly authorizes changes. Prefer the smallest reviewable patch.

## Operating protocol: PLAN FIRST

**Before modifying 2 or more files**, or **before touching any sensitive area even if it is only one file**, first respond with a compact plan (goal, exact files, dependency/interface impact, tests, risks/rollback). **STOP and wait for explicit user approval before editing.** Do not interpret an initial feature request as approval to skip this gate. Sensitive areas include authentication/authorization, tenant isolation, JWT/cookies, Gateway signing/proxying, AI request integrity, encryption or key rotation, Prisma schemas/migrations/seeds, database data, `.env*`/secrets, CI/CD, Docker/Compose, deployment scripts, infrastructure, production flags, payment/payroll, and any live API contract. For a one-file non-sensitive bugfix, describe the root cause and make the smallest change; still ask if behavior or scope is ambiguous. After approval, implement only the approved scope; re-plan for scope expansion.

**At the start of each task:** check `git status --short`, current branch and recent target changes; locate relevant code/tests; list assumptions and risks. Do not reset/clean/stash/overwrite unrelated work. The developer has had unrelated `apps/auth-service/README.md` edits and multiple stashes: inspect and preserve _whatever currently exists_, rather than assuming an exact stash count. Do not commit, push, open/merge PRs, deploy, modify GitHub settings or run remote operations without explicit authorization.

## Verified stack and tooling

- Root: Node.js **20** in CI (`engines >=20`), **npm 11.10.0** declared package manager (`engines >=10`), **npm workspaces**, **Turborepo 2**, TypeScript **5.9.2** root, NestJS **10**, Express, Jest **29** + ts-jest, ESLint, Prettier 3, Husky; JavaScript verification scripts use Node (`.mjs`/`.cjs`). **Do not use pnpm, yarn or Nx**; no `pnpm-workspace.yaml` or `nx.json` exists.
- Service-specific TypeScript and Prisma versions may differ: AI pins Prisma **5.22.0** and `@prisma/client` 5.22.0; do not bulk-upgrade versions. PostgreSQL (multi-tenant `tenantId`, service schemas), Redis, RabbitMQ, Docker Compose, Nginx reverse proxy and GitHub Actions/GHCR are used where configured.
- Backend conventions: NestJS modules/controllers/services, DTOs with `class-validator` / `class-transformer`, Prisma generated clients, permission/tenant guards, internal-auth helpers, Swagger/OpenAPI, Jest `*.spec.ts` and isolated integration tests. Gateway uses `http-proxy-middleware`, JWT/cookie auth, Swagger, Redis admission; AI has crypto/request-integrity and mock provider abstraction.
- Frontend is a **separate nested npm install** at `apps/web/work-phelo-web`: Next.js **16**, React **19**, TypeScript, Tailwind CSS **4**, React Query, Zustand, MUI, Axios; run its commands from that directory, not root workspaces. Its `prebuild` copies a MapLibre worker; do not remove or hand-edit that generated worker.

## Actual layout

```
work-phelo/
  package.json                # npm workspaces + Turbo scripts
  package-lock.json
  turbo.json
  apps/
    api-gateway/             # :4000 local; :4010 deployed DEV host
    auth-service/            # :4001
    hr-service/              # :4002
    notification-service/    # :4004
    subscription-service/    # :4005
    marketing-service/       # :4006
    reinsurance-service/     # :4007
    accounting-service/      # :4008
    inventory-service/       # :4009
    ai-service/              # internal :4011 on DEV
      src/{auth,common,config,conversations,eligibility,encryption,health,inference,persistence,request-integrity,security}/
      prisma/{schema.prisma,migrations}/
      scripts/verify-shared-resource-tests.cjs
      INTERNAL_DEMO_HANDOFF.md
      DEV_DEPLOYMENT.md
    web/work-phelo-web/       # separate Next.js/npm project and package-lock
  packages/{config,internal-auth,payroll-engine,schemas,types,utils}/
  infrastructure/docker-compose.dev.yml
  .github/workflows/{ci.yml,deploy-dev.yml}
  .github/scripts/{deploy-dev.sh,deploy-common.sh}
  scripts/{check-rbac-alignment.mjs,sync-payroll-engine.mjs}
```

## Exact verified commands (run from repository root unless stated)

```bash
npm ci
npm run check-types
npm run lint
npm run test
npm run build
npm run check-rbac
npm run check-payroll-engine
npm run db:validate --workspace=apps/ai-service
npm run test --workspace=apps/ai-service -- --runInBand
npm run test --workspace=apps/api-gateway -- --runInBand
npm run check-types --workspace=apps/ai-service
npm run check-types --workspace=apps/api-gateway
npm run lint --workspace=apps/ai-service
npm run lint --workspace=apps/api-gateway
npm run dev --workspace=apps/ai-service
npm run dev --workspace=apps/api-gateway
# Separate frontend install and verification:
cd apps/web/work-phelo-web && npm ci && npm run lint && npm run build
```

The root `test`, `lint`, `check-types` and `build` commands are Turbo commands, and `check-types` / `lint` depend on builds. AI pretest/precheck-types generate its Prisma client (generation is **not** a migration). The root `test` is **not the full real Redis/PostgreSQL integration suite** and the Next.js app is not in the root workspaces. For a unified ordinary check, use `node scripts/verify-codex.mjs` (provided alongside this file); use `--scope=ai` for AI + Gateway and `--web` to include the separately installed web project. A full CI-parity claim additionally requires the dedicated real-dependency suite in isolated disposable infrastructure.

**Only with a disposable PostgreSQL database and Redis configured as in `.github/workflows/ci.yml`**, CI's dedicated AI resource runner performs:

```bash
npm run build --workspace=@work-phelo/config
node apps/ai-service/scripts/verify-shared-resource-tests.cjs
```

It expects isolated `AI_TEST_DATABASE_URL` and `AI_TEST_ADMISSION_REDIS_URL`, a prepared disposable schema with AI migrations, and Redis `noeviction` / fixed `maxmemory`. Never point it to DEV/PROD/shared data. Its zero-skip requirement is distinct from regular Jest runs. If dependencies aren't available, label those checks **NOT RUN**, not passed.

## Backend rules — never regress these

1. **Tenant security:** derive tenant/user identity from verified Auth + Gateway context, never request body/query/headers supplied by browsers. Authenticated tenant eligibility is not a blanket permission for inference. Reject careers-scoped, suspended, revoked or stale sessions; guard membership, resource ownership and permissions server-side. Avoid N+1 Auth calls and filter before pagination where required.
2. **Gateway/AI proof boundary:** Gateway verifies JWT/session **and fresh Auth current state**, strips spoofable internal headers, and signs a tenant/user-bound assertion. AI validates it; direct `x-gateway-*` or forged client identity must never work. Conversation operations have separate signed request proof, nonce/replay controls and `demoIntent` bound to server-side Gateway configuration. Check mode mismatch before persistence/nonce consumption. Never let a browser set demo mode or proof headers. Keep Gateway and AI compatible when changing proof schemas.
3. **DEV flags:** deployed AI is **eligibility-only**: `AI_AUTHENTICATED_ROUTES_ENABLED=true`, all other AI execution `*_ENABLED` flags false, `AI_PROVIDER=mock`, `NODE_ENV=production`. `AI_SERVICE_URL=http://ai-service:4011` is internal. `GET /api/v1/ai/eligibility` may return `{eligible:true,inferenceAvailable:false}`; conversation endpoints should return 503, not generate chat. Do not enable demo, persistence, cleanup, external inference or install provider credentials without separate written approval.
4. **Conversation privacy:** owner/tenant isolation, encrypted AES-256-GCM stored content, key-version/fingerprint handling, 30-day TTL, storage quotas, Redis admission, and per-operation idempotency must remain intact. For committed retries return **the exact stored IDs/timestamps/reply**, never regenerate a mock reply or call a future provider. For lost responses reuse the **same `Idempotency-Key`, input and operation**. Enforce atomic USER + DEMO_ASSISTANT inserts in scripted mode, sequence order and stable cursor pagination. Keep no-store and sanitize failures.
5. **Bounded work:** Redis and PostgreSQL admission/quota/retention operations must remain bounded, race-safe and fail closed. No silent test skips, best-effort authorization, unbounded retries or replay side effects. Handle `409` conflicts/quota, `429` retry-after, and `503` disabled/dependency failures explicitly.
6. **Sensitive content:** there is no approved external inference or broad ERP retrieval. Only approved non-sensitive product guidance may eventually be sent to an approved provider after terms/data handling/budget/signoff. Reject uncertain/sensitive free-text input fail-closed. Never leak tenant records, secrets, payroll, HR PII or logs to an LLM.
7. **Swagger/API compatibility:** Gateway owns AI Swagger UI `/api/v1/ai/docs` and JSON `/api/v1/ai/docs-json`, reusing root `/docs` definitions (not a second AI Swagger server). The public six AI endpoints are `/api/v1/ai/eligibility`, conversations create/list/detail, append message, delete. Keep OpenAPI and `apps/ai-service/INTERNAL_DEMO_HANDOFF.md` aligned. Cookie calls use `credentials:'include'`, exact configured Origin, and durable idempotency keys. Never display untrusted content as HTML.
8. **Prisma & shared DB:** schema per domain; include `tenantId` constraints and proper normalized uniqueness. Never run `prisma migrate dev`, `migrate deploy`, `db push`, reset, seed, ad hoc writes or data backfills against any shared environment without explicit authorization. Add migrations, do not edit applied migrations. `db:generate` and `db:validate` are safe non-mutating operations; verify database target before any migration. AI migrations are **not** part of current DEV deployment.
9. **GitHub Actions / deploy gotchas:** Current DEV pipeline is intentionally the historical `64b410cd2b0a52c727bd15b490b1a9e7fc2da061` pattern plus minimal AI wiring (PR #820). Do **not** reintroduce PR #816's exact-SHA approval gate/planner or silently change concurrency or path filters. Existing `dorny/paths-filter@v4` implicit baseline compares with default `main`, which can build more images than expected; `cancel-in-progress` and shared staging have known partial-rollout risks. Deployment still runs **eight non-AI Prisma migration commands and Auth/HR seeds** (Auth can update admin credentials/status/permissions; HR can relink demo data). Treat merge into `dev` as deployment-impacting and request approval first. Never assume green CI means live migrations/seeds are safe. SHA _tags_ are not digest pinning.
10. **Clean CI gotchas:** build `@work-phelo/config` before isolated Gateway/AI runtime integration tests on a fresh checkout. Preserve Next.js MapLibre worker copy step. Do not report passing tests that were skipped; distinguish local mocked tests, real PostgreSQL/Redis integration, browser login acceptance and live deployment evidence. No secret values in stdout, commits, PRs or diagnostics.

## Testing and done criteria

- Add a regression test demonstrating the original failure before fixing it when feasible. Test success, invalid auth/tenant, retries/replays, disabled flags, and negative paths. Prefer existing Jest/Supertest conventions and real-dependency suites where relevant.
- Run smallest impacted tests first; then `node scripts/verify-codex.mjs --scope=ai` for AI/Gateway, or `node scripts/verify-codex.mjs` for root verification. For frontend changes also use `--web` (requires separate web `npm ci`). For cross-cutting/CI-sensitive changes run CI-equivalent checks and report resource tests separately.
- Report files changed; tests run and actual outcomes; any skipped or not-run checks; API/migration/deployment implications; rollback considerations. Never claim changes deployed or data migrated unless independently verified.
- End after implementation with a concise diff summary; **do not** push/merge/deploy without user authorization.
