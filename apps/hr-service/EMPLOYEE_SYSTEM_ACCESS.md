# Employee system access: backend Phases 1-5

The Phase 4 sections below describe the current filtering/recovery contract and
supersede the historical Phase 2/3 limitations. Validation sections are dated.

## Contract

Employees are HR records, independent of Auth identities. Email is optional and
creating an employee does not grant login access unless explicitly requested.
Existing accounts, roles, permissions and established links are not backfilled,
disabled or removed by these migrations.

External routes use the existing Gateway `/api/v1/hr` prefix:

| Endpoint                                                   | Input                                                                                                            | Result                                             | Authority                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------- |
| `POST /employees`                                          | Existing employee DTO; optional nullable `email`; `grantSystemAccess` defaults false; required `Idempotency-Key` | 201 employee plus nullable `systemAccessOperation` | `employees:CREATE`; additionally `users:CREATE` for access |
| `POST /employees/:id/system-access/grant`                  | Optional nullable `email`; required `Idempotency-Key`                                                            | 202 operation                                      | `employees:EDIT` AND `users:CREATE`                        |
| `GET /employees/:id/system-access/operations/:operationId` | UUID identifiers                                                                                                 | 200 operation                                      | `employees:VIEW` AND `users:VIEW`                          |
| `GET /employees/:id/system-access`                         | UUID identifier                                                                                                  | 200 current account/provisioning snapshot          | `employees:VIEW` AND `users:VIEW`                          |

All routes require authenticated current context and enabled HR. Standard
TENANT_ADMIN/SUPER_ADMIN permission bypasses remain tenant-scoped. The grant API
rejects self-directed changes, established links, offboarded employees, missing
login email, invalid IDs and conflicting unresolved operations. It never accepts
tenant, actor, user ID, role or permission-set assignments from the request body.
Unknown/cross-tenant targets are non-disclosing 404s. Malformed input is 400;
missing authority is 403; conflicting keys/links are 409.

Keys must match `[A-Za-z0-9._:-]{8,128}`. Reuse the same key and payload after a
lost response. Changing the payload under the same key returns 409. Public
creation now requires this header even without email; old frontend/API callers
must be updated before coordinated rollout. Trusted internal bulk creation
continues without account provisioning; bulk-import request replay is not a new
idempotent batch contract in this phase.

Grant acceptance means queued, not invited. Operation responses contain `id`,
`employeeId`, `action`, `status`, `attemptCount`, `errorCode`, `retryable`,
`createdAt`, and `completedAt`. They exclude contact snapshots, request hashes,
credentials and tokens. Access snapshots distinguish unavailable Auth lookups,
missing identities and inconsistent established links. They are not credentials.

## Persistence and workflow

- HR `EmployeeCreateRequest` makes public creation replayable, including employees
  without email. Employee, leave balances, create receipt and requested access
  operation commit in one HR transaction. No Auth network call is inside it.
- HR `EmployeeAccessOperation` stores the immutable grant snapshot, initiating
  actor, idempotency fingerprint, target IDs, status, leases and safe errors.
  A partial unique index reserves each employee while an operation is unresolved,
  including PAUSED operations whose remote outcome may be uncertain.
- Auth `EmployeeAccessCommand` commits the pending EMPLOYEE, baseline assignment,
  audit record and command outcome together. It reuses the existing Employee
  template and system-set synchronization, never global permission seeding.
  Missing baseline configuration fails explicitly. Existing email conflicts never
  auto-link identities or modify an administrator.
- Notification `EmployeeInviteReceipt` records processing/acceptance by stable
  operation ID. It stores a fingerprint, not invitation content or tokens.

HR statuses: QUEUED -> RUNNING -> LINKED -> COMPLETED. Uncertain dependencies use
RECONCILING; definitive pre-identity rejection uses FAILED. Exhaustion, identity
conflicts or uncertain post-provision outcomes use PAUSED. Terminal/paused rows
are not automatically reclaimed. Auth statuses: PROVISIONED -> READY ->
PROVIDER_ACCEPTED; FAILED, PAUSED and EXPIRED describe blocked outcomes. State
mutations use source-state predicates and lease-token fencing.

HR executes a signed versioned RabbitMQ command. Auth verifies the body-bound
service signature and resolves the actor's current database-backed tenant,
status, HR entitlement and permissions before provisioning and publication.
Revoked authority is not replayed from a stored permission snapshot.

The workflow is:

1. HR durably accepts a request.
2. Auth idempotently creates the pending identity and baseline assignment.
3. HR records the exact returned identity and compare-and-set links it inside its
   tenant, without overwriting another link. Employee.userId uniqueness prevents
   a user from linking to two employees.
4. Auth independently verifies the HR operation/link through signed RPC before
   marking invitation work READY. It verifies the link again before sending.
5. Notification processes the invitation through RabbitMQ and returns a durable
   provider-acceptance result. A missing reply is not success.
6. Auth and HR converge on the acknowledged outcome through replay.

RPCs are `auth.employee_access.execute.v1`, `.finalize.v1`, `.status.v1`,
`hr.employee_access.verify_link.v1`, and `notification.employee_access.invite.v1`.
Signatures use existing internal-auth request signing, cover the full payload and
method, and expire after 60 seconds. Retries generate fresh signatures over the
same immutable operation payload. Operation IDs and fingerprints stay stable.

## Recovery and notification semantics

Workers select at most 20 rows per pass, use 120-second fenced leases, avoid
overlapping local passes, and retry uncertain failures with exponential backoff
capped at 15 minutes. Eight failed attempts pause work visibly. Expired leases
are reclaimable. Lost provisioning/finalization/notification replies are resolved
by replaying the same operation, not by creating another account or deleting one.

New provisioning never invokes legacy invite rollback. Legacy cleanup refuses
identities owned by durable commands. Old uncorrelated employee-provision/invite
RPC entry points reject new provisioning; existing linked invitations still
accept normally. Resend cannot create a missing account or bypass unfinalized
durable work. Generic user updates cannot activate or elevate an unfinished
durable invitation.

Managed invitations cannot use OTP verification, forced-reset or social-login
shortcuts to activate before invitation acceptance. Acceptance independently
rechecks the HR linkage and eligibility, then atomically compares the pending
account state and invitation token before activating. A concurrent offboarding
or token rotation therefore cannot be overwritten by stale acceptance. Existing
non-managed invitation flows retain their established behavior.

Provider acceptance is not mailbox delivery. No mailbox-delivered claim is made.
The existing Resend send path receives `Idempotency-Key: employee-access/<id>` and
an 8-second HTTP timeout for this workflow only. Notification receipts suppress
duplicate acknowledged sends. Uncertain sends stop automatic retry before the
provider's 24-hour idempotency window expires (23-hour safety boundary), or after
retry exhaustion. Provider configuration/content changes may require review.
See https://resend.com/docs/dashboard/emails/idempotency-keys.

PAUSED/EXPIRED outcomes retain employee, account and permissions. Phases 2/3 left
these for reviewed reconciliation; Phase 4 adds the constrained controls below,
not an operator takeover or arbitrary state-editing endpoint. A definitive FAILED operation that
created no identity may be superseded by a new authorized grant with a new key
after its cause is repaired. Never delete an account to release a reservation.

## Migrations and rollout prerequisites

Phase 1 HR migration: `20261112120000_employee_optional_email`.
Phase 2 migrations:

- HR: `20261112130000_employee_access_operations`.
- Auth: `20261112130000_employee_access_commands`.
- Notification: `20261112130000_employee_invite_receipts`.

Review/apply all service migrations before enabling the new service versions.
Deploy Auth, HR and Notification as a coordinated change: retired uncorrelated
RPCs are intentionally not a rolling-compatible provisioning API for old HR.
Do not roll back to binaries requiring non-null employee email after nullable
records exist. Existing deployment scripts already run these services' migrations.

Required configuration reuses existing values: the SAME
`INTERNAL_SERVICE_AUTH_SECRET` (at least 32 characters) in HR/Auth/Notification;
existing Auth owner/JWT configuration; consistent FRONTEND_BASE_URL in Auth and
Notification; normal RabbitMQ/database connectivity; Notification's existing
Resend credentials and verified from address. No credentials belong in operations.

Phase 3 corrects both deployment env writers to forward the existing
INTERNAL_SERVICE_AUTH_SECRET to Notification as well as HR/Auth. No configured
secret value was read, changed or printed. This wiring has not been deployed.
Missing/invalid configuration fails closed and remains visible as an
unconfirmed/paused operation.

## Verification

Unit suites cover immutable commands, current authorization, missing baseline,
provider idempotency, forged signatures, expiry, receipt leases and deduplication.
The PostgreSQL integration spec is
`test/integration/employee-access.integration.spec.ts`. It requires built Auth and
Notification code, all migrations, and `EMPLOYEE_ACCESS_TEST_DATABASE_URL` pointing
to a disposable localhost database named `employee_access_test_*`. It refuses
other hosts/database names and never resets schemas or deletes pre-existing data.

