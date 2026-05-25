# Reinsurance Operations MVP

## Architecture Decision

Status: Accepted for MVP

WorkPhelo will add Reinsurance Operations as a domain service inside the
existing monorepo:

| Boundary             | Decision                                 |
| -------------------- | ---------------------------------------- |
| Backend service      | `apps/reinsurance-service`               |
| Frontend route       | `/[tenantSlug]/operations/reinsurance/*` |
| Public API route     | `/api/v1/operations/reinsurance/*`       |
| PostgreSQL schema    | `reinsurance`                            |
| Permission namespace | `operations.reinsurance.*`               |
| Event namespace      | `reinsurance.*`                          |

`Operations` is a navigation and product category. It is not a backend
container service. Reinsurance owns its data model and workflows while Core
continues to own authentication, tenant management, RBAC, notifications and
audit logs.

The MVP remains in the WorkPhelo monorepo for delivery speed. Before a client
engineering team is given source access, its custom module must be extracted
to a repository and deployment boundary that does not expose Core source.

## Boundaries

### Core Owns

- Authentication, users, tenants, roles and permissions.
- Platform notifications and notification delivery.
- Central audit history.
- Shared frontend shell and shared UI components.
- API gateway, deployment and module enablement.
- HR and payroll.

### Reinsurance Owns

- Broker-facing placements and their workflow state.
- Reinsurance counterparties and contacts used by broker staff.
- Claims workflow records when claims enter MVP scope.
- Broker operational email thread metadata, message records and manual links.
- Reinsurance reports and settings when implemented.

### Dependency Rules

- Reinsurance consumes verified Core identity and permission context.
- Reinsurance publishes notification and audit events through Core contracts.
- Reinsurance must not read or write `w_auth`, `hr` or `notify` tables.
- Core must not contain Reinsurance workflow logic.
- Tenant-owned Reinsurance reads and writes must always be scoped by
  authenticated `tenantId`.

### Access Gate Required Before Business Endpoints

The scaffold page currently checks the dashboard permission only. Before any
tenant data or business API is exposed, Reinsurance access must require all
of:

- the Operations module enabled for the tenant: `moduleConfig.operations`;
- the Reinsurance feature enabled for the tenant:
  `featureConfig.operations.reinsurance`;
- the endpoint-specific `operations.reinsurance.*` permission.

The current broad `TENANT_ADMIN` and `SUPER_ADMIN` permission behavior must
not accidentally enable a tenant's Reinsurance module. Any support override
must be intentional and audited. The backend must enforce tenant entitlement
and authorization from trusted Core context before serving data; frontend
navigation checks are not a security boundary.

## MVP Scope

### In Scope

- Internal broker users only.
- Reinsurance navigation placeholder and permission-controlled entry point.
- Counterparty management.
- Placement register and placement detail workflow.
- Embedded email workflow:
  - view emails and threads;
  - send, reply and forward;
  - handle attachments;
  - manually link email messages or threads to placements, claims and
    counterparties.
- Optional lightweight extraction of display metadata, subject and contact
  details for user review.
- Platform notifications and audit records for material actions.

### Not In Scope

- Cedant portal or cedant authentication.
- Reinsurer portal or reinsurer authentication.
- External user access of any kind.
- AI extraction, classification or automatic placement updates.
- Automated record creation from email without broker confirmation.
- Complex treaty accounting, commissions or bordereaux processing.
- Multiple email providers in the first implementation.
- Separate repository, separate frontend application or module federation.

## Backend Service Structure

The service scaffold starts with platform foundations only. Business modules
are introduced in the first delivery sprint.

```text
apps/reinsurance-service/
  prisma/
    schema.prisma
    migrations/
  src/
    config/
      runtime-env.ts
    health/
    app.module.ts
    main.ts
  test/
  Dockerfile
  README.md
  package.json
```

Planned business structure:

```text
src/
  auth/
  common/
  counterparties/
  placements/
  claims/                 # only when included in MVP delivery
  emails/
    providers/
  attachments/
  messaging/
  audit/
```

The first scaffold exposes only a liveness endpoint at `/api/health`; no
placeholder business API or readiness probe will claim behavior that has not
been designed or secured.

## Frontend Structure

The MVP stays inside `apps/web/work-phelo-web` and reuses the current layout,
authentication flow and design system.

```text
src/app/[tenantSlug]/operations/reinsurance/
  page.tsx
  placements/             # sprint implementation
  counterparties/         # sprint implementation
  email/                  # sprint implementation
  claims/                 # conditional MVP scope

src/components/organisms/reinsurance/
  ReinsuranceFoundation.tsx       # scaffold implementation
  ReinsuranceDashboard.tsx      # sprint implementation
  PlacementsTable.tsx            # sprint implementation
  EmailThreadView.tsx            # sprint implementation
```

The scaffold route is a permission-gated foundation page. It does not expose
unimplemented actions. Module entitlement gating is required before replacing
it with tenant data or workflow actions.

## Gateway Routing Plan

