# AI Service Foundation

The service currently provides foundation-only health/readiness and an internal,
non-production deterministic mock provider. It does not expose inference or
conversation APIs. External inference remains disabled.

## Local workspace commands

From the repository root, use `npm ci` and then:

```sh
npm run test --workspace=apps/ai-service -- --runInBand
npm run check-types --workspace=apps/ai-service
npm run lint --workspace=apps/ai-service
npm run build --workspace=apps/ai-service
```

Required runtime settings are `NODE_ENV` (`development`, `test`, or `production`),
`AI_PROVIDER=mock`, and a nonempty `AI_POLICY_VERSION` identifier. Optional strict
booleans `AI_ENABLED` and `AI_MOCK_ENABLED` default to false. Production rejects
either flag being true. `AI_SERVICE_PORT` defaults to 4011 (1-65535), and
`AI_REQUEST_TIMEOUT_MS` defaults to 5000 (1-25000). No database or provider
credentials are required. Example foundation-only startup after building:

```sh
NODE_ENV=production AI_PROVIDER=mock AI_POLICY_VERSION=foundation-v1 \
  AI_ENABLED=false AI_MOCK_ENABLED=false npm start --workspace=apps/ai-service
```

`GET /api/health` returns `200 {"status":"ok","service":"ai-service"}`.
`GET /api/ready` returns `200` with `status: "ready"`, `service: "ai-service"`,
and `inferenceAvailable: false`; invalid internal state or shutdown returns 503.
Readiness describes only this foundation, not authentication, persistence,
knowledge retrieval, or real inference. Probes make no external calls.

The global default-deny guard exempts only the exact probe controller, handlers,
GET methods and paths. Registered undeclared routes are denied; unknown routes
remain 404. Identity headers never grant access. Logs use generated correlation
IDs and safe route templates, not bodies, credentials, raw paths, or queries.
The mock runs only internally with both flags enabled in development/test. Its
fixed synthetic output and word-based usage counts are non-billable fixtures,
not real model output or measured provider tokens.

## Local-only Docker validation (B6)

Build from the repository root; do not use the service directory as context:

```sh
docker build --no-cache -f apps/ai-service/Dockerfile -t workphelo-ai-foundation:local .
node apps/ai-service/scripts/verify-container.mjs workphelo-ai-foundation:local
docker run --rm --name workphelo-ai-foundation-local --network none \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=16m --cap-drop ALL \
  --security-opt no-new-privileges \
  -e NODE_ENV=production -e AI_PROVIDER=mock -e AI_POLICY_VERSION=foundation-v1 \
  -e AI_ENABLED=false -e AI_MOCK_ENABLED=false workphelo-ai-foundation:local
```

From another terminal, probe the same container's loopback interface:

```sh
docker exec workphelo-ai-foundation-local node -e "fetch('http://127.0.0.1:4011/api/ready').then(async r => console.log(r.status, await r.json()))"
docker stop --time 5 workphelo-ai-foundation-local
```

Use a unique image/container name if these names already exist. The example
publishes no host ports and disables external networking. The Docker healthcheck
uses container loopback, which remains available with `--network none`.
SIGTERM/SIGINT trigger Nest shutdown hooks. The image runs as the `node` user;
production dependency installation excludes Prisma CLI and development tooling.
No source, local env files, generated Prisma Client, or other applications are
copied into the runtime image. Both hoisted and workspace-local dependencies are
retained. Build-time package downloads are separate from runtime networking.

`Dockerfile.dockerignore` is the effective ignore file for the root-context build;
the service `.dockerignore` mirrors it. Keep them identical. A nested
`.dockerignore` alone would not override the repository-root ignore rules. The
allowlist excludes local secrets, tests, generated files, and other services.
The Node 20 base digest follows this repository's current CI/service major.
Node 20 is now [upstream end-of-life](https://nodejs.org/en/about/eol); this is
an inherited platform risk, not production security approval. A separately
approved runtime/dependency uplift is required before production rollout.

The optional verification script requires a local Docker daemon. It creates only
uniquely named disposable containers, uses no external network or published
ports, checks production safety and both shutdown signals, and removes only the
container IDs it created. It does not build, publish, delete the supplied image,
or touch unrelated Docker resources. Remove your test image separately when done.

## Prisma configuration (B5)

The service reserves ownership of PostgreSQL schema `ai`. The model-free
`prisma/schema.prisma` follows the repository's Prisma 5.22.0 multi-schema
conventions and declares future client output at `prisma/generated/client`.
Declaring this datasource does not create the database schema.

Prisma is an explicit development dependency for validation only. No Prisma
Client dependency, service, repository, connection, model, or migration is
introduced. Application startup, build, tests, health, and readiness do not
require `DATABASE_URL` or initialize a database connection.

From the repository root, validate with a deliberately non-secret placeholder:

```sh
DATABASE_URL='postgresql://placeholder:placeholder@127.0.0.1:1/placeholder?schema=ai' \
  npm run db:validate --workspace=apps/ai-service
```

Validation checks schema configuration; it does not inspect or modify a database.
Do not substitute a shared DEV/PROD connection for this foundation check.

Client generation is deferred until actual persistence models are introduced.
The installed Prisma 5.22.0 CLI rejects zero models by default during generation.
Its optional `--allow-no-models` path is deliberately not used in this foundation.
There is intentionally no `db:generate`, migration script, or automatic
prebuild/pretest Prisma hook. Do not add placeholder models, generate an empty
client, or auto-install `@prisma/client` to make the foundation appear complete.

## Future persistence (not implemented)

Later approved work will add conversations, messages, request receipts, usage,
budget buckets, audit events, and approved knowledge versions/chunks under this
service's `ai` schema. Tenant/user ownership constraints, composite indexes,
idempotency constraints, and migration SQL belong with those concrete models in
`prisma/schema.prisma` and `prisma/migrations/`.

Conversation history retention is approved at 30 days. Audit/receipt retention
and backup-erasure policies remain unresolved; no defaults are assigned here.
Persistence and deployment require separate approval. Phase 1 has no Gateway or
Auth integration, careers-session filtering, conversation APIs/storage/deletion
jobs, encrypted messages, knowledge retrieval, sensitive-input screening,
usage/budget persistence, provider SDKs, tools, business-record reads/writes,
frontend, or Compose/deployment wiring. None of those capabilities is implied
by a healthy container.

Phase 2 requires separate implementation approval, a fresh verified development
baseline, trusted current-state authentication and ownership policy, and
reviewed persistence/encryption/migration design. Before any external inference,
provider terms, data handling, sensitive-input controls, and numerical spend
budgets must be approved. Conversation retention is 30 days; the unresolved
audit/receipt and backup policies above remain release gates for their records.