The suite uses real service-owned Prisma clients and transactions, signed RPC
handlers, and injected RabbitMQ/email transport failures. It does not contact a
real RabbitMQ broker or external email provider. A broker/provider end-to-end
smoke test and Docker image build remain separate rollout checks.

Phase 3 adds a targeted `.gitignore` exception for this database spec only. It is
now eligible for tracking; other live-database suites remain ignored. With no
EMPLOYEE_ACCESS_TEST_DATABASE_URL it is explicitly skipped, without loading
cross-service build artifacts. With the variable set, build Auth/Notification,
generate clients and apply the migrations to a disposable database first.
The URL guard also rejects non-local host overrides in the query string.

Local verification on 2026-11-12:

- Auth full unit configuration: 381 tests, 34 suites passed.
- HR full unit configuration: 931 tests, 40 suites passed.
- Notification full suite: 118 tests, 14 suites passed.
- Shared internal-auth: 43 tests, 4 suites passed.
- Disposable PostgreSQL workflow/concurrency/recovery: 31 tests passed.
- All three Prisma schemas formatted, generated and validated; new migrations
  exercised only against the disposable local database.
- Auth/HR/Notification lint passed (Auth/HR retain warning-only diagnostics).
- Root typecheck: 30 tasks passed; root build: 15 tasks passed.
- RBAC alignment and `git diff --check` passed.

HTTP unit tests required local socket permission in the sandbox. After rerunning
with that permission the complete suites passed. The disposable PostgreSQL server
was stopped after verification; no shared database was contacted.

## Phase 2 source inventory

The following paths are relative to the repository root. Existing Phase 1 nullable
email compatibility changes remain in the same worktree and are not discarded.

- `apps/auth-service/Dockerfile`, `package.json`, `prisma/schema.prisma` and
  `prisma/migrations/20261112130000_employee_access_commands/migration.sql`.
- `apps/auth-service/src/auth/auth.module.ts`, `auth.service.ts`,
  `auth.service.spec.ts`; `src/messaging/rabbitmq.publisher.ts`.
- `apps/auth-service/src/users/employee-access-command.service.ts`,
  `employee-access-command.handler.ts`, `employee-access-command.service.spec.ts`,
  `users.module.ts`, `users.service.ts`, `users.service.spec.ts`,
  `users.handler.ts`, `users.handler.spec.ts`.
- `apps/hr-service/prisma/schema.prisma` and
  `prisma/migrations/20261112130000_employee_access_operations/migration.sql`.
- `apps/hr-service/src/employees/employee-access.service.ts`,
  `employee-access.controller.ts`, `employee-access.service.spec.ts`,
  `employees.controller.ts`, `employees.module.ts`, `employees.service.ts`,
  `employee-creation.spec.ts`, `dto/create-employee.dto.ts`.
- `apps/hr-service/src/messaging/rabbitmq.publisher.ts` and this document.
- `apps/hr-service/test/integration/employee-access.integration.spec.ts`
  (targeted tracking exception added in Phase 3).
- `apps/notification-service/Dockerfile`, `package.json`, `prisma/schema.prisma`
  and `prisma/migrations/20261112130000_employee_invite_receipts/migration.sql`.
- `apps/notification-service/src/notification/employee-access-invite.handler.ts`,
  `employee-access-invite.spec.ts`, `notification.module.ts`;
  `src/channels/email.service.ts`, `employee-invite-email.spec.ts`.
- `packages/internal-auth/src/employee-access-rpc.ts`,
  `employee-access-rpc.spec.ts`, `index.ts`.
- `packages/types/src/employee-access.types.ts`, `index.ts`; `package-lock.json`
  (explicit Auth/Notification internal-auth workspace dependencies only).

## Phase 3 lifecycle contract

Additional external endpoints, using the same `/api/v1/hr` prefix:

| Endpoint                                    | Input                                    | Result        | Required permissions                |
| ------------------------------------------- | ---------------------------------------- | ------------- | ----------------------------------- |
| `POST /employees/:id/system-access/suspend` | `Idempotency-Key`, `{ "reason": "..." }` | 202 operation | `employees:EDIT` AND `users:DELETE` |
| `POST /employees/:id/system-access/restore` | Same                                     | 202 operation | `employees:EDIT` AND `users:EDIT`   |
| `POST /employees/:id/resend-invite`         | Same                                     | 202 operation | `employees:EDIT` AND `users:CREATE` |

Reasons are trimmed, nonempty and at most 500 characters. Operation responses now
include initiating actor ID and reason, but no email snapshot or private provider
data. Replays require the same actor, action and normalized reason. Concurrent
unresolved operations reserve the employee through the existing partial unique
index and transaction-scoped advisory lock. Cross-tenant targets are 404; invalid
inputs 400; missing authority/self-target 403; link/reservation conflicts 409.
Acceptance means queued, never proof of a completed suspension or sent invitation.

Auth independently resolves current actor authority and verifies the correlated
HR operation/link through signed RPC. Protected system administrators and self
targets are rejected. Restoration additionally requires ACTIVE employment, a
verified identity and an explicit lifecycle suspension marker; arbitrary INACTIVE
or pending users cannot be restored. Permissions, employment, linkage and history
are retained. A durable Auth command receipt, account mutation, refresh-session
revocation and success audit commit together. Failed business checks are recorded
as FAILED receipts; uncertain transport/database outcomes reconcile by the same ID.

Auth adds `EmployeeAccessLifecycleCommand` and User `sessionVersion` (default 0),
`accessSuspendedAt`, `accessSuspensionReason`. Both suspend and restore increment
the version and revoke refresh sessions. Access and refresh issuance includes the
current version; legacy tokens without the claim count as version 0. Auth JWT
validation and refresh reject mismatched versions. Gateway's existing current
Auth lookup therefore rejects old access tokens even after restoration. Internal
deferred commands resolve current users without replaying old session claims.
Fresh login is required after restoration; this does not restore an old session.

Generic Auth updates cannot clear a lifecycle suspension or bypass a pending
durable invitation. Generic status deactivation requires users:DELETE and advances
the epoch; ordinary user editors cannot grant system administrator roles.
Managed account recovery/OTP/social flows cannot bypass invitation acceptance or
the suspension marker. Legacy uncorrelated HR resend messages are retired; they
cannot create accounts or rotate durable tokens. The legacy generic Auth resend
route remains for non-durable invitations; durable ones must use the HR endpoint.

Resend requires an existing linked pending identity, never creates one, and
renews the token once per durable generation (48-hour validity). Publication uses
Notification's existing durable receipt and provider idempotency key keyed by that
generation ID. A fresh distinct generation is rejected while another is ready or
within 60 seconds of a completed send. Provider failures retry; uncertainty or
exhaustion pauses visibly. Renewed legacy invitations also use link verification
and atomic pending-state/token comparison on acceptance. Provider acceptance is
not mailbox delivery. PAUSED grants with uncertain outcomes still require reviewed
reconciliation before another operation, including resend, may take their place.

## Phase 3 access states and filtering

HR snapshot `status` is derived from current Auth state where linked:

- NONE: no HR link and no operation; Auth is not consulted.
- PROVISIONING / PROVISIONING_FAILED: pending or failed durable grant/resend work.
- INVITED: valid pending invitation; durable publication acknowledged (legacy
  pending invitations retain compatibility without retroactive receipt evidence).
- INVITE_EXPIRED: pending identity with absent/expired invitation credentials.
- ACTIVE: current ACTIVE account, without a suspension marker.
- SUSPENDED: current SUSPENDED account with an explicit lifecycle marker.
- INACTIVE: current inactive Auth account; not assumed to be restorable.
- UNAVAILABLE: Auth lookup failed, never inferred active/absent/invited.
- INCONSISTENT: missing identity, conflicting link, marker/status mismatch, or
  legacy SUSPENDED state without the new provenance marker. Review is required.

`pendingAction` reports queued/running/reconciling/linked GRANT/SUSPEND/RESTORE/
RESEND separately. The operation is not evidence of the final account state.
No redundant hasSystemAccess flag or frontend-authoritative capabilities exist.

At the Phase 3 checkpoint, employee list accepted `accessStatus` but only NONE was
implemented. Phase 4 replaces that limitation below. A
tenant-indexed SQL anti-join excludes linked employees and every employee with an
access-operation history before count, ordering, LIMIT and OFFSET. IDs returned
to Prisma are bounded by the existing maximum page size (100). Search, department,
employment type/status are included in that database query. Counts remain correct
on empty/out-of-range pages. New tenant/user and operation indexes support it.

At the Phase 3 checkpoint all Auth-backed filters returned 503. They cannot be implemented safely
as page-local filtering or unbounded cross-service ID lists. Exact cross-service
filtering remains incomplete pending an approved bounded join/projection contract;
no stale projection is introduced as an authorization source. Filtering requires
employees:VIEW AND users:VIEW. NONE continues working during Auth outages.

