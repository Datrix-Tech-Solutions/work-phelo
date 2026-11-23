# WorkPhelo ERP

WorkPhelo is a multi-tenant ERP platform built as a NestJS + Next.js
monorepo. The current product surface covers platform authentication, HR,
notifications, scaffolded subscription/marketing services, broker-focused
Reinsurance Operations and standalone Accounting.

The repository is managed with npm workspaces and Turborepo.

## Environments

| Environment    | Frontend                                              | API Gateway                            | Notes                      |
| -------------- | ----------------------------------------------------- | -------------------------------------- | -------------------------- |
| Local          | `http://localhost:3000`                               | `http://localhost:4000/api/v1`         | Developer machine          |
| Development    | `https://dev-app.workphelo.com`                       | `https://dev-api.workphelo.com/api/v1` | Auto-deployed from `dev`   |
| Production app | `https://app.workphelo.com`                           | `https://api.workphelo.com/api/v1`     | Deployed from `prod`       |
| Public landing | `https://workphelo.com` / `https://www.workphelo.com` | n/a                                    | Vercel-managed public site |

Legacy IP-based URLs and `workphelo.com/api/v1` are retired. Do not use them
in new examples, generated links or documentation.

## Monorepo Structure

```text
work-phelo/
├── apps/
│   ├── api-gateway/
│   ├── auth-service/
│   ├── hr-service/
│   ├── notification-service/
│   ├── subscription-service/
│   ├── marketing-service/
│   ├── reinsurance-service/
│   ├── accounting-service/
│   ├── inventory-service/
│   └── web/
│       └── work-phelo-web/
├── packages/
│   ├── config/
│   ├── schemas/
│   ├── types/
│   └── utils/
└── infrastructure/
```

## Services and Ports

| Service              | Local port | Gateway prefix                     | Dev deploy | Prod deploy          |
| -------------------- | ---------: | ---------------------------------- | ---------- | -------------------- |
| API Gateway          |     `4000` | `/api/v1/*`                        | Yes        | Yes                  |
| Auth Service         |     `4001` | `/api/v1/auth/*`                   | Yes        | Yes                  |
| HR Service           |     `4002` | `/api/v1/hr/*`                     | Yes        | Yes                  |
| Notification Service |     `4004` | `/api/v1/notification/*`           | Yes        | Yes                  |
| Subscription Service |     `4005` | `/api/v1/subscription/*`           | Yes        | Candidate (scaffold) |
| Marketing Service    |     `4006` | `/api/v1/marketing/*`              | Yes        | Candidate            |
| Reinsurance Service  |     `4007` | `/api/v1/operations/reinsurance/*` | Yes        | Yes                  |
| Accounting Service   |     `4008` | `/api/v1/accounting/*`             | Yes        | Candidate            |
| Inventory Service    |     `4009` | `/api/v1/operations/inventory/*`   | Yes        | Candidate            |
| Web app              |     `3000` | same-origin `/api/v1/*`            | Yes        | Yes                  |

Production exposure is intentionally narrower than development. Check
[`infrastructure/docker-compose.prod.yml`](infrastructure/docker-compose.prod.yml)
before planning any production release.

## Deployment Capacity Hardening

Development and production deployments run a remote host preflight before SCP
uploads deployment assets. The preflight checks root filesystem capacity, Docker
daemon health, Docker Compose availability, deployment target writability and
required host utilities. The default minimum free space is `15 GiB`, configured
with the non-secret `DEPLOY_MIN_FREE_GIB` workflow environment value.

After a successful rollout and health verification, deploy scripts run
reference-aware WorkPhelo image cleanup. Successful deployments record
environment-specific image history in `.deploy-image-history.dev` or
`.deploy-image-history.prod` using `timestamp<TAB>service<TAB>image_ref` rows.
The cleanup protects every image ID referenced by any container on the shared
Docker host, including stopped dev and production containers. It also protects
current compose image refs and the current plus previous two successful SHA
image refs per service for both dev and production. It only targets old unused
SHA-tagged images under `ghcr.io/datrix-tech-solutions/work-phelo/*` and keeps
non-SHA tags such as `dev` and `prod`.

The deploy scripts never prune Docker volumes and never delete Docker filesystem
internals directly. For emergency disk inspection use:

```bash
df -h /
docker system df
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
docker image ls 'ghcr.io/datrix-tech-solutions/work-phelo/*'
docker builder du
```