The public path is deliberately an Operations URL even though the downstream
service is domain-specific:

```text
GET /api/v1/operations/reinsurance/health
  -> reinsurance-service /api/health
```

The gateway registers `REINSURANCE_SERVICE_URL` as an optional target during
scaffolding. Existing environments remain healthy when the variable is not
configured. Deploy enablement will add the variable when the service image is
available.

Business routes must remain authenticated through the gateway. The direct
service route `/api/health` is an internal liveness endpoint for deployment
health checks; it is not a business-data route. The service must not accept
future business traffic from an untrusted public path or trust client-supplied
tenant/user headers.

Future business endpoints follow the same mapping:

```text
/api/v1/operations/reinsurance/placements
/api/v1/operations/reinsurance/counterparties
/api/v1/operations/reinsurance/emails
```

## Database Strategy

`reinsurance-service` owns the PostgreSQL schema `reinsurance` through its own
Prisma schema and migrations.

Foundation migration:

- Creates the `reinsurance` schema only.
- Does not add speculative business tables.
- Defers Prisma Client generation and database-readiness checks until the
  first approved persisted model is introduced.

Planned MVP models:

| Model                 | Purpose                                             |
| --------------------- | --------------------------------------------------- |
| `ReinsuranceConfig`   | Tenant-specific module configuration                |
| `Counterparty`        | Cedants, reinsurers and operational organizations   |
| `CounterpartyContact` | Counterparty contact people                         |
| `Placement`           | Primary broker placement record                     |
| `Claim`               | Optional claim register when confirmed in MVP       |
| `EmailConnection`     | Tenant/provider mailbox metadata                    |
| `EmailThread`         | Conversation metadata                               |
| `EmailMessage`        | Stored message metadata/body needed for operations  |
| `EmailAttachment`     | Attachment metadata and protected storage reference |
| `EmailLink`           | Manual relation to placement, claim or counterparty |
| `WebhookEventReceipt` | Provider webhook idempotency                        |

Rules:

- All tenant-owned models include `tenantId`.
- Tenant indexes begin with `tenantId`.
- Provider secrets are not stored in plaintext records.
- Email attachment binary storage should use private object storage rather
  than PostgreSQL.

## Permissions

Seed these platform resources under module `OPERATIONS`:

| Resource                                | MVP Actions                                             |
| --------------------------------------- | ------------------------------------------------------- |
| `operations.reinsurance.dashboard`      | `VIEW`                                                  |
| `operations.reinsurance.placements`     | `VIEW`, `CREATE`, `EDIT`, `DELETE`, `APPROVE`, `EXPORT` |
| `operations.reinsurance.counterparties` | `VIEW`, `CREATE`, `EDIT`, `DELETE`                      |
| `operations.reinsurance.claims`         | `VIEW`, `CREATE`, `EDIT`, `APPROVE`, `EXPORT`           |
| `operations.reinsurance.email`          | `VIEW`, `CREATE`, `EDIT`                                |
| `operations.reinsurance.email-settings` | `VIEW`, `EDIT`                                          |
| `operations.reinsurance.reports`        | `VIEW`, `EXPORT`                                        |
| `operations.reinsurance.settings`       | `VIEW`, `EDIT`                                          |

The scaffold adds resource definitions and the dashboard permission mapping.
Only the dashboard placeholder is an executable Reinsurance route today; the
other resources reserve the intended RBAC contract and do not imply delivered
features. `operations.reinsurance.claims` remains reserved until claims are
confirmed for MVP. No existing employee role receives Reinsurance access
automatically.

Planned editable role templates:

- Reinsurance Broker.
- Reinsurance Manager.
- Reinsurance Admin.

## Events, Notifications And Audit

Reinsurance domain event namespace:

```text
reinsurance.placement.created
reinsurance.placement.updated
reinsurance.placement.status_changed
reinsurance.email.received
reinsurance.email.sent
reinsurance.email.linked
reinsurance.claim.created
```

These constants currently reserve the namespace only. Before any event is
published, add typed payload contracts containing `tenantId`, actor identity,
entity identifiers and correlation/idempotency metadata appropriate to the
operation.

For in-app notification delivery, Reinsurance will publish the platform-owned
event:

```text
notification.in_app.create
```

For auditability, material actions must be written to the Core audit history.
No cross-service Reinsurance audit contract exists in the scaffold. Before
mutable business endpoints ship, the team must choose and implement a stable
Core audit API or event contract, for example:

```text
audit.activity.recorded
```

Audit-required actions include placement mutations, status changes, email
send/reply/forward, manual link/unlink, attachment actions and mailbox
configuration changes.

## Email Integration Decision

Email workflow is owned by `reinsurance-service`; `notification-service`
remains responsible for platform notifications and transactional messages.

The service must implement an email provider adapter rather than embedding a
provider throughout placement logic.