## Phase 3 changed paths and rollout

Phase 3 extends existing Phase 2 HR service/controller/publisher, Auth auth/token/
user services/controllers/publishers, shared user/employee-access types, tests and
this document. New primary files:

- `apps/auth-service/src/users/employee-access-lifecycle.service.ts` and `.spec.ts`.
- `apps/auth-service/prisma/migrations/20261112140000_employee_access_lifecycle/migration.sql`.
- `apps/hr-service/prisma/migrations/20261112140000_employee_access_lifecycle/migration.sql`.
- Targeted `.gitignore` exception for the existing database integration spec.
- `.github/scripts/deploy-dev.sh` and `.github/scripts/deploy-prod.sh`: Notification
  internal-secret pass-through only.

Existing paths extended specifically by Phase 3:

- Auth `prisma/schema.prisma`; `src/auth/auth.service.ts`, `auth.service.spec.ts`,
  `strategies/jwt.strategy.ts`, `strategies/jwt.strategy.spec.ts`;
  `src/messaging/rabbitmq.publisher.ts`.
- Auth `src/users/users.controller.ts`, `users.service.ts`, `users.service.spec.ts`,
  `users.handler.ts`, `users.module.ts`, `employee-access-command.handler.ts`,
  `employee-access-command.service.ts`, `employee-access-command.service.spec.ts`.
- HR `prisma/schema.prisma`; `src/employees/employee-access.service.ts`,
  `employee-access.service.spec.ts`, `employee-access.controller.ts`,
  `employees.controller.ts`, `employees.service.ts`, `employee-creation.spec.ts`,
  `dto/query-employees.dto.ts`; `src/messaging/rabbitmq.publisher.ts`.
- `packages/types/src/employee-access.types.ts`, `packages/types/src/user.types.ts`.

Phase 1/2 files remain present and uncommitted; the complete working-tree diff is
not a Phase-3-only patch. No dependency version or frontend change was added here.

Review and apply Phase 1, Phase 2 and both Phase 3 migrations before coordinated
Auth/HR/Notification rollout. No migration was run on shared databases. Frontend
callers need the new idempotency/reason/202 contracts; no frontend was changed.
Real isolated RabbitMQ/provider E2E and Docker image smoke testing remain rollout
checks. Frontend integration, exact Auth-backed filtering and reviewed operator
recovery for ambiguous PAUSED/EXPIRED operations remain outstanding.

## Phase 3 verification results (2026-11-12)

| Command/check                                                                         | Final result                                                     |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `npm run test:unit --workspace=apps/auth-service -- --runInBand`                      | 408 tests / 35 suites passed                                     |
| `npm run test:unit --workspace=apps/hr-service -- --runInBand`                        | 940 tests / 40 suites passed                                     |
| `npm test --workspace=apps/notification-service -- --runInBand`                       | 118 tests / 14 suites passed                                     |
| `npm test --workspace=@work-phelo/internal-auth -- --runInBand`                       | 43 tests / 4 suites passed                                       |
| Gateway `current-state.spec.ts`                                                       | 27 passed                                                        |
| HR `test:integration`, explicit disposable URL, `employee-access.integration.spec.ts` | 37 passed                                                        |
| Auth/HR/Notification `npm run lint`                                                   | Passed; Auth 130 and HR 1038 warnings, no errors                 |
| Root `npm run check-types`                                                            | 30 tasks passed                                                  |
| Root `npm run build -- --force`                                                       | 15 tasks passed, clean uncached rebuild                          |
| `npm run check-rbac`                                                                  | Passed                                                           |
| All three Prisma schemas                                                              | Validated/generated; Auth/HR new migration SQL exercised locally |
| `bash -n` on both deployment scripts                                                  | Passed                                                           |
| `git diff --check`                                                                    | Passed                                                           |

The build and typecheck initially collided while recreating Auth dist; a clean
forced build followed by sequential typecheck and database tests resolved the
artifact failure without source/config workarounds. Validation from the repository
root used a non-secret placeholder DATABASE_URL for Prisma validate only, which
does not connect to a database. No shared URL was used for SQL or migration tests.

Database coverage includes prior provisioning/recovery regressions, concurrent
lifecycle requests, reply loss, session epochs, preservation of permissions and
employment, expired legacy invitation renewal, failed resend not invalidating a
previous valid invitation, and pre-pagination NONE filtering/counts during Auth
outage. HTTP unit tests ran with local test-server socket permission. All messaging
transports and provider calls in this database suite are injected mocks: isolated
RabbitMQ/provider E2E was not executed, and Docker images were not smoke-tested.

The disposable PostgreSQL cluster is stopped after verification. Branch remains
dev at ea4e0a3cf0bf7d57482a221b0e395d4198b4bc7c. Working-tree inventory including
preserved Phase 1/2 and unrelated MapLibre work: 56 modified tracked paths,
25 untracked files, zero staged files. Nothing was committed, pushed or deployed.

## Phase 4: current filtering contract

**Selected strategy: bounded live HR cohort plus one Auth snapshot, no projection.**
An unrestricted traversal cannot give a cheap exact total; a durable projection
would add synchronization, lag, backfill and repair responsibilities. A generic
cross-service paginator cannot join arbitrary HR search/department/employment
filters without moving ownership or materializing IDs. The bounded contract is
the smaller safe implementation, with an explicit capacity limit rather than
silently incomplete results.

`GET /api/v1/hr/employees?accessStatus=ACTIVE&page=1&limit=20` supports NONE,
PROVISIONING, PROVISIONING_FAILED, INVITED, INVITE_EXPIRED, ACTIVE, SUSPENDED,
INACTIVE and INCONSISTENT. Existing employee search, department, employment status
and employment type filters apply first. Permissions: employees:VIEW AND users:VIEW.

- NONE retains the indexed HR anti-join and needs no Auth call, even during outage.
- Other filters fetch at most 1,001 HR candidate ID/link pairs in stable
  createdAt DESC, id DESC order. More than 1,000 matches returns 503 with
  `ACCESS_FILTER_COHORT_LIMIT`; narrow search/department/status first. This is not
  unrestricted large-tenant filtering, and no partial count/page is returned.
- Up to 1,000 unique linked IDs go in one signed
  `auth.employee_access.snapshot.v1` RPC. Auth rechecks current actor authority and
  executes one tenant-scoped SQL statement joining users, unique grant receipts
  and indexed latest non-failed resend generations. No per-user Prisma/network
  calls occur. Unknown/cross-tenant IDs produce MISSING, never foreign metadata.
- HR selects latest operation overlays in one bounded query and applies the same
  state mapping as detail reads. Only after matching does it compute totals and
  slice the page. At most the existing 100-row maximum is fetched for display.
- HR candidate/overlay/page reads share a REPEATABLE READ transaction. Auth uses
  a single statement snapshot and clock. The result is explicitly the join of
  those two service snapshots, not a distributed atomic snapshot. No later Auth
  lookup changes page membership/counts. Concurrent writes affect the next call;
  offset pages across separate calls are not frozen for a browsing session.
- Filtered rows include `accessStatus`; existing `userStatus` is populated where
  the captured state proves it, otherwise null. Responses include
  `accessSnapshotAt`. Ordinary unfiltered response behavior remains unchanged.
- Auth timeout, invalid/incomplete snapshot or dependency failure returns 503,
  never an empty success or a fabricated ACTIVE/NONE state. UNAVAILABLE is a
  request failure, not an enumerable durable state: filtering by it returns 503
  `ACCESS_STATE_UNAVAILABLE`. Pure HR cohorts with no linked IDs need no Auth read.

The cap bounds application materialization and cross-service work. It does not
promise constant-cost PostgreSQL text-search predicates. Tenant/order and latest
history indexes support the common paths. No access projection authorizes login,
permissions or lifecycle mutations: Auth's current-state/session checks remain
mandatory. Larger unrestricted filtered cohorts require a separate approved
architecture; this backend does not claim that capability.

## Phase 4: operator recovery APIs

| Endpoint under `/api/v1/hr`                                           | Contract                                                                                         |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `GET /employee-access-operations?status=PAUSED&limit=50&cursor=<id>`  | Tenant-scoped diagnostics, maximum 100 rows, stable keyset cursor; employees:VIEW AND users:VIEW |
| `POST /employees/:id/system-access/operations/:operationId/reconcile` | Required Idempotency-Key and `{ "reason": "Dependency repaired" }`; 202 recovery result          |
| `GET /employees/:id/system-access/operations/:operationId/recoveries` | Latest 20 safe recovery records, same read permissions and target scoping                        |

Recovery requires employees:EDIT AND users:EDIT, plus the action's original user
authority (users:CREATE for grant/resend, users:DELETE for suspend, users:EDIT for
restore). Existing tenant-admin bypasses remain tenant-scoped and HR-enabled.
Auth independently verifies both the operator and original initiator's current
authority. Recovery never replaces the original actor or grants new permissions.

Example recovery response:

