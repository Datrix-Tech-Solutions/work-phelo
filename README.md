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

| Service              | Local port | Gateway prefix                     | Dev deploy | Prod deploy |
| -------------------- | ---------: | ---------------------------------- | ---------- | ----------- |
| API Gateway          |     `4000` | `/api/v1/*`                        | Yes        | Yes         |
| Auth Service         |     `4001` | `/api/v1/auth/*`                   | Yes        | Yes         |
| HR Service           |     `4002` | `/api/v1/hr/*`                     | Yes        | Yes         |
| Notification Service |     `4004` | `/api/v1/notification/*`           | Yes        | Yes         |
| Subscription Service |     `4005` | `/api/v1/subscription/*`           | Yes        | No          |
| Marketing Service    |     `4006` | `/api/v1/marketing/*`              | Yes        | No          |
| Reinsurance Service  |     `4007` | `/api/v1/operations/reinsurance/*` | Yes        | No          |
| Accounting Service   |     `4008` | `/api/v1/accounting/*`             | Yes        | No          |
| Web app              |     `3000` | same-origin `/api/v1/*`            | Yes        | Yes         |

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

Subscription and Marketing currently have no Prisma models and their
`db:generate` scripts intentionally no-op.

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

## Accounting and Marketing Production Candidate

This is preparation for review, not deployment approval. The source baseline is
PROD `42c5256381e997ea4eeff9e3022420ffd77c2a07`; reviewed DEV is
`597e87f420f6820fb331652c70713b57d84e2d02`. The exact migration inventory and
checksums are in `.github/production-rollout-manifest.json`. No newer DEV
Accounting or Marketing migrations are promoted. Production migration history,
schema drift, backups and restore evidence remain unverified.

### Independent Business Activation

These strict boolean flags default to false in production. Deployment writes
every flag explicitly as false; activation needs a separate approval:

| Flag                                       | Disabled behavior                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `ACCOUNTING_RECURRING_JOURNALS_ENABLED`    | No automatic recurring generation/posting; manual APIs retain their existing controls                              |
| `ACCOUNTING_INTERNAL_INTEGRATION_ENABLED`  | Internal integration routes reject with 503 before processing                                                      |
| `MARKETING_OUTBOUND_COMMUNICATION_ENABLED` | Campaign/provider submissions reject before dispatch or credit mutation; optional in-app notifications are skipped |
| `MARKETING_AUTOMATIC_PROCESSING_ENABLED`   | No campaign scheduler timer or scheduled dispatch                                                                  |
| `MARKETING_RABBITMQ_CONSUMER_ENABLED`      | No consumer binding, consumption or acknowledgement                                                                |
| `MARKETING_ACCOUNTING_INTEGRATION_ENABLED` | No Accounting client calls, even if a URL exists                                                                   |

Marketing CRM remains authenticated, tenant-scoped and usable with these flags
off. Production defaults to `SMS_SENDER_READINESS_MODE=strict`; outbound
activation with another mode fails startup. Enabled consumers require RabbitMQ
and startup closes safely if consumer initialization fails. Neither new service
requires a working broker or external provider while these controls are off.
Non-production defaults preserve existing behavior; optional Marketing consumers
still require a configured broker URL. No SMS/email provider is enabled here.

### Deployment and Rollback Boundaries

Only Accounting and Marketing are added to the executable production build and
Compose matrix, on loopback ports 4108 and 4106. Subscription and Inventory
are excluded from this PR, including their Docker-ignore templates.
Gateway receives their internal URLs; its existing proxy code is unchanged.

Uploaded assets and generated private env files use `.incoming-<SHA>` until
health and reachability pass. All six service migration checks are read-only
`prisma migrate status`: pending migrations stop deployment before rollout.
There is no automatic SQL application, baseline resolve or production seed.
This intentionally changes the previous automatic migration/seed policy and
requires explicit release review. Any required SQL/seed must be approved and
performed separately after backup/drift verification; do not blindly baseline.
Orphan removal is disabled to avoid removing unrelated live containers.