| Option                         | Choose When                                           | MVP Cost | Notes                                                                                        |
| ------------------------------ | ----------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| Resend inbound/outbound        | A WorkPhelo-managed operational mailbox is acceptable | Lowest   | Existing provider; webhook inbound and attachments; does not mirror a client's Outlook inbox |
| Microsoft Graph shared mailbox | The broker must use an existing Microsoft 365 mailbox | Medium   | Native mailbox, reply/forward and attachments; requires admin consent/token/webhook setup    |
| Nylas                          | Multiple mailbox providers are required early         | Higher   | Unified provider abstraction but adds vendor cost/dependency                                 |

Decision required before email implementation:

1. Is a WorkPhelo-managed mailbox acceptable for the pilot?
2. If not, which Microsoft 365 shared mailbox will be connected?
3. Which private object storage will hold attachments?

No automatic email-to-record updates are permitted in MVP. The user confirms
every manual link or metadata-derived action.

## CI And Deployment Impact

Scaffolding makes `reinsurance-service` buildable in the monorepo and gives
the gateway an optional route target. Deployment activation has not been
wired yet.

Already scaffolded:

- Service package, Dockerfile, liveness endpoint and schema-only Prisma
  migration.
- Monorepo workspace registration.
- Optional gateway route registration for
  `/api/v1/operations/reinsurance/*`.

Required before dev activation:

- Add a Reinsurance image to the development workflow build matrix.
- Add change detection for `apps/reinsurance-service/**`.
- Generate the service environment file and set `REINSURANCE_SERVICE_URL` for
  the gateway.
- Add the Reinsurance container to development Docker Compose.
- Run Reinsurance Prisma migrations before service startup.
- Add health and authenticated gateway smoke-test checks.
- Add Prisma schema validation for `reinsurance-service` to CI before
  migration-bearing business work.

Required before production activation:

- Repeat the tested build, environment, migration and compose wiring for
  production only after development verification.
- Add provider secrets only after the email option is selected.

The module should remain optional to Core health so Reinsurance failure cannot
take down HR or authentication for tenants that do not use it.

## Sprint 1 Readiness Audit

Audit date: 2026-05-25

### P0: Before Continuing

No P0 blocker was found for continuing the scaffold or activating the
liveness-only service in development. No Reinsurance business data API or
mutation is currently exposed.

### P1: Before Business Implementation

| Gate                              | Required Outcome                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Deployment activation             | Service image, compose entry, env generation, migration execution and health checks work in development.         |
| Module visibility and entitlement | Both UI and backend enforce tenant module/feature enablement separately from permissions.                        |
| Service authorization boundary    | Business endpoints accept only trusted authenticated tenant/user/permission context and are not directly public. |
| Migration CI coverage             | Prisma validation is part of CI before persistent business schema changes land.                                  |
| Audit contract                    | Core audit integration is defined before any mutable counterparty, placement or email operation.                 |
| Event contracts                   | Typed, tenant-safe payloads are added before publishing Reinsurance events.                                      |

### P2: Improvements

- Add focused gateway route-mapping tests when the gateway test harness is
  extended.
- Add database readiness probing when the first persisted business model is
  introduced.
- Keep planned permissions visibly distinguished from delivered functionality,
  especially conditional claims.
- Add email provider secrets, attachment storage and webhook controls only
  after the provider decision is approved.

## Sprint 1 Implementation Order

### 1. Deployment Activation

- Activate the liveness-only service in development first.
- Wire image builds, change detection, compose, runtime environment,
  schema-only migration deployment and smoke tests.
- Keep production activation deferred until development verification passes.

Exit criteria: the service deploys to development and authenticated gateway
routing to its health endpoint is verified without affecting Core services.

### 2. Permissions And Module Visibility

- Enforce `moduleConfig.operations` and
  `featureConfig.operations.reinsurance` as tenant entitlement.
- Add trusted service authorization/permission guards before data endpoints.
- Finalize audit and typed event contracts.

Exit criteria: a tenant without entitlement cannot navigate to or call future
Reinsurance business endpoints, including through admin permission shortcuts.

### 3. Counterparties

- Add counterparty and contact schema/API.
- Add tenant isolation, entitlement, authorization and audit tests.

Exit criteria: the first persisted business domain is tenant-safe, auditable
and deployable.

### 4. Placements

- Add placement schema/API and basic lifecycle after counterparty boundaries
  are established.
- Publish typed placement events only after event contracts are approved.

Exit criteria: broker placement workflow safely references approved
counterparties and records material actions.

### 5. Email MVP Foundation

- Confirm email provider and attachment storage.
- Add provider adapter, connection model and webhook idempotency.
- Implement send/view/reply/forward/thread/attachment behavior.
- Implement manual linking to placements/counterparties and conditional
  claims.

### Frontend

- Replace the placeholder dashboard with broker workflow panels.
- Build counterparties and placements screens.
- Build mailbox/thread/compose/linking UI.
- Show navigation only when module and permission access are present.

## Deferred From Sprint 1

- External portals.
- Separate repository extraction.
- Multi-provider email.
- AI parsing.
- Fully automated workflow processing.