```json
{
  "recoveryId": "<uuid>",
  "outcome": "REQUEUE",
  "errorCode": null,
  "operation": { "id": "<original-operation-id>", "status": "RECONCILING" }
}
```

Poll the existing operation GET afterward. A transport timeout returns PENDING
with RECOVERY_UNCONFIRMED; retry the same recovery key/reason. That request has a
durable HR receipt and a stable Auth recovery ID. Histories expose operator,
reason, outcome, safe error and timestamps, not keys/hashes/private payloads.

Safety rules:

- The existing employee reservation/advisory lock and a new fenced recovery lease
  prevent stealing an active worker or concurrent operator's work. Active leases
  return 409; expired leases can be reclaimed. Changed key payloads return 409.
- Original HR COMPLETED/FAILED operations are never restarted. Existing recovery
  receipts replay safely; a pending recovery whose operation has since finished
  settles with OPERATION_ALREADY_TERMINAL without mutating the operation.
- HR EmployeeAccessRecoveryRequest records pending intent/outcome. Auth
  EmployeeAccessRecoveryReceipt commits once with command repair and an audit.
  Lost acknowledgments cannot repeatedly reset outbox counters under the same key.
- Replay uses the original command/identity and tenant-verified compare-and-set
  link. A missing Auth grant command is requeued only if HR proves no identity is
  known. A missing command for an already-known identity is blocked for review;
  it is not an instruction to provision another account.
- Notification exposes signed, read-only receipt inspection. PROVIDER_ACCEPTED
  conclusively settles the existing generation without sending again. RETRY (or
  recent receipt absence) can wake the same outbox generation while preserving
  the Notification receipt and provider idempotency key. An active receipt lease,
  UNKNOWN/EXPIRED receipt, exhausted receipt or expired idempotency window remains
  BLOCKED/DELIVERY_REVIEW_REQUIRED. The operator cannot reset those protections.
- An expired invitation can close the old workflow as FAILED with
  INVITATION_EXPIRED_RESEND_REQUIRED, retaining the linked identity. Request a new
  authorized resend generation afterward. No identity is deleted or recreated.
- If invitation acceptance won a race with a lost provider acknowledgment, a
  verified ACTIVE identity plus the signed PROVIDER_ACCEPTED receipt can settle
  the original grant. No new invitation is sent to that active account.
- Partial/conflicting links, protected/self targets and revoked authority remain
  blocked. Terminal failure, ambiguous delivery and configuration/identity repairs
  are not bypassed by recovery. Provider dashboards/manual reconciliation may
  still be required; there is no force/override endpoint.

Important safe codes include RECOVERY_UNCONFIRMED, COMMAND_BUSY,
COMMAND_CHANGED_DURING_RECOVERY, RECOVERY_AUTHORITY_REQUIRED,
RECOVERY_AUTHORITY_OR_SCOPE_REJECTED, COMMAND_MISSING_OR_IDENTITY_UNCERTAIN,
PARTIAL_LINK_REVIEW_REQUIRED, DELIVERY_REVIEW_REQUIRED and
INVITATION_EXPIRED_RESEND_REQUIRED. Provider acceptance is never mailbox delivery.

## Phase 4: compatibility and security review