Do not run broad destructive cleanup commands such as
`docker system prune -a --volumes`, `docker volume prune` or direct removal
under `/var/lib/docker`.

The Compose files currently do not define container log rotation. Host-level
hardening should be handled separately through approved server management:
Docker log rotation, journald caps, external disk monitoring and alerts, SSH key
hardening, firewall review, automatic security updates and backup/restore
verification.

## Architecture Principles

- Each backend service owns its schema, migrations, API contracts and business
  boundaries.
- Auth owns tenants, users, RBAC, permissions and tenant branding/document
  profile metadata.
- Accounting remains independently usable for manual journals, chart of
  accounts, fiscal periods, reports, posting rules and source-event processing.
- Operational modules may integrate with Accounting through source events,
  transactional outboxes, signed internal transport, idempotency and posting
  rules; this is optional and must not make Accounting depend on a source
  module.
- Reinsurance owns broker operational facts. Accounting owns financial
  confirmation, posting rules, journal creation and reconciliation.
- Browser code should call same-origin `/api/v1/...`; the frontend proxy and
  gateway route requests to services.

## Setup

### Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop or compatible Docker runtime
- PostgreSQL 16
- Redis and RabbitMQ for local integration flows

### Install

```bash
npm install
```

### Start Local Infrastructure

```bash
npm run dev:infra
```

This starts Redis and RabbitMQ from
[`infrastructure/docker-compose.dev.yml`](infrastructure/docker-compose.dev.yml).
PostgreSQL is expected through service `DATABASE_URL` values.

### Environment Configuration

Each service reads its own `.env`/`.env.dev` file. Never commit real secret
values.

Common variables:

| Variable                                                  | Services                                        | Purpose                                                                                    | Secret                         |
| --------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------ |
| `DATABASE_URL`                                            | Auth, HR, Notification, Reinsurance, Accounting | Service-owned PostgreSQL schema connection                                                 | Yes                            |
| `JWT_SECRET` / `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Gateway/Auth/services                           | JWT verification and issuing                                                               | Yes                            |
| `RABBITMQ_URL`                                            | Auth, HR, Notification, Reinsurance             | Async messaging                                                                            | Yes                            |
| `REDIS_URL`                                               | HR and cache/session infrastructure             | Redis connection                                                                           | Yes                            |
| `ALLOWED_ORIGINS`                                         | Gateway/Auth/HR                                 | CORS allow-list                                                                            | No                             |
| `FRONTEND_BASE_URL` / `APP_URL` / `FRONTEND_URL`          | Auth/HR/Notification                            | Generated application links                                                                | No                             |
| `ENABLE_SWAGGER`                                          | Backend services                                | Explicitly enables Swagger                                                                 | No                             |
| `DEPLOY_ENV`                                              | Backend services                                | Enables dev/prod Swagger defaults                                                          | No                             |
| `INTERNAL_SERVICE_AUTH_SECRET`                            | Auth, Accounting, Reinsurance integrations      | HMAC signing for internal calls                                                            | Yes                            |
| `ACCOUNTING_SERVICE_URL`                                  | Gateway, Reinsurance                            | Optional Accounting route/integration target                                               | No                             |
| `AUTH_SERVICE_URL`                                        | Gateway, Reinsurance document profile client    | Auth routing and profile lookups                                                           | No                             |
| `REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_*`              | Reinsurance                                     | Optional outbox dispatcher enabled, interval, batch, timeout, retry delay and max attempts | No                             |
| `REINSURANCE_DOCUMENT_S3_*`                               | Reinsurance                                     | Private document storage                                                                   | Yes where credentials are used |
| `REINSURANCE_MAILBOX_TOKEN_ENCRYPTION_KEY`                | Reinsurance                                     | Mailbox token encryption                                                                   | Yes                            |
| `SMS_PROVIDER`, `TERMII_*`, `PILOSMS_*`                   | Notification                                    | SMS provider selection and credentials                                                     | Yes for API keys               |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`                     | Notification                                    | Email provider                                                                             | Yes for API key                |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_BASE_URL`         | Web                                             | Browser-visible API/app base URLs                                                          | No                             |

The outbox dispatcher variables currently supported by Reinsurance are:
`REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_ENABLED`,
`REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_POLL_INTERVAL_MS`,
`REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_BATCH_SIZE`,
`REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_PROCESSING_TIMEOUT_MS`,
`REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_RETRY_DELAY_MS` and
`REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_MAX_ATTEMPTS`.

## Database and Prisma

Generate Prisma clients:

```bash
npm run db:generate:all
```

Run migrations service-by-service when needed:

```bash
npm run db:migrate --workspace=apps/auth-service
npm run db:migrate --workspace=apps/hr-service
npm run db:migrate --workspace=apps/reinsurance-service
npm run db:migrate --workspace=apps/accounting-service
```

Subscription has no Prisma application models and its generation script no-ops.
Marketing and Inventory own separate Prisma schemas and migration histories.

## Running Locally

```bash
# all workspace dev scripts
npm run dev