Before canonical config publication, a private `.rollback-config-<SHA>.*`
directory saves previous env files, Compose config, image refs and helper.
Successful image history is recorded only after all reachability checks.
Existing per-environment rollback image retention remains unchanged.
Failure preserves canonical config but does NOT automatically restore containers
already changed by Compose, or undo database work. Operators must use the saved
Compose/env files and retained prior images to recreate affected services after
checking schema compatibility. Do not prune volumes or roll back schema blindly.

### Validation and Remaining Gates

`node .github/scripts/deploy-prod-safety.spec.mjs` checks migration, rollout and
reachability failures plus successful config publication with synthetic inputs.
`node .github/scripts/verify-service-build-contexts.mjs` exercises both included
Dockerfile-specific allowlists using synthetic credentials, builder/final
layers and exported maximum-mode cache. This synthetic COPY probe is not a
byte-for-byte audit of full production image archives. Full clean AMD64 builds
and disposable PostgreSQL startup checks are separate validation evidence.

Auth, HR, Notification, Reinsurance and Gateway still have existing PROD Docker
context exposure risks; this patch does not silently alter those builds. Review
and harden them separately before rebuilding those images. Existing image reuse
does not prove that older images are free of historical credentials.

Production is NO-GO until an authorized read-only host audit confirms capacity,
current images, migration history/drift, backups/restore evidence, rollback
images and required configuration presence. The prepared host script has NOT
been executed. No live host target or access authorization was supplied. GHCR
image availability also remains unverified. Required platform configuration
includes database/JWT credentials, existing Auth/internal-service secrets and
Gateway URLs; do not place real values in this repository. Review container
resource budgets on the shared host before approving rollout.

Planning evidence only, not actual Jira updates:

| Item                                                 | State                                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------------------- |
| PROD-01 inventory; host/backup verification          | Blocked on authorized host evidence                                         |
| PROD-02 recurring-posting and integration safeguards | Implemented locally; awaiting review and host gates                         |
| PROD-04 outbound, scheduler and consumer safeguards  | Implemented locally; awaiting review and host gates                         |
| PROD-09 Gateway/env/pipeline/failure handling        | Implemented locally; awaiting review and host gates                         |
| Docker-context hardening subtask                     | Locally tested for scoped services; legacy service remediation remains open |
| Migration compatibility subtask                      | Disposable clean-schema validation only; production drift review blocked    |

No item is marked merged, deployed or Done. AI planning and implementation are
unchanged. Controlled Git handoff requires separate approval after reviewing
this candidate, its manifest and all outstanding gates.

Local validation on 2026-11-23: Accounting 801 tests / 58 suites, Marketing
972 / 43, unchanged PROD Gateway 67 / 5, deployment safety 5 tests, and the
Accounting/Marketing synthetic AMD64 context probes passed. Tenant/permission regressions are included
in the service suites. Prisma 5.22 validation/generation, service typechecks and
lint, shell syntax, YAML parsing, Compose syntax rendering and RBAC alignment
passed. All 62 Accounting and 39 Marketing migrations applied to an empty
disposable PostgreSQL database. These are not production drift checks.

Unit checks used existing local dependencies via temporary symlinks, not a fresh
host install (Node 25.8.1 / npm 11.11.0). Separate clean Node 20 Alpine AMD64
Docker builds validated the lockfile and runtime dependency closure. Database
integration evidence is limited to migration application, container startup,
health, default-disabled behavior and protected-route smoke tests; no full
authenticated CRM/financial business workflow was exercised against PostgreSQL.
The Accounting image install reported 47 existing dependency vulnerabilities,
including 3 critical and 20 high. Exploitability is not established by that
install summary; dependency remediation is not part of this patch and remains
an explicit security-review item.