| Area / source                                                                                 | Verified behavior or correction                                                                                                                                                                          |
| --------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/employees/employees.service.ts`, creation DTO                                            | No-access creation and nullable email remain valid; no implicit identity or network dependency in the HR creation transaction                                                                            |
| `src/imports/hr-employee-imports.service.ts`, `employee-import-columns.ts`, employee bulk DTO | Email-less imports remain supported; staged execution delegates to no-access creation; no Auth provisioning                                                                                              |
| `src/directory/directory.service.ts`; Marketing `src/hr/hr-directory.client.ts`               | Nullable email/userId already supported; HR identity summaries remain usable without login                                                                                                               |
| `src/payroll/payroll.service.ts`, `src/payroll-runs/payroll-runs.service.ts`                  | Eligibility remains employment/payroll-driven, not account-status-driven; payslip notification lookup now explicitly includes tenantId and still only targets linked users                               |
| `src/leave/leave.service.ts`                                                                  | HR employee/balance operations remain valid without account access; self-service necessarily requires a linked login                                                                                     |
| `src/time/time.service.ts`                                                                    | Scheduling is employee-based; in-app notifications guard userId, external notifications guard email                                                                                                      |
| `src/appraisals/appraisals.service.ts`                                                        | Employee/appraisal records remain HR-owned; own submissions require a linked user; guarded notification paths remain unchanged                                                                           |
| `src/recruitment/recruitment.service.ts`                                                      | No implicit employee identity provisioning was found in the current recruitment service; authenticated recruiter/candidate identities remain their existing distinct workflows                           |
| `src/announcements/announcements.service.ts` and employee notification helpers                | Existing audiences are preserved; permission-recipient email is an Auth identity field, not a nullable Employee field                                                                                    |
| `src/reports/reports.service.ts`, imports/exports and shared Employee type                    | Backend builds/tests retain nullable employee email; report creator email is authenticated Auth identity data                                                                                            |
| `src/employees/employee-sync-recovery.cron.ts`                                                | Existing leave initialization and offboarding recovery remain; bulk status lookups are now signed and batched at 100 so large notification audiences are not accidentally rejected                       |
| Auth users/auth services, JWT strategy                                                        | Existing linked accounts/permissions and Auth-only accounts remain. Recovery, OAuth, invitation, MFA and refresh retain current-state/session-version checks; no new ordinary-HR administrator authority |

Confirmed security corrections:

- HR offboarding uses a body-signed RPC. Auth independently confirms HR's current
  OFFBOARDED record and rejects administrator targets. The User update has a
  transactional EMPLOYEE-role/session-version compare-and-set, revokes sessions,
  records system audit evidence and retains an offboarding reason marker.
  Concurrent promotion cannot accidentally deactivate an administrator.
- Generic activation cannot defeat that marker. Generic management of unrelated
  Auth-only accounts remains available under its existing permissions.
- Legacy unsigned offboarding events are retired. Pending-invite cleanup and
  status RPCs are signed too; cleanup cannot delete a durable grant or a durably
  renewed legacy invitation. Status batches are capped at 100 on Auth and safely
  chunked on HR, preserving caller inputs/audiences rather than truncating them.

The existing 30-minute offboarding retry now uses rotating keyset pages of at most
100 records (plus a bounded wrap query), with a local overlap guard. Its cursor is
a process-local traversal hint, not authorization state: a restart may revisit a
page, while the durable source remains the OFFBOARDED HR record. Already-INACTIVE
legacy accounts are included so verified offboarding installs the protected reason
marker too. Auth handles repeats idempotently. Verify a complete reconciliation
sweep for historical offboarded accounts before rollout; this is not a migration
backfill or a distributed immediate-revocation guarantee.

Product decisions deliberately not invented: email-only manager matching during
imports still needs a manager email; an employee with no login cannot perform
self-service actions; existing announcement/delivery audience rules are unchanged.
Whether to use an Auth login email as an HR delivery fallback needs approval.
Recovery does not transfer ownership from a revoked initiator to an operator.
Restoration retains Phase 3's exact ACTIVE-employment requirement. Whether
PROBATION or ON_LEAVE should count as an eligible active employment relationship
needs product confirmation; do not advertise restore as available for those
states. Re-hiring an OFFBOARDED employee likewise needs a separately approved
access policy, not clearing the Auth offboarding marker through generic updates.

## Phase 4 migrations, files and handoff

New migrations, applied only to disposable databases:

- Auth `20261113100000_employee_access_recovery`: recovery receipts and indexed
  latest per-target lifecycle history.
- HR `20261113100000_employee_access_recovery`: recovery intent/audit records.
- HR `20261113103000_employee_access_read_indexes`: ordered candidate and admin
  operation-list indexes.

All earlier migration SQL remains unchanged. Recovery records intentionally retain
identifier snapshots like the existing operations/audit tables; there are no new
cross-service FKs or cascading account deletions. Service scope checks validate
references. Existing permission-assignment FKs and unique employee/user linkage
remain intact. Historical data must pass the email-collision preflight before any
shared rollout; passing disposable fixtures is not evidence about shared data.

Phase 4 new source files:

- Auth `src/users/employee-access-state.ts`, `.spec.ts`,
  `employee-access-recovery.service.ts`, `.spec.ts`.
- HR `src/employees/employee-access-state.ts`,
  `employee-access-recovery.service.ts`,
  `employee-sync-recovery.spec.ts`, `src/messaging/employee-access-batching.spec.ts`.

Existing paths extended by Phase 4:

- Auth `prisma/schema.prisma`, `src/messaging/rabbitmq.publisher.ts`,
  `src/users/employee-access-lifecycle.service.ts`, `.spec.ts`,
  `employee-access-command.handler.ts`, `users.module.ts`, `users.service.ts`,
  `users.service.spec.ts`, `users.handler.ts`, `users.handler.spec.ts`.
- HR `prisma/schema.prisma`, `src/employees/employee-access.service.ts`,
  `employee-access.controller.ts`, `employees.service.ts`, `employees.module.ts`,
  `employee-sync-recovery.cron.ts`,
  `src/messaging/rabbitmq.publisher.ts`, `src/payroll/payroll.service.ts`,
  `test/integration/employee-access.integration.spec.ts`, this document.
- Notification `src/notification/employee-access-invite.handler.ts`, `.spec.ts`.
- Shared `packages/types/src/employee-access.types.ts` and the three migration files.

No new Phase 4 dependency, environment setting or deployment-script change was
needed. Retain Phase 3's Notification internal-secret forwarding. Deploy compatible
Auth/HR/Notification versions together after all migrations: old unsigned HR status,
cleanup and offboarding clients are intentionally not accepted by new Auth.

Frontend handoff: preserve a stable create/grant/lifecycle/recovery key per intent;
send reasons for lifecycle/recovery; poll operations rather than announcing a
completed action from 202. Distinguish operation/pendingAction from current access
state. Display safe blocking/retry errors and recovery history. Handle 503 with
retry/narrow-search UX; never silently fall back to page-local filtering or use
an access-state label as authorization. Refresh filtered pages after lifecycle
changes and require fresh authentication after restoration. No frontend was edited.

### Request examples

Use the authenticated Gateway session and an Idempotency-Key such as
`employee-create-0001` for POST /employees. Existing required employee fields remain
unchanged; the following example deliberately requests no login:

```json
{
  "firstName": "Ama",
  "lastName": "Example",
  "departmentId": "<tenant-department-uuid>",
  "jobTitle": "Officer",
  "employmentType": "FULL_TIME",
  "hireDate": "2026-11-13",
  "email": null,
  "grantSystemAccess": false
}
```

To request access at creation, supply a valid email and grantSystemAccess=true;
users:CREATE is additionally required. For an existing employee, POST
/employees/:id/system-access/grant with a fresh stable key and either `{}` to use
their contact email or `{ "email": "login@example.test" }` for an explicit login
email. The latter does not overwrite their HR contact email. The creation result
contains nullable systemAccessOperation; grant returns the operation itself.

For suspend, restore and resend use a fresh stable key per intent and
`{ "reason": "Authorized administrator request" }`. Do not regenerate the key
when retrying the same intent. Read GET /employees/:id/system-access for current
state and GET /employees/:id/system-access/operations/:operationId for workflow
state. Recovery uses the same reason/key pattern on its reconcile endpoint;
different reason under the same key is a conflict, not a new retry instruction.

## Phase 4 validation (2026-11-13)

Final service tests: Auth 427 / 37 suites, HR 942 / 42 suites, Notification 119 /
14 suites. Disposable PostgreSQL integration: 48 passed. The 1,000-candidate,
two-page load case completed in 73 ms on the final local run with mocked RPC transport; it used
one real Auth SQL snapshot per page. This is not a production latency guarantee.
The 1,001-candidate case rejected before calling Auth. All previous phase database
regressions ran in the same suite, including employment/identity preservation.
Payroll eligibility and email-less imports remain covered by the HR unit suite.

The full immutable HEAD baselines plus all Phase 1-4 migrations executed in a new
local database. A second disposable fixture contained two historical email
case/whitespace variants: the unchanged migration deliberately failed its
preflight. Read-only verification showed both rows retained, email still NOT NULL,
no normalizedEmail column and the helper function rolled back. No real tenant
data was inspected and no claim is made about shared-data readiness.
Review lock duration and the rollout window for ALTER TABLE and ordinary CREATE
INDEX on existing data before shared execution; disposable timings do not prove
production migration duration.

Auth/HR/Notification Prisma schemas validated/generated; service lint passed with
warnings (Auth 133, HR 1042, Notification no errors). Root build and typecheck,
RBAC alignment, deployment shell syntax and git diff checks passed. Socket-enabled
HTTP test runs used only local test servers. Real RabbitMQ/provider E2E was not
executed; signing/handler behavior and delivery failures were tested with injected
transports, and no actual messages were sent. Docker image smoke tests remain a
rollout check.

The backend is ready for frontend integration against the documented bounded
contract, not unrestricted large-tenant filtering or force recovery. Confirm the
employment-status product decisions and perform isolated broker/provider and
deployment validation before rollout. Phase 5/frontend implementation has not
started. Shared database migrations, environment changes, commits, pushes, merges,
rebases and deployments were not performed. Existing Phase 1-3 and unrelated
MapLibre work remain unstaged and preserved.

Final combined inventory: 56 modified tracked paths, 36 untracked files, zero
staged files, on dev at ea4e0a3cf0bf7d57482a221b0e395d4198b4bc7c. That inventory
includes all prior-phase work, not just the Phase 4 delta. The private disposable
PostgreSQL cluster is stopped after validation; both fixture databases are retained.

## Phase 5 release-candidate review (2026-11-13)

This section supersedes earlier dated validation/readiness statements. No frontend
implementation, shared migration, real message delivery, commit, push or deployment
is part of this review. Baseline: dev/origin/dev
ea4e0a3cf0bf7d57482a221b0e395d4198b4bc7c (local remote-tracking ref; no remote fetch
requested in Phase 5).

### Cumulative review and confirmed corrections

Employee creation remains HR-local and transactional: employee, leave balances,
create receipt and optional access operation commit together. Recoverable holiday
seeding is after commit. Creating an email-less employee neither creates an Auth
identity nor disables employment/payroll eligibility. Existing identity links,
permission assignments and account state are not rewritten by migration.

Auth provisioning atomically commits the pending EMPLOYEE, existing baseline
Employee set assignment, audit and command receipt. Global resource seeding is
not performed at invite time. Same-tenant email conflicts require explicit
resolution, never automatic linking. HR links only null-or-identical userId under
the operation lease; Auth verifies the signed HR link before publishing. Current
actor authority is resolved independently in Auth, not trusted from a stored JWT.

Confirmed Phase 5 release defects corrected:

- Sensitive generic Auth role/status updates previously performed a blind ID-only
  write after lifecycle checks. They now use a transactional compare-and-set on
  tenant, prior role/status, sessionVersion and null suspension marker. A
  concurrent suspension/offboarding returns 409 rather than overwriting it.
  Nonsensitive profile writes retain their existing contract. A real PostgreSQL
  regression injects suspension between validation and write.
- An omitted-email grant retry previously re-read mutable employee.contact email
  before checking the prior operation. It now resolves from the immutable prior
  operation email when replaying. Explicit email input still normalizes and must
  match the prior effective-email fingerprint. This is effective-request
  idempotency: omitted email and an explicit identical normalized email are
  equivalent; no new request-mode field or migration was introduced.
- New signed employee-access RPC handlers were missing manual acknowledgments,
  despite production consumers using noAck=false/prefetch=10. Auth, HR and
  Notification now acknowledge exactly once after success or rejected RPCs;
  durable callers remain responsible for retrying uncertain outcomes. Tests
  exercise success/failure/forgery and exceed prefetch on real broker consumers.
- Gateway and HR CORS now explicitly allow Idempotency-Key. Existing origins,
  other headers and credentials policy remain unchanged. Gateway HTTP preflight
  coverage and HR configuration coverage prevent a browser-only integration
  failure. The existing Recruitment CORS assertion was aligned with the added
  header; its application behavior is unchanged. These are four extra tracked
  Gateway/HR config/test paths, not Recruitment feature work.

Session versions are bumped on suspension, restoration and offboarding; refresh
tokens are revoked. Old tokens cannot revive on restoration. Managed invitation
acceptance checks HR eligibility/link plus pending/token compare-and-set; OTP,
forced-reset and social-login paths cannot bypass pending managed invitations.
No generic user update may clear an employee suspension marker. Self-directed and
protected-role lifecycle changes are rejected. Restoration intentionally requires
exact HR employment ACTIVE and an eligible, explicitly suspended Auth identity.

Recovery revalidates the operator AND original actor, action permissions, tenant,
link and leases. Replays use durable request/receipt IDs and cannot repeatedly
reset attempts. Ambiguous receipts, changed links, revoked original authority,
active leases, missing identity history and unsafe provider-age windows require
manual investigation; there is no force-repair or identity-deletion override.
Notification acceptance and deduplication are durable, not inferred from publish
success. PROVIDER_ACCEPTED is not mailbox delivery.

### Frontend contract: complete endpoint index

All paths below have external prefix /api/v1/hr, require a current authenticated
tenant context and enabled HR. Tenant and actor never come from request bodies.
Existing tenant/super-admin granular bypasses do not bypass tenant scope or HR.

| Method/path                                                         | Request                                                                                         | Response                                                                  | Required permission pair                                                   |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| POST /employees                                                     | Existing CreateEmployeeDto, optional email, grantSystemAccess=false by default, Idempotency-Key | 201 existing employee fields plus systemAccessOperation:null or operation | employees:CREATE; users:CREATE additionally if granting                    |
| POST /employees/:id/system-access/grant                             | {} uses contact email initially; or {email:string}; Idempotency-Key                             | 202 operation                                                             | employees:EDIT + users:CREATE                                              |
| POST /employees/:id/system-access/suspend                           | {reason:string}; Idempotency-Key                                                                | 202 operation                                                             | employees:EDIT + users:DELETE                                              |
| POST /employees/:id/system-access/restore                           | {reason:string}; Idempotency-Key                                                                | 202 operation                                                             | employees:EDIT + users:EDIT                                                |
| POST /employees/:id/resend-invite                                   | {reason:string}; Idempotency-Key                                                                | 202 operation                                                             | employees:EDIT + users:CREATE                                              |
| GET /employees/:id/system-access                                    | none                                                                                            | 200 access snapshot                                                       | employees:VIEW + users:VIEW                                                |
| GET /employees/:id/system-access/operations/:operationId            | none                                                                                            | 200 operation                                                             | employees:VIEW + users:VIEW                                                |
| GET /employee-access-operations                                     | limit=50 (1-100), optional operation-status/cursor UUID                                         | 200 {items,nextCursor}                                                    | employees:VIEW + users:VIEW                                                |
| POST /employees/:id/system-access/operations/:operationId/reconcile | {reason:string}; Idempotency-Key                                                                | 202 {recoveryId,outcome,errorCode,operation?}                             | employees:EDIT + users:EDIT, plus action-specific users:CREATE/DELETE/EDIT |
| GET /employees/:id/system-access/operations/:operationId/recoveries | none                                                                                            | latest 20 recovery records                                                | employees:VIEW + users:VIEW                                                |
| GET /employees                                                      | Existing HR search/departmentId/status/type/page/limit plus accessStatus                        | 200 {employees,meta,accessSnapshotAt?}                                    | employees:VIEW; users:VIEW also required for access filtering              |

Email is normalized by trim/lowercase; null, blank and omitted represent no contact
email. A login grant requires a valid effective email. Explicit login email does
not change HR contact email. Idempotency keys are 8-128 characters matching
[A-Za-z0-9._:-]. Reason is trimmed, required and 1-500 characters. IDs use UUID
validation. Request bodies cannot choose role, permission set, target user or tenant.

Operation public fields: id, employeeId, actorUserId, reason, action, status,
attemptCount, errorCode, retryable, createdAt, completedAt. Administrative list
adds nextAttemptAt/leaseExpiresAt. No credentials, invitation token, request hash
or contact snapshot is exposed. Create response is not a new envelope; preserve
the employee object's existing fields and add the nullable operation.

Access snapshot fields: employeeId, userId, status, accountStatus,
invitationStatus, operation, pendingAction. UI access statuses:
NONE, PROVISIONING, PROVISIONING_FAILED, INVITED, INVITE_EXPIRED, ACTIVE,
SUSPENDED, INACTIVE, INCONSISTENT, UNAVAILABLE. Auth MISSING maps to INCONSISTENT
for an established HR link. HR operation status is independently
QUEUED/RUNNING/RECONCILING/LINKED/COMPLETED/FAILED/PAUSED. Auth invitation status
is independently PROVISIONED/READY/PROVIDER_ACCEPTED/FAILED/PAUSED/EXPIRED;
a failed lookup may report UNAVAILABLE. Recovery outcome is
PENDING/REQUEUE/FAILED/BLOCKED, not an account status.

202 only means durable acceptance, not completed suspension, access grant or
email. Poll the returned operation (suggested 2-5 seconds with backoff/jitter,
pause in background tabs), then refresh the access snapshot and employee list.
Stop automatic polling on terminal FAILED/COMPLETED and surface PAUSED for an
authorized operator. retryable reflects workflow states, not permission to force
a retry. Grant COMPLETED/provider acceptance does not mean user ACTIVE: only
verified invite acceptance activates the account. Require fresh sign-in after
restoration; revoked sessions remain revoked.

Error handling: 400 malformed key/UUID/payload/reason or absent login email;
401 invalid/revoked authentication; 403 missing current authority, self/protected
target or disabled module; 404 unknown/cross-tenant employee or operation;
409 conflicting key/payload, unresolved operation, changed account/link,
ineligible lifecycle state or active recovery lease. Accepted asynchronous work
may later become FAILED/PAUSED with a safe errorCode; do not treat that as an HTTP
transport success for the underlying business action. Recovery may return 202
PENDING/RECOVERY_UNCONFIRMED: repeat the SAME key to resolve the uncertain outcome.

Existing frontend clients must add Idempotency-Key on all public employee
creates, stop promising automatic accounts/invites, accept nullable email, and
use the new asynchronous resend contract/reason. User Management access controls
must target linked Auth identities through these HR lifecycle contracts, not
generic ACTIVE patches. No new User Management discovery endpoint is implemented
by this backend work; cross-screen identity selection remains frontend integration.

### Filtering guarantee and limitations

NONE is filtered directly in HR before count/order/pagination, without Auth.
For all other enumerable states, ordinary HR filters run first and fetch at most
1,001 candidate employee IDs/user IDs BEFORE any Auth state matching. The 1,000
cap is on that HR-filtered candidate cohort, not matched results and not
necessarily all employees in a tenant. 1,001 candidates returns 503 with
code ACCESS_FILTER_COHORT_LIMIT before Auth; clients must narrow search/filter.
Do not retry this unchanged query indefinitely or show an empty result.

Within the bound, one signed Auth request resolves all unique linked user IDs
in one set-based SQL snapshot. HR operation overlays, matching, exact count and
pagination use one repeatable-read HR transaction. Current counts are exact for
the captured supported cohort, not a page-local guess. Auth and HR do not share
a distributed snapshot; accessSnapshotAt is a freshness indication, not a
cross-service serializability guarantee. Successive offset pages are live and
can move under concurrent changes; refresh from page 1 after lifecycle actions.

Missing/malformed/incomplete Auth snapshots return 503 ACCESS_STATE_UNAVAILABLE.
UNAVAILABLE is a supported detail label but cannot be reliably enumerated:
requesting that filter returns 503 ACCESS_STATE_UNAVAILABLE, not rows inferred
from failure. Retry transient 503s with backoff and show unavailable state;
never fall back to page-local filtering, fabricated totals or false ACTIVE/NONE.
All other DTO-enumerated access statuses listed above are supported.

### Migration and target preflight

Nine migrations, preserving every earlier SQL file unchanged in Phase 5:

| Owner        | Migration                                   |
| ------------ | ------------------------------------------- |
| HR           | 20261112120000_employee_optional_email      |
| Auth         | 20261112130000_employee_access_commands     |
| HR           | 20261112130000_employee_access_operations   |
| Notification | 20261112130000_employee_invite_receipts     |
| Auth         | 20261112140000_employee_access_lifecycle    |
| HR           | 20261112140000_employee_access_lifecycle    |
| Auth         | 20261113100000_employee_access_recovery     |
| HR           | 20261113100000_employee_access_recovery     |
| HR           | 20261113103000_employee_access_read_indexes |

Service-local chronological order is required; all three service schemas must
be migrated before compatible application versions start. The HR email migration
locks Employee, aborts on normalized tenant email collisions, drops NOT NULL,
backfills normalizedEmail, installs tenant uniqueness and a trigger matching JS
trim semantics. It does not rewrite original contact email or HMAC emailHash.
Multiple null emails are allowed; duplicate non-null normalized emails are not.

Operation uniqueness includes tenant/key plus unresolved employee reservation;
PAUSED retains its reservation. Auth additionally uniquely reserves a target user
and a provisioned employee. Action/status/outcome CHECK constraints and enum
types reject unsupported durable states. SessionVersion defaults zero, nullable
markers preserve old accounts and existing tokens until explicitly revoked.
Read indexes cover candidate, operation history and Auth latest resend lookup.
Receipts/commands deliberately carry scalar cross-service IDs, not impossible
cross-database foreign keys; service checks and durable retention preserve scope.
Do not delete audit/workflow records or manually repoint user links.

Before shared execution (NOT performed here): take backups; inspect Prisma
migration history/drift; run the EXACT normalize_employee_email function logic
against a read-only normalized tenant/email grouping, resolving any duplicates
with business approval. Verify existing Employee.userId uniqueness and link
integrity without auto-linking by email. Verify baseline Employee permission
templates exist for target tenants. Assess lock/index duration on representative
data; ordinary CREATE INDEX and email backfill are not zero-downtime guarantees.
Verify same INTERNAL_SERVICE_AUTH_SECRET >=32 chars in HR/Auth/Notification,
FRONTEND_BASE_URL origin consistency, broker/DB connectivity, correct queues,
existing JWT/owner configuration and Resend idempotent delivery configuration.

Quiesce employee-access mutations for coordinated migration/application rollout;
old unsigned HR clients are intentionally not compatible with new Auth handlers.
Verify historical offboarding sweep completes and revoked sessions fail before
opening access mutation traffic. No new runtime flag is added: coordinated
rollout/frontend gating is operationally required. Review consumers relying on
non-null email, automatic invitations or old resend behavior before deployment.

Prefer roll-forward. Rolling binaries back to required-email code after null
records exist is unsafe; do not drop receipts, session versions or suspension
markers, as that can resurrect sessions or duplicate invitations. A rollback
requires an approved compatibility plan and paused mutations, not a schema reset.

### Release classification

- BLOCKER: none currently identified in the reviewed backend source after the
  four narrow corrections; final validation and image results are recorded below.
- DEPLOYMENT BLOCKER: coordinated migrations/versions/config, target-data preflight,
  historical offboarding sweep and deployment-image startup checks must complete
  before rollout. Passing local tests is not production approval.
- FRONTEND DEPENDENCY: optional email, explicit access intent, stable keys/reasons,
  asynchronous polling/status UI, recovery UX and User Management integration.
- PRODUCT DECISION: restoring PROBATION/ON_LEAVE instead of exact ACTIVE requires
  explicit approval; no policy was silently broadened. Ambiguous delivery or
  revoked initiating actor cannot be overridden by an operator.
- FOLLOW-UP: cohort filtering beyond 1,000, global monitoring/retention policies
  and external provider mailbox-delivery verification. Real email sending was
  deliberately excluded from local tests.

### Exact inventory and proposed backend-only staging list

96 changed/untracked files at final review: 60 tracked modified, 36 untracked files,
zero staged. The following 95 exact paths constitute the PROPOSED staging list;
no staging command has been executed. Per-service compatibility edits are needed
for nullable email, current state, offboarding and internal trust, not unrelated
feature development. Migrations are source SQL, not generated clients.

| Classification | Exact path                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------- |
| DEPLOYMENT     | `.github/scripts/deploy-dev.sh`                                                                     |
| DEPLOYMENT     | `.github/scripts/deploy-prod.sh`                                                                    |
| TEST TRACKING  | `.gitignore`                                                                                        |
| TEST           | `apps/api-gateway/src/config/cors.spec.ts`                                                          |
| BACKEND        | `apps/api-gateway/src/config/cors.ts`                                                               |
| CONTAINER      | `apps/auth-service/Dockerfile`                                                                      |
| WORKSPACE      | `apps/auth-service/package.json`                                                                    |
| MIGRATION      | `apps/auth-service/prisma/migrations/20261112130000_employee_access_commands/migration.sql`         |
| MIGRATION      | `apps/auth-service/prisma/migrations/20261112140000_employee_access_lifecycle/migration.sql`        |
| MIGRATION      | `apps/auth-service/prisma/migrations/20261113100000_employee_access_recovery/migration.sql`         |
| BACKEND        | `apps/auth-service/prisma/schema.prisma`                                                            |
| BACKEND        | `apps/auth-service/src/auth/auth.module.ts`                                                         |
| TEST           | `apps/auth-service/src/auth/auth.service.spec.ts`                                                   |
| BACKEND        | `apps/auth-service/src/auth/auth.service.ts`                                                        |
| TEST           | `apps/auth-service/src/auth/strategies/jwt.strategy.spec.ts`                                        |
| BACKEND        | `apps/auth-service/src/auth/strategies/jwt.strategy.ts`                                             |
| BACKEND        | `apps/auth-service/src/messaging/rabbitmq.publisher.ts`                                             |
| BACKEND        | `apps/auth-service/src/users/employee-access-command.handler.ts`                                    |
| TEST           | `apps/auth-service/src/users/employee-access-command.service.spec.ts`                               |
| BACKEND        | `apps/auth-service/src/users/employee-access-command.service.ts`                                    |
| TEST           | `apps/auth-service/src/users/employee-access-lifecycle.service.spec.ts`                             |
| BACKEND        | `apps/auth-service/src/users/employee-access-lifecycle.service.ts`                                  |
| TEST           | `apps/auth-service/src/users/employee-access-recovery.service.spec.ts`                              |
| BACKEND        | `apps/auth-service/src/users/employee-access-recovery.service.ts`                                   |
| TEST           | `apps/auth-service/src/users/employee-access-state.spec.ts`                                         |
| BACKEND        | `apps/auth-service/src/users/employee-access-state.ts`                                              |
| BACKEND        | `apps/auth-service/src/users/users.controller.ts`                                                   |
| TEST           | `apps/auth-service/src/users/users.handler.spec.ts`                                                 |
| BACKEND        | `apps/auth-service/src/users/users.handler.ts`                                                      |
| BACKEND        | `apps/auth-service/src/users/users.module.ts`                                                       |
| TEST           | `apps/auth-service/src/users/users.service.spec.ts`                                                 |
| BACKEND        | `apps/auth-service/src/users/users.service.ts`                                                      |
| DOCUMENTATION  | `apps/hr-service/EMPLOYEE_SYSTEM_ACCESS.md`                                                         |
| MIGRATION      | `apps/hr-service/prisma/migrations/20261112120000_employee_optional_email/migration.sql`            |
| MIGRATION      | `apps/hr-service/prisma/migrations/20261112130000_employee_access_operations/migration.sql`         |
| MIGRATION      | `apps/hr-service/prisma/migrations/20261112140000_employee_access_lifecycle/migration.sql`          |
| MIGRATION      | `apps/hr-service/prisma/migrations/20261113100000_employee_access_recovery/migration.sql`           |
| MIGRATION      | `apps/hr-service/prisma/migrations/20261113103000_employee_access_read_indexes/migration.sql`       |
| BACKEND        | `apps/hr-service/prisma/schema.prisma`                                                              |
| BACKEND        | `apps/hr-service/src/announcements/announcements.service.ts`                                        |
| BACKEND        | `apps/hr-service/src/config/cors.ts`                                                                |
| TEST           | `apps/hr-service/src/directory/directory.service.spec.ts`                                           |
| BACKEND        | `apps/hr-service/src/directory/directory.service.ts`                                                |
| BACKEND        | `apps/hr-service/src/employees/dto/bulk-import-employees.dto.ts`                                    |
| BACKEND        | `apps/hr-service/src/employees/dto/create-employee.dto.ts`                                          |
| BACKEND        | `apps/hr-service/src/employees/dto/query-employees.dto.ts`                                          |
| BACKEND        | `apps/hr-service/src/employees/employee-access-recovery.service.ts`                                 |
| BACKEND        | `apps/hr-service/src/employees/employee-access-state.ts`                                            |
| BACKEND        | `apps/hr-service/src/employees/employee-access.controller.ts`                                       |
| TEST           | `apps/hr-service/src/employees/employee-access.service.spec.ts`                                     |
| BACKEND        | `apps/hr-service/src/employees/employee-access.service.ts`                                          |
| TEST           | `apps/hr-service/src/employees/employee-creation.spec.ts`                                           |
| BACKEND        | `apps/hr-service/src/employees/employee-email.ts`                                                   |
| BACKEND        | `apps/hr-service/src/employees/employee-sync-recovery.cron.ts`                                      |
| TEST           | `apps/hr-service/src/employees/employee-sync-recovery.spec.ts`                                      |
| BACKEND        | `apps/hr-service/src/employees/employees.controller.ts`                                             |
| BACKEND        | `apps/hr-service/src/employees/employees.module.ts`                                                 |
| BACKEND        | `apps/hr-service/src/employees/employees.service.ts`                                                |
| BACKEND        | `apps/hr-service/src/employees/resignation-notification.processor.ts`                               |
| BACKEND        | `apps/hr-service/src/imports/employee-import-columns.ts`                                            |
| TEST           | `apps/hr-service/src/imports/hr-employee-imports.service.spec.ts`                                   |
| BACKEND        | `apps/hr-service/src/imports/hr-employee-imports.service.ts`                                        |
| BACKEND        | `apps/hr-service/src/leave/leave.service.ts`                                                        |
| TEST           | `apps/hr-service/src/messaging/employee-access-batching.spec.ts`                                    |
| TEST           | `apps/hr-service/src/messaging/employee-linkage.spec.ts`                                            |
| BACKEND        | `apps/hr-service/src/messaging/events.handler.ts`                                                   |
| BACKEND        | `apps/hr-service/src/messaging/rabbitmq.publisher.ts`                                               |
| TEST           | `apps/hr-service/src/payroll-runs/payroll-runs.service.spec.ts`                                     |
| BACKEND        | `apps/hr-service/src/payroll-runs/payroll-runs.service.ts`                                          |
| BACKEND        | `apps/hr-service/src/payroll/payroll.service.ts`                                                    |
| TEST           | `apps/hr-service/src/recruitment/recruitment-documents.controller.spec.ts`                          |
| BACKEND        | `apps/hr-service/src/scripts/encrypt-employee-fields.ts`                                            |
| BACKEND        | `apps/hr-service/src/time/time.service.ts`                                                          |
| TEST           | `apps/hr-service/test/integration/employee-access.integration.spec.ts`                              |
| TEST           | `apps/hr-service/test/unit/employees.service.spec.ts`                                               |
| CONTAINER      | `apps/notification-service/Dockerfile`                                                              |
| WORKSPACE      | `apps/notification-service/package.json`                                                            |
| MIGRATION      | `apps/notification-service/prisma/migrations/20261112130000_employee_invite_receipts/migration.sql` |
| BACKEND        | `apps/notification-service/prisma/schema.prisma`                                                    |
| BACKEND        | `apps/notification-service/src/channels/email.service.ts`                                           |
| TEST           | `apps/notification-service/src/channels/employee-invite-email.spec.ts`                              |
| BACKEND        | `apps/notification-service/src/notification/employee-access-invite.handler.ts`                      |
| TEST           | `apps/notification-service/src/notification/employee-access-invite.spec.ts`                         |
| BACKEND        | `apps/notification-service/src/notification/notification.module.ts`                                 |
| TEST           | `apps/notification-service/src/notification/notification.service.spec.ts`                           |
| BACKEND        | `apps/notification-service/src/notification/notification.service.ts`                                |
| WORKSPACE      | `package-lock.json`                                                                                 |
| SHARED         | `packages/internal-auth/src/employee-access-rpc.spec.ts`                                            |
| SHARED         | `packages/internal-auth/src/employee-access-rpc.ts`                                                 |
| SHARED         | `packages/internal-auth/src/index.ts`                                                               |
| SHARED         | `packages/types/src/employee-access.types.ts`                                                       |
| SHARED         | `packages/types/src/events.ts`                                                                      |
| SHARED         | `packages/types/src/hr.types.ts`                                                                    |
| SHARED         | `packages/types/src/index.ts`                                                                       |
| SHARED         | `packages/types/src/user.types.ts`                                                                  |

EXCLUDE (preserved, unstaged):
apps/web/work-phelo-web/scripts/copy-maplibre-worker.mjs.
No Reinsurance path is in this inventory. No env files, credentials, generated
clients, node_modules, dist, .next, local logs or temporary fixtures belong in
staging. The targeted .gitignore exception makes ONLY
apps/hr-service/test/integration/employee-access.integration.spec.ts trackable;
other ignored live-database suites remain ignored.

### Proposed commits and PR (not executed)

Prefer one cumulative implementation commit if independently buildable
intermediate boundaries cannot be maintained; do not create broken commits merely
to mirror phase names. If split, review/build each dependency-ordered group:

1. Schema migrations, generated-type source declarations and signed shared RPC
   contracts (include required dependent consumer changes if types demand it).
2. Auth durable provisioning/lifecycle/recovery and current-session enforcement.
3. HR optional-email compatibility, durable creation/access/filter/recovery.
4. Notification idempotent invitation receipts, explicit dependency/Docker and
   deployment secret forwarding.
5. Integration/regression coverage and this handoff (tests may accompany owners).

Proposed PR title: feat: separate employee records from system access

Proposed PR body:

Summary: employees are created without login access by default; email is optional.
Explicit authorized grant/suspend/restore/resend operations use durable signed
HR/Auth/Notification workflows, immutable intent and idempotent delivery receipts.
Existing accounts/permissions remain preserved.

Security: tenant/current-authority validation, protected/self-target checks,
compare-and-set linking/account updates, session revocation and guarded invitation
acceptance. Operator recovery cannot overwrite identities or bypass original
authority, leases or ambiguous-provider safety.

Migrations: nine additive/nullable migrations; collision preflight, synchronized
versions/config and target-data checks required. No shared migrations executed.
Frontend contract: this document; frontend integration required before exposing
changed creation/resend behavior. MapLibre change excluded.

Validation: see the final Phase 5 results below; real local PostgreSQL/RabbitMQ
is distinguished from injected email delivery. No external messages sent.

Rollout: deploy compatible Auth/HR/Notification together after schema updates;
verify offboarding sweep, baseline templates and session invalidation. Production
rollout needs separate approval. No push/merge/deploy authorized by this review.

### Final Phase 5 validation and decision

Final results on 2026-11-13 (local only):

| Check                                               | Result                        |
| --------------------------------------------------- | ----------------------------- |
| Auth complete unit configuration                    | PASS: 432 tests, 37 suites    |
| HR complete unit configuration                      | PASS: 947 tests, 42 suites    |
| Notification complete unit suite                    | PASS: 122 tests, 14 suites    |
| Gateway current-state + CORS                        | PASS: 29 tests, 2 suites      |
| Shared internal-auth                                | PASS: 43 tests, 4 suites      |
| Disposable PostgreSQL/RabbitMQ integration          | PASS: 50 tests, 1 suite       |
| Root typecheck                                      | PASS: 30 tasks                |
| Root build, forced uncached final run               | PASS: 15 tasks, 0 cached      |
| Auth lint                                           | PASS: 0 errors, 133 warnings  |
| HR lint                                             | PASS: 0 errors, 1042 warnings |
| Notification lint                                   | PASS: 0 errors/warnings       |
| Gateway lint                                        | PASS: 0 errors, 17 warnings   |
| Auth/HR/Notification Prisma validation + generation | PASS                          |
| RBAC alignment                                      | PASS                          |
| Modified deployment scripts bash syntax             | PASS                          |
| Git whitespace/diff check                           | PASS                          |
| Auth/HR/Notification Dockerfile builds              | PASS, final runtime source    |
| Auth /health, HR /health, Notification /api/health  | PASS: HTTP 200, status ok     |

The fresh native disposable database employee_access_test_20261113_phase5 used
the preserved pre-change schema SQL fixtures plus all nine new migration SQL
files in service-local chronological order. This validates SQL application and
runtime/concurrency behavior, not target-environment Prisma history or complete
historical migrate-deploy replay. Those remain target preflight checks. The
duplicate-email fixture again rejected the email migration and retained both
rows, email NOT NULL and no normalizedEmail column: failure rolled back safely.

The 50-test integration suite uses real SQL transactions and a real isolated
RabbitMQ server for one explicit transport scenario; its other scenarios inject
transport failures while using real databases. The broker scenario runs actual
Nest request consumers with production noAck=false/prefetch=10, separate
auto-ack direct-reply clients, lost-successful-reply recovery, 25 subsequent
iterations per consumer (including rejected Auth requests and duplicate provider
commands), one identity and one email-stub invocation. Do not describe every
scenario as full RabbitMQ E2E. No external email/SMS provider was contacted.

The 1,000-candidate/two-page SQL load sample completed in 54 ms on the final run;
that particular load scenario uses injected RPC transport and real Auth SQL.
It is not a production/network latency benchmark. The real-broker scenario
completed in 574 ms locally, not a production latency guarantee.

All three images were built from env-free filtered contexts (macOS archive
metadata disabled). Their real entrypoints ran against a private internal Docker
network with disposable PostgreSQL, Redis and RabbitMQ plus fake credentials.
Each service consumer registered; queues had one consumer and zero ready or
unacknowledged messages after startup. Health endpoints verified actual database
connectivity. No browser/Gateway-to-images login flow or real provider delivery
was claimed. Gateway behavior is covered by the focused HTTP/unit tests above.
Dependency deprecation/audit notices occurred during npm ci; this review neither
upgraded dependencies nor certifies the repository dependency vulnerability state.

Only the six newly created Phase 5 containers were stopped after validation;
their data/images are retained for investigation. The private native fixture
cluster is also stopped. Existing infrastructure-rabbitmq-1 and
infrastructure-redis-1 remain running and healthy. No prune, volume deletion,
schema reset or shared infrastructure action was performed.

Created branch: feat/employee-system-access-separation, unchanged HEAD
ea4e0a3cf0bf7d57482a221b0e395d4198b4bc7c. Branch creation preserved byte hashes
of all 92 files present at that moment and the empty index. The final inventory
is 96 files: 60 modified tracked and 36 untracked, zero staged; the four extra
tracked files are the required CORS configs/assertions, listed above. MapLibre
is byte-identical to its preserved pre-switch snapshot and remains unstaged.
All nine migration SQL hashes are unchanged since branch creation. No source
file was deleted and no generated artifact or environment file is proposed.

Backend PR/handoff decision: READY FOR REVIEW, not approved for deployment.
No unresolved backend-code blocker is currently identified within this scope.
Deployment remains gated on target-data/config/history preflight, coordinated
Auth/HR/Notification/Gateway rollout, historical offboarding sweep and frontend
compatibility. Gateway must include the CORS header change before browser access
mutations are enabled. External-provider delivery and target rollout smoke tests
require separate explicit approval; passing unit/local integration is not a
production-readiness guarantee.

Recommended cumulative commit message (not executed):
feat(hr): separate employee records from system access

Approval is required before staging/committing the proposed 95 backend paths,
pushing/opening a PR, implementing frontend changes, applying shared migrations,
changing shared configuration, merging or deploying. Do not include the unrelated
MapLibre change in any such approval scope implicitly.
