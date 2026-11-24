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

### Production Startup and Migrations

Merging a PR into `prod` creates the single deployment event: a push to `prod`.
The workflow validates the code, builds changed immutable SHA-tagged images,
runs migrations, deploys changed/not-running services, then checks all eleven
containers and their HTTP health endpoints. Production runs are serialized with
`cancel-in-progress: false`, plus an exclusive host `flock`. There is no separate
migration approval, baseline JSON, schema-fingerprint or backup-attestation gate.
Existing `prod` Environment secrets and Accounting/Marketing activation flags
are unchanged; this patch enables no business jobs or outbound messages.
The deploy script also requires the workflow-provided push event and prod ref;
missing or legacy PR/manual invocation context fails before host changes. Keep
the default branch's deployment workflow trigger definition synchronized so it
does not enqueue obsolete duplicate merged-PR runs.

Before application rollout, `.github/scripts/production-migrations.mjs` runs
native `prisma migrate deploy` once per service in this deterministic order:

| Service      | Connection/history schema |
| ------------ | ------------------------- |
| Auth         | `w_auth`                  |
| HR           | `hr`                      |
| Notification | `notify`                  |
| Reinsurance  | `reinsurance`             |
| Accounting   | `accounting`              |
| Marketing    | `marketing`               |
| Inventory    | `inventory`               |

Each command runs in its selected immutable service image with an overridden
Node entrypoint, not application bootstrap. It uses that service's generated
environment and validates exactly one correct `schema` URL parameter. PostgreSQL
search-path correctness matters: the original Inventory max-stock migration
contains an unqualified `InventoryItem` reference. Its SQL bytes remain unchanged;
fresh-schema replay and the retained rolled-back-attempt case are tested.

Prisma applies only pending migrations and preserves its service-specific history.
No pending migrations is a successful no-op. Native Prisma advisory locking is
retained. A migration failure or five-minute process deadline stops before
application rollout and reports only the service and a safe error code; raw CLI
output can expose credentials and is not printed. Failed/ambiguous existing
histories require private operator diagnosis, never automatic resolution.

Deployment never runs full seeds, `db push`, reset, resolve or repair SQL.
Standard `migrate deploy` is not a proof that live schema drift is absent. Review
immutable SQL and destructive changes in the release PR; keep ordinary backups
and recovery practice current without introducing another approval workflow.

Auth no longer performs full permission reconciliation during HTTP startup.
Its existing transactional new-tenant/invite baseline assignment remains intact.
The explicit, dry-run-first operator command is documented in
`apps/auth-service/README.md`; deployment never invokes it.
Next.js `/health` returns direct unauthenticated HTTP 200 with no-store caching.
Protected pages retain authentication; production probes do not follow redirects.

Only changed/not-running services are recreated. Entry points no longer depend
on every backend already being healthy. Application/shared-dependency changes
select image builds; infrastructure-only edits do not force unrelated app images
to rebuild. Compose config hashes still detect actual runtime configuration changes.
Existing bounded health/reachability
checks must still pass before canonical configuration and successful image
history are published. Private prior configuration and
`.deployment-state.prod` identify interrupted releases. Raw application logs and
health command output are omitted from CI diagnostics; inspect privately.

If DDL succeeds but a later service/rollout fails, earlier schema changes may
remain committed. There is no automatic database or container rollback. Continue
with a reviewed fix or only schema-compatible previous images/configuration.
Database restore is a separate incident action and may lose intervening writes.
Multi-file configuration publication is not globally atomic; retain and inspect
candidate/rollback snapshots before recovery. Do not restart or prune unrelated
healthy services while diagnosing a failed deployment.

Tests: `node --test .github/scripts/production-migrations.spec.mjs .github/scripts/deploy-prod-safety.spec.mjs apps/web/work-phelo-web/scripts/health-route.spec.mjs`.
Opt-in PostgreSQL tests use only an owned loopback fixture on port 54413, database
`resilience_fixture`, user `fixture`: set `MIGRATION_TEST_DATABASE_URL` securely
and run `node --test .github/scripts/production-migrations.database.spec.mjs`.
Generate the Inventory client first. The tests create random isolated databases;
remove only the owned fixture container afterward, never a shared schema.

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

**Historical destructive migration:** Accounting's
`20261121100000_bank_reconciliation_ledger_matching` drops old matching columns
and indexes without a data-preserving backfill. Before application, verify actual
production history/data, recoverable backups and any required reconciliation
preservation plan. Do not assume tables are empty or baseline migrations blindly.

Deployment now runs native Prisma migration deploy before application rollout,
as documented above. It never runs full seeds or automatic history repair. Auth
startup no longer performs global permission backfill; permission reconciliation
is an explicit operator command, not a deployment step. Failed migrations block
rollout. Do not apply a new application image against an incompatible schema.

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