# selected services
npm run dev:gateway
npm run dev:auth
npm run dev:hr
npm run dev:notify
npm run dev:reinsurance
npm run dev:accounting

# frontend
cd apps/web/work-phelo-web
npm run dev
```

The API Gateway needs the downstream service URL variables for any service you
want to reach. Missing optional downstreams return controlled service
configuration errors instead of silently routing elsewhere.

## Swagger/OpenAPI

Swagger is enabled by default outside production unless disabled by environment
configuration. Production Swagger should remain disabled unless explicitly
opened for a controlled support window.

| Service      | Local Swagger                    | Dev Swagger                                                        |
| ------------ | -------------------------------- | ------------------------------------------------------------------ |
| API Gateway  | `http://localhost:4000/docs`     | `https://dev-api.workphelo.com/docs`                               |
| Auth         | `http://localhost:4001/docs`     | `https://dev-api.workphelo.com/api/v1/auth/docs`                   |
| HR           | `http://localhost:4002/docs`     | `https://dev-api.workphelo.com/api/v1/hr/docs`                     |
| Notification | `http://localhost:4004/api/docs` | `https://dev-api.workphelo.com/api/v1/notification/docs`           |
| Subscription | `http://localhost:4005/api/docs` | `https://dev-api.workphelo.com/api/v1/subscription/docs`           |
| Marketing    | `http://localhost:4006/api/docs` | `https://dev-api.workphelo.com/api/v1/marketing/docs`              |
| Reinsurance  | `http://localhost:4007/api/docs` | `https://dev-api.workphelo.com/api/v1/operations/reinsurance/docs` |
| Accounting   | `http://localhost:4008/api/docs` | `https://dev-api.workphelo.com/api/v1/accounting/docs`             |

## Validation

Common checks:

```bash
npm run lint
npm run check-types
npm run build
npm run test
npm run check-rbac
git diff --check
```

Service-focused examples:

```bash
npm run test --workspace=apps/reinsurance-service
npm run lint --workspace=apps/accounting-service
npm run db:validate --workspace=apps/reinsurance-service
```

Web checks:

```bash
cd apps/web/work-phelo-web
npm run lint
npx tsc --noEmit
npm run build
```

## Deployment

| Branch | Workflow                            | Target                  |
| ------ | ----------------------------------- | ----------------------- |
| `dev`  | `.github/workflows/deploy-dev.yml`  | Development environment |
| `prod` | `.github/workflows/deploy-prod.yml` | Production environment  |

Do not merge directly to `prod` casually. Production changes require an
explicit release plan, migration review, environment review and rollback notes.

### Production Startup and Migration Safeguards

The original resilience implementation was based on DEV and carried the current
PROD deployment assets forward. This scoped production backport is based on PROD;
it does not promote unrelated DEV application code.
Promote only the reviewed fix against the current production implementation;
Accounting/Marketing activation policy must remain explicit and unchanged.

Auth permission reconciliation is now an explicit operator command rather than
HTTP startup work; see `apps/auth-service/README.md`. `/health` on Next.js is a
public, lightweight, direct HTTP 200 with no authentication redirect. Other
routes retain authentication. Production probes reject redirects.

Production deployments are serialized both by GitHub concurrency and a host
`flock`. Application images must be immutable SHA tags/digests. Compose config
hashes select changed/not-running services; unchanged running containers are
not restarted. Gateway/Next.js no longer wait for every backend to be healthy
before they can start. All service health and reachability checks still have
to pass before staged configuration and successful image history are published.
The existing 120-second health bound is retained, including bounded recovery
from a temporary unhealthy state. This is not a readiness bypass.

#### Approved Migration Plan

`.github/scripts/production-migrations.mjs` runs before application rollout in
candidate service images with their service-specific environment, without
starting application providers, schedulers or consumers. Order and schemas are:
Auth `w_auth`, HR `hr`, Notification `notify`, Reinsurance `reinsurance`, Accounting
`accounting`, Marketing `marketing`, Inventory `inventory`. Subscription has no
migration stage. AI is excluded.

Two new **production Actions variables** are required:

- `PROD_MIGRATION_PLAN_FILE`: absolute path to a privately provisioned, reviewed
  JSON plan on the deployment host (not an environment file or secret dump).
- `PROD_MIGRATION_PLAN_SHA256`: SHA-256 of the approved exact plan bytes.

No new credential secret is introduced. Existing service database secrets remain
inside service env files. The workflow also requires the `prod` GitHub Environment
to have required reviewers and its token to be able to read that environment's
protection metadata. Missing variables, metadata access or required reviewers
fail closed. At implementation-time inspection, both new variables and required
reviewers were absent; configuring them is a separate authorized operator action.
No GitHub environment settings were changed by this implementation.

The deploy job requests only `contents: read`, `packages: read` and `actions: read`.
The last permission permits the Get Environment API metadata check; no admin-write
token or new PAT is required. Configuring protection rules is a separate repository
administrator operation. Normal protected-environment deployment approval still
applies to every release. A zero-pending deployment reuses the existing pinned
schema baseline without new migration-specific approval, backup or release/expiry
binding. It does not accept an absent baseline, because that would silently bless
unknown schema drift. Initial baseline adoption therefore remains an explicit gate.

Permission reference: [Get an environment API](https://docs.github.com/en/rest/deployments/environments#get-an-environment).

Version 1 plan fields (repeat the service entry for all seven services):

```text
version: 1
approvalRef: approved change/review reference
releaseSha: exact 40-character candidate SHA
expiresAt: operator-approved expiry for pending DDL
backup:
  reference: actual recoverable backup reference
  verificationRef: evidence that the backup completed and is usable
  restoreTestRef: isolated restore verification evidence
  releaseSha: exact candidate SHA
  serviceScopes: databaseScopeHash values covered by this backup
  verifiedAt: ISO timestamp
  validUntil: operator-approved recovery evidence expiry
services:
  inventory-service:
    schema: inventory
    postgresMajor: actual server major
    databaseScopeHash: inspected host/port/database/schema fingerprint
    snapshotEvidenceRef: trusted schema-prefix replay/restore evidence
    compatibilityEvidenceRef: old/new application compatibility test evidence
    fromMigrations: ordered list of {name, checksum} before pending DDL
    targetMigrations: ordered list of {name, checksum} in candidate image
    beforeDigest: trusted pre-DDL catalog fingerprint
    afterDigest: trusted expected post-DDL catalog fingerprint
    backwardCompatible: true
    destructiveApprovalRef: required when pending SQL is classified high-risk
```

This is an **operator attestation gate**, not an integration with a backup
provider API. Reviewers must verify the referenced backup, restore and binary
compatibility evidence before approving plan bytes. Placeholder references do
not prove recovery. Database scope hashes exclude credentials, but plan/evidence
files still belong in restricted operator storage. Choose backup freshness and
approval expiry under the production recovery policy; the code does not invent
a retention/RPO policy. A schema fingerprint must come from trusted migration
replay or a verified restore, not merely blessing whatever happens to be live.

For inspection, invoke the runner inside the intended service image with its
existing secure env and working directory, setting `MIGRATION_SERVICE`:
`node /mounted/production-migrations.mjs --manifest` lists immutable SQL checksums;
`--inspect` reads catalog/history metadata only. Neither runs DDL. Do not paste
database URLs into shell history. These commands are operator procedures, not
permission to inspect production in an unapproved session.

Execution requires `--execute`, the pinned plan and a database advisory lock.
It rejects unknown/non-prefix/failed/duplicate histories, changed checksums,
wrong schema/search path, engine/scope mismatches and catalog drift. It verifies
tables, columns/defaults, constraints, indexes, enums, views, triggers, routines,
sequence definitions and RLS policies, not business data. It does not claim to
audit every possible PostgreSQL object, privileges, extensions or external
service state. Conservative SQL classification requires extra review for
potentially destructive statements; it is not a SQL safety proof.

Only pending migrations are passed to native `prisma migrate deploy`. Final
history/fingerprint and native `prisma migrate status` are checked. Existing
complete schemas use the approved target baseline without rerunning DDL or
requiring a fresh backup; pending DDL requires release-bound unexpired approval,
backup evidence and backward compatibility. Unknown drift never causes an
automatic baseline, seed, reset, `db push`, resolve or repair.

The existing 124 Accounting/Marketing/Inventory migrations and Inventory's
rolled-back max-stock attempt must remain unchanged. SQL bytes are immutable.
Fresh-environment testing replays the original Inventory SQL using the correct
`schema=inventory` Prisma connection/search path. An existing failed/untracked
history requires separately reviewed manual reconciliation, not invented
successful records. No migration files were changed in this fix.

#### Failure and Recovery Procedure

1. Before pending DDL, verify a real backup and isolated restore; test the old
   running binaries and candidate against the expected resulting schema.
2. Provision the approved plan securely, configure its pinned Actions variables
   and environment reviewers, then approve only the exact release/evidence.
3. On failure, stop competing deployments. Inspect private
   `.deployment-state.prod`, its candidate path and rollback-config path. Logs
   expose state/health/exit metadata, not raw app logs, env values or health
   command output. Inspect detailed errors privately with credential redaction.
4. If migration fails, application rollout has not started. Inspect history and
   actual schema; some DDL may already have committed. Never automatically
   resolve/reset/replay or assume transaction rollback undid native migrations.
5. If DDL succeeds but rollout fails, canonical configuration/history are not
   published as successful. Existing private config snapshots are retained.
   Restore only reviewed application images/config compatible with the new
   schema, or finish rollout from the verified candidate. Database restore is a
   separate approved recovery action and can lose writes since backup.
6. Interrupted publication is recorded as failed; compare all canonical files
   with the retained candidate/snapshot before resuming. Multi-file publication
   is not a filesystem-wide atomic transaction. Do not prune recovery snapshots
   until the release is verified.

Breaking DDL is refused by this rolling-deploy path; use an approved maintenance
or expand/contract plan instead. Local tests use disposable PostgreSQL only.
First validate startup, reconciliation dry-run, fresh/history/no-op migrations,
lock/backup/drift failures, redirected health rejection and partial deployment
in DEV/staging. Production adoption requires its own reviewed baseline plan and
backup/restore evidence. No production migrations, seeds, permission changes,
activation flags, containers or secrets were modified by these local checks.

#### Final Adoption Review (2026-11-23)

Fetched DEV remains `597e87f420f6820fb331652c70713b57d84e2d02`; PROD remains the
deployed `4e65c3f08da105c0e636ebe2e7c16cd032d8618e`. The original implementation
branch is based on DEV, which is 208 commits ahead and 20 behind PROD. This
production branch instead starts directly from that PROD baseline and contains
only the scoped backport. No DEV merge or automatic rebase occurred.

The production release needs a fresh PROD-based branch containing only the
reviewed resilience patch. A disposable scoped backport applied cleanly, passed
351 Auth tests and built an Auth image for Linux/AMD64. Its source preserves
PROD's older Auth/HR/Notification contracts, guarded Accounting/Marketing
activation, credential-safe Docker contexts, Gateway routes and Subscription
shutdown behavior. The fix changes no Gateway routing or domain-service code.
All eleven Compose services, ports, env-file paths, networks and existing workflow
env sources were compared against PROD; only the reviewed startup/health behavior
and two new plan variables differ. Do not replace PROD application directories,
package manifests or lockfiles with their full DEV versions.

Migration directory counts are Auth 35/32, HR 91/77, Notification 17/16 for
DEV/PROD respectively; Reinsurance 47, Accounting 65, Marketing 40 and Inventory
19 match. These are repository counts, not a fresh live database inventory.
The extra DEV migrations are not part of this release. Build a production plan
from the actual retained production image manifests, not DEV's larger histories.

DEV/staging validation should first exercise Auth startup/new tenant/invite
baseline assignment and direct Next health, then the migration runner using
disposable databases and production-like staged/canonical config directories.
After review, make the narrow PROD-based release PR, provision the approved
baseline/backup evidence and required reviewers, and let the approved production
pipeline run only after separate merge/deployment authorization. Forward-port
the common Auth/health fixes to DEV without using a whole-DEV production merge.

Local validation includes native Prisma additive migration execution with
existing-row preservation; seven independent schema histories unchanged during
zero-pending verification; retained rolled-back attempts; drift/lock/backup/plan
failures; and real Auth tenant-scoped repeat, concurrent-lock and rollback/resume
cases. Run database tests only against an owned disposable fixture named
`resilience_fixture` on loopback, with user `fixture`, after building Auth and
generating the Inventory client. The test creates random databases inside that
fixture; remove the owned fixture container/volume afterward, not shared schemas.
Set `MIGRATION_TEST_DATABASE_URL` securely and run
`node --test .github/scripts/production-migrations.database.spec.mjs`.
The other safety checks use `node --test .github/scripts/production-migrations.spec.mjs .github/scripts/deploy-prod-safety.spec.mjs apps/web/work-phelo-web/scripts/health-route.spec.mjs`.

Original DEV-based local evidence: forced root build 16/16 tasks, typecheck 32/32, lint 32/32
(existing warnings, no errors), and tests 18/18 tasks, all with zero cache hits.
Root tests passed 5,370 cases with 198 database-dependent AI/Inventory skips;
the separate adoption PostgreSQL suite passed 11 tests with no skips. Safety
tests passed 34 cases. DEV-based Auth passed 416 tests; the scoped PROD backport
passed 351. Both Auth candidates built clean Linux/AMD64 images, and the PROD
image contained the generated Prisma client/compiled reconciliation command with
no startup backfill hook. Root validation reused local dependency installations;
the image builds used clean npm installations. Only Auth Docker images were
rebuilt; other backend builds passed through the root graph. The frontend is
not in that graph; its preceding webpack build and direct-health HTTP smoke
passed separately. No live GitHub workflow/deployment was triggered to validate
the narrowed workflow token, and no full-stack container smoke is claimed.

The actual PROD-based handoff was revalidated separately: forced serialized root
tests passed 4,182 cases with 112 optional Inventory database skips, 17/17 tasks,
zero cache hits. Its 11 disposable PostgreSQL adoption tests and 34 safety tests
passed. PROD's smaller test graph is intentional: unrelated DEV application
features and migrations are not included. Initial host harness attempts exposed
a borrowed DEV payroll-engine build and a concurrent Prisma-generation/test race;
workspace dependency resolution was isolated and the successful final test pass
was serialized, without changing application code or weakening assertions.

Required review still includes a real production restore/compatibility exercise,
the first trusted baseline plan, environment protection and a workflow run proving
the narrowed token permission in GitHub. No live database or full eleven-service
container-stack test was performed. Backup references are attestations, not
automatic provider verification. A separate local Auth README contains
credential-bearing text outside this worktree; it is excluded, must not be staged,
and requires owner-led credential rotation/exposure review. No credentials or
secret hashes belong in review evidence.

Intended patch inventory (19 files; no schema or migration SQL changes):

```text
.github/scripts/deploy-common.sh
.github/scripts/deploy-prod.sh
.github/scripts/deploy-prod-safety.spec.mjs
.github/scripts/production-migrations.mjs
.github/scripts/production-migrations.spec.mjs
.github/scripts/production-migrations.database.spec.mjs
.github/workflows/ci.yml
.github/workflows/deploy-prod.yml
infrastructure/docker-compose.prod.yml
README.md
apps/auth-service/README.md
apps/auth-service/package.json
apps/auth-service/src/permissions/system-permission-backfill.service.ts
apps/auth-service/src/permissions/system-permission-backfill.service.spec.ts
apps/auth-service/src/permissions/system-permission-sets.ts
apps/auth-service/src/scripts/reconcile-system-permissions.ts
apps/web/work-phelo-web/src/middleware.ts
apps/web/work-phelo-web/src/app/health/route.ts
apps/web/work-phelo-web/scripts/health-route.spec.mjs
```

Proposed production PR title: `fix(deploy): harden startup and approved production migrations`.

Proposed PR description:

- Remove full permission reconciliation from Auth HTTP startup; provide an
  explicit scoped, transactional, resumable operator command.
- Preserve the deployed eleven-service production release and business activation
  controls; recreate only changed/stopped services and verify before publication.
- Require pinned trusted migration baselines, immutable history, database locks,
  backup/restore and compatibility evidence for pending DDL. Reuse unchanged
  baselines without fresh migration-specific approval. Never reset, seed, repair
  history or automatically roll back a database.
- Return direct unauthenticated Next health 200; keep protected routes protected.
- Include unit, disposable PostgreSQL, Auth and Linux/AMD64 build evidence, with
  the final validation report attached. No credentials, unrelated DEV features,
  schema changes, existing permissions or activation settings are promoted.
- Deployment remains blocked on operator configuration and recovery evidence.
  This review is not merge, deployment or shared-database migration authorization.

## Contribution Workflow

1. Branch from latest `origin/dev` unless a release task says otherwise.
2. Keep changes scoped to one business or infrastructure milestone.
3. Preserve module ownership boundaries.
4. Update tracked READMEs and Swagger decorators when APIs, ports, env vars,
   workflows or integration contracts change.
5. Run focused validation first, then broader checks before pushing.
6. Open PRs into `dev` unless the release plan explicitly targets another
   branch.

## Documentation Policy

Tracked, maintained documentation should live in READMEs, Swagger/OpenAPI
decorators, DTO metadata, schemas, examples and code-adjacent comments.
Directories named `docs/` are local working/reference areas and are not the
canonical delivery surface for fresh clones after the local-docs policy is
merged.

## Full DEV Service Promotion Candidate

Review baseline: PROD `42c5256381e997ea4eeff9e3022420ffd77c2a07` and DEV
`597e87f420f6820fb331652c70713b57d84e2d02`. PR #804 promotes service functionality,
not the entire DEV branch. AI, frontend convergence, unfinished Auth corrections
and unrelated employee-access/appraisal changes are excluded.

### Included Functionality

- Accounting: all DEV manual workflows, completed ledger-based bank reconciliation,
  reconciliation groups, source payments (including Inventory), source-payment
  currency validation, recurring posting and service integrations.
- Marketing: DEV CRM, campaigns, sender identities, wallets and credit-request
  submission/fulfillment/rejection, messaging/scheduling/consumer functionality,
  Accounting integration and HR directory/fleet integrations.
- Inventory: complete implemented DEV settings, item/party/variant management,
  stock/lot/batch operations, adjustments/transfers, approvals, purchase orders,
  invoices, damaged goods and Accounting-linked supplier payments.
- Subscription: only the existing health/Swagger scaffold. DEV has no implemented
  subscription models, billing, checkout or payment-provider flow. Deploying this
  container does not create such functionality.
- Gateway: Inventory namespace and audience, Idempotency-Key CORS, existing
  Accounting/Marketing/Subscription routes. No AI registration or proxy is copied.
- Auth: Inventory resource/seed definitions and entitlement regressions. HR:
  production internal secret/allowlist forwarding. Existing current-context,
  tenant isolation, entitlement and granular permission guards remain enforced.

### Production Activation Is Explicit, Not Hard-Disabled

Each workflow variable below is passed to the identically named runtime flag
without the `PROD_` prefix. Unset variables safely resolve to false. Production
operators can enable the implemented features after approval without editing code.

| Production GitHub variable                      | Capability                                    |
| ----------------------------------------------- | --------------------------------------------- |
| `PROD_ACCOUNTING_RECURRING_JOURNALS_ENABLED`    | Automatic recurring generation/posting        |
| `PROD_ACCOUNTING_INTERNAL_INTEGRATION_ENABLED`  | Authenticated internal financial integrations |
| `PROD_MARKETING_OUTBOUND_COMMUNICATION_ENABLED` | Notifications and campaign delivery           |
| `PROD_MARKETING_AUTOMATIC_PROCESSING_ENABLED`   | Scheduled campaign processing                 |
| `PROD_MARKETING_RABBITMQ_CONSUMER_ENABLED`      | Marketing queue consumers                     |
| `PROD_MARKETING_ACCOUNTING_INTEGRATION_ENABLED` | Marketing Accounting calls                    |

No production setting was changed during preparation. Credentials, approved
sender identities, wallet balances, transport readiness and financial-posting
policy must be verified before activation. Disabled consumers do not bind or
acknowledge. Sender readiness remains strict in production. Outbound messaging
still belongs to Notification; provider credentials are not copied into Marketing.
Read/write CRM and standalone manual Accounting APIs remain available independently.
After approval, validate consumers/result processing before enabling campaign
dispatch; enable scheduling last. Approve recurring AUTO_POST policy separately
from internal Accounting APIs and verify callbacks before accepting integration traffic.

### Production Wiring And Configuration

Compose/build/change detection include Accounting (loopback 4108), Marketing
(4106), Inventory (4109) and the health-only Subscription scaffold (4105).
Gateway receives their Docker-network URLs. Accounting receives HR, Marketing
and Inventory callback URLs; Marketing and Inventory receive Accounting URLs.
Auth, HR, Accounting, Marketing and Inventory receive the existing internal
secret and approved caller allowlist where needed. The allowlist must include
marketing-service, accounting-service and inventory-service.

GitHub prod secret names verified present: PROD_DATABASE_URL, PROD_JWT_SECRET,
PROD_RABBITMQ_URL, PROD_REDIS_PASSWORD, INTERNAL_SERVICE_AUTH_SECRET,
PROD_NOTIFY_RESEND_API_KEY, PROD_NOTIFY_TERMII_API_KEY, PROD_NOTIFY_PILOSMS_API_KEY,
AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, CLOUDINARY_CLOUD_NAME,
CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET. Configured sender/from-email,
Auth/frontend and object-storage variable names are present. Name presence is
not verification of credential validity, sender approval or live connectivity.
SasuSync/AgooSMS production API-key names and the six activation variables are
absent; those alternatives/activation need operator configuration before use.
No payment-provider secret is consumed by the health-only Subscription scaffold.

### Migrations And Rollback

The exact migration sequence/checksums and complete changed-file inventory live
in `.github/production-rollout-manifest.json`: 65 Accounting, 40 Marketing and
19 Inventory migrations. Subscription has no application models/migrations.
The previously excluded DEV migrations are now included with matching source
and Prisma schemas. Disposable migration validation is not production drift proof.

**Destructive migration gate:** Accounting's
`20261121100000_bank_reconciliation_ledger_matching` drops old matching columns
and indexes without a data-preserving backfill. Before application, verify actual
production history/data, recoverable backups and any required reconciliation
preservation plan. Do not assume tables are empty or baseline migrations blindly.

Deployment runs only read-only Prisma migration status, never automatic SQL or
explicit seeds. Existing Auth startup permission-catalog/system-set backfill is
unchanged and can write resources/system sets when Auth starts; review/approve
that existing behavior with the Inventory catalog addition. Required migrations
and any additional Inventory RBAC seeding need separately approved
execution. Pending migrations intentionally block rollout. Do not apply only the
new application image to an older schema.

Assets/env files remain in `.incoming-<SHA>` until health/reachability pass;
private previous configuration backups and canonical per-environment image
history are retained. Orphan removal is disabled. This is not automatic container
or database rollback. Use previous images/configuration only after schema
compatibility review. Once destructive migrations are applied, old image rollback
may require restoring the verified database backup.

### Validation And Release Gates

Full Accounting and Marketing unit suites, full Inventory suite with opt-in
local PostgreSQL tests, Gateway/internal-auth regressions, focused Auth/HR signed
HTTP integration tests, Prisma validation/generation, typechecks, lint, image
builds and deployment failure tests provide local evidence. Subscription's health
test covers only its scaffold; this is not evidence of billing implementation.
Local totals: Accounting 814; Marketing 982; Inventory 374 (all database tests
enabled); Gateway 68; internal-auth 40; focused Auth 50; focused HR 14;
Subscription health/startup 2; deployment safety 7; synthetic context probes 9.
Accounting, Marketing, Inventory, Subscription, Gateway, Auth and HR local builds
and typechecks pass. Auth lint retains existing non-blocking warnings. Clean
Linux/AMD64 builds include service-owned Prisma generation. Docker Hub TLS and
initial local dependency-resolution failures were retried, not hidden by code changes.
Inventory test-only corrections await async rejections, create the required
variant fixture and align invoice-aware fixtures without weakening assertions.
Subscription registers shutdown hooks: its original bootstrap required forced
container termination; a focused lifecycle regression protects the correction.

One unchanged DEV Inventory migration has a trailing blank line. Its bytes are
preserved for Prisma checksum compatibility rather than reformatted; default
git whitespace checking reports that inherited EOF warning. Other whitespace
checks must remain clean.

Dockerfile-specific credential allowlists cover all backend images rebuilt by
the workspace/deployment changes. Synthetic builder/final/max-cache tests use
no real secrets. They are not a bytewise audit of full production images.
Dependency vulnerabilities remain a security-review item; no broad dependency
upgrade was performed. Install summaries report 47 findings in the Accounting
build, 91 in Marketing, 80 in Subscription, 91 in Gateway and 88 in Auth,
including critical findings. These are package-install summaries, not proof of
exploitability or production-only runtime exposure, and require security disposition.

Production history/drift, host capacity, registry images, backup/restore evidence
and actual authenticated production integrations remain unverified. No authorized
host target/access was supplied, so the prepared audit script was not executed.
This candidate is for PR review, not permission to merge, deploy or enable jobs.

Planning evidence only: PROD-02, PROD-04 and PROD-09 In Review after Git handoff;
PROD-03 and PROD-05 Awaiting deployment. No actual Jira updates, Done claims or
AI subtask changes are made.
