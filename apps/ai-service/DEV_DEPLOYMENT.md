# DEV eligibility-only deployment

## Scope

This change makes the existing authenticated eligibility endpoint reachable through
Gateway. It does not authorize chat, persistence, cleanup, inference or ERP access.
No production files, schema SQL or permission declarations change.

The Gateway already registers optional service `ai`, strips untrusted identity
headers and checks current Auth `/me` before signing its short-lived assertion.
The previous DEV env omitted `AI_SERVICE_URL`; DEV also omitted the image and
container. Swagger is Gateway-owned and does not prove AI process availability.

## Runtime inventory

| Value                                            | Source / policy                                                                                         |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `AI_SERVICE_IMAGE`                               | SHA-tagged image selected from this build or successful deployment inventory; mutable fallback rejected |
| `AI_SERVICE_URL`                                 | Generated `http://ai-service:4011` in Gateway env                                                       |
| `JWT_SECRET`                                     | Existing GitHub secret -> SSH env -> mode-600 AI env file; same verification secret as Gateway/Auth     |
| `NODE_ENV`                                       | `production`, deliberately enforcing existing execution prohibitions                                    |
| `AI_SERVICE_PORT`                                | `4011`, Docker network only; no host-published port                                                     |
| `AI_PROVIDER`                                    | `mock`, identifier only; no execution                                                                   |
| `AI_POLICY_VERSION`                              | `dev-eligibility-v1`, versioned non-secret configuration                                                |
| `AI_AUTHENTICATED_ROUTES_ENABLED`                | `true`, permits only trusted authenticated eligibility                                                  |
| Every other AI `*_ENABLED` flag                  | Explicit `false`                                                                                        |
| Gateway signing, resource safeguards, demo flags | Explicit `false`                                                                                        |

No new GitHub secret or variable is required. A presence-only GitHub metadata check
confirmed `JWT_SECRET` in the `dev` Environment; its value and live distribution were
not inspected. Correct distribution must still be verified at deployment; a workflow
reference alone would not be presence evidence. Values must never be printed. No database
URL, encryption/fingerprint/request-proof key, Redis credential, broker URL, provider
credential or AI runtime scope is passed to AI. Runtime validation is executed in
the candidate image with no network before rollout. Missing/invalid JWT fails it.

AI has no Compose dependency on PostgreSQL, Redis or RabbitMQ in this mode. Gateway
does not gain a hard AI startup dependency; AI remains optional to overall Gateway
health and unrelated ERP requests. AI failure still fails its own deployment health
gate, and eligibility returns a service error rather than fabricated success.

## Build and routing

DEV uses `dorny/paths-filter@v4` with an explicit **last successful deployment SHA**
as `base`, and the target SHA as `ref`. This compares the exact two trees: it does
not use repository default `main`, `dev`'s latest commit or merely `push.before`.
The original omission selected all 11 application images against `main`; the AI
adoption delta against successful DEV selects Gateway and AI only. Shared packages,
root dependency files and TypeScript config still trigger their existing dependents.

The planner queries successful push runs of `deploy-dev.yml` on DEV, checks the
successful deployment job, and loads that run's `dev-deployment-state` artifact.
It validates repository, SHA ancestry, run identity, service names and SHA-tagged
image refs. State contains non-secret image metadata only. It is uploaded only after
SSH deployment, migrations/seeds, health checks and maintenance all succeed. The
workflow must also finish successfully before it can supply a future baseline.
Artifacts retain state for 90 days; missing/expired evidence fails closed unless
complete legacy evidence or an operator-verified bootstrap inventory is available.

For first adoption, legacy successful runs have no state artifact. The planner can
derive a baseline only if that successful run proves every pre-AI service's image
push actually succeeded, plus its deployment job. Skipped builds are not evidence.
Read-only GitHub inspection found that complete legacy evidence in run
`45844226660`, SHA `a1e8054ae00250f12cd86f763e22fb09d78b17a5`; this is workflow
evidence, not a claim that live server or database state was inspected. Missing AI
is explicitly selected for its first build. With no trustworthy baseline, stop;
do not guess `main`, use a mutable tag, or silently rebuild everything.

An authorized operator may supply repository variable `DEV_DEPLOYMENT_BOOTSTRAP_JSON`
only after verifying the deployed SHA and all running service images independently.
Shape: `{version:1,sha:<40-hex deployed SHA>,images:{<service>:<SHA-tagged image>}}`.
All ten pre-AI service keys are mandatory; AI alone may be absent. If a latest
successful run exists, bootstrap SHA must match it. No bootstrap value is created
by this PR. Manual rollbacks/out-of-band deployment require fresh evidence before
trusting the workflow baseline again.

Failed, cancelled and partially completed releases do not advance the baseline.
Next selection spans successful SHA -> new target, carrying missed changes forward.
Unchanged images come from the successful snapshot, **never** the possibly poisoned
`.compose.dev.env` written by a failed attempt. Reverted failed changes restore the
successful image rather than reusing the failed image. If the baseline advances
between planning and deployment, rerun the complete workflow to replan. A stale
target that is no longer DEV HEAD is rejected.

Active workflow runs are serialized (`cancel-in-progress:false`); pending runs may
still be replaced by GitHub, safely covered by the cumulative baseline. A nonblocking
host `flock` also rejects overlap after manual cancellation leaves SSH work running.
Uploads are staged per run/attempt before taking the host lock; active Compose is
replaced only under that lock. The host must have `flock` installed. Image build
failure, baseline lookup failure or authorization failure never starts SSH deployment.

SHA tags follow the existing image policy. They are **not** digest-level immutability
or registry-enforced non-overwrite protection. The existing Compose rollout recreates
changed services in place; it is not zero-downtime rolling deployment.

Gateway `/api/v1/ai/eligibility` -> Docker DNS `ai-service:4011/api/eligibility`.
Authenticated active tenant users receive `{eligible:true,inferenceAvailable:false}`;
no `demo` configuration is advertised. Normal login is required; careers/restricted
sessions, forged context and current Auth rejection remain denied. An Auth-state
stub in automated routing tests is explicitly not a real login acceptance result.

Public AI health/ready routes remain blocked. Docker probes `/api/ready` internally;
the deployment also checks `/api/health` and `/api/ready` inside the container using
bounded fetches. Dedicated Swagger remains at `/api/v1/ai/docs` and `/docs-json`,
under existing Swagger policy, independent of this service's availability.

## Migrations and activation boundary

No AI migration, seed or reconciliation is executed by DEV deployment. The runtime
image intentionally contains no Prisma migration CLI or migration directories.
Prisma client generation at image build is not a database connection or migration.

Before any separately authorized persistence deployment, all four AI migrations
must be applied in order to an approved schema `ai` target with verified history:

1. `20261118120000_add_ai_persistence_foundation`
2. `20261118150000_add_ai_request_nonce_replay`
3. `20261125120000_ai_shared_resource_safeguards`
4. `20261126120000_ai_internal_demo_reply`

Do not execute them from this availability patch. Later activation also requires
encryption/fingerprint/proof keys, matching Gateway/AI signed `demoIntent` protocol,
dedicated Redis admission memory/ACL/epoch setup, quota reconciliation for populated
scopes, and explicit environment authorization. Current eligibility uses JWT-bound
identity assertions, not conversation request proofs. No new intent keys are needed
for eligibility. Gateway and AI must be upgraded together before later conversation
activation; all such flags remain off here. Shared scripted demo is not authorized.

The existing DEV script still migrates Auth (`w_auth`), HR (`hr`), Notification
(`notify`), Subscription (`subscription`), Marketing (`marketing`), Reinsurance
(`reinsurance`), Accounting (`accounting`) and Inventory (`inventory`), then seeds
Auth and HR. These commands are retained, not silently skipped. The existing
Subscription migration failure allowance and non-fatal HR seed failure are unchanged.

Auth seeding can rewrite the platform admin's password/status/verification and lock
fields, seed demo tenants, and backfill permission sets. HR seed upserts demo records
and employee `userId` linkage. Repeating a deployment is therefore not read-only;
idempotent upserts can still change existing application data. Application rollback
does not undo completed SQL, seeds, password changes or permission reconciliation.

No working authorized read-only DEV database session was available for this review.
No live history, pending migration list, checksum match, backup or affected tenant
counts are asserted. CI and successful deployment metadata do not prove these safe.
Before release approval, an authorized operator must:

1. Verify DEV-only database/schema targets without disclosing URLs; inspect migration
   status for all eight services using the currently selected SHA-tagged images.
2. Read each schema's `_prisma_migrations`, including failed and rolled-back attempts,
   and compare names/checksums to SQL inside those exact images. Preserve history;
   stop on drift/failure. Do not reset, resolve, seed or migrate during inspection.
3. Review pending SQL and expected Auth/HR seed writes, affected identities/linkage,
   and permission changes. Confirm a recoverable DEV data snapshot/restore path.
4. Approve those operations for the exact release, or withhold deployment and propose
   a separate controlled data-operation change. Do not use the AI rollout to bypass it.

The existing `dev` Environment currently has no required-reviewer protection (read-only
metadata inspection). Configure independent required reviewers, prevent self-approval
and restrict deployment branches to `dev` through an authorized repository admin.
This PR changes no GitHub settings. As a code-enforced stop, the deployment job and
remote script both require DEV Environment variable
`DEV_DATABASE_OPERATIONS_APPROVED_SHA` to equal the exact target 40-hex SHA. Missing
or stale approval stops before SSH upload, migrations, seeds or active config changes.
It is an approval marker, not evidence collection or a substitute for reviewer policy.
No approval value is set by this PR. The operator records review evidence separately.

After approving a newly merged SHA, rerun that same workflow; a newer DEV head needs
a new plan/approval. If the successful baseline advanced, rerun the complete workflow,
not just deployment. Partial data-operation failure requires review before retry;
no automatic rollback/retry is introduced. Until approval, a merge can build images
but cannot change the DEV server through this deployment path.
Do not rerun pre-adoption workflow revisions: they lack these new controls. Treat
legacy reruns, manual deployments and rollbacks as out-of-band changes requiring
fresh deployment evidence and an operator-reviewed baseline before continuation.

Planner token permissions: `contents:read` and `actions:read` for workflow/job/artifact
metadata. Build keeps existing `packages:write`; deployment keeps `packages:read`
plus `actions:read` for its plan. No environment-admin token is requested. Required
reviewer configuration and approval-variable writes remain authorized operator tasks.

## Authorized rollout and rollback plan

1. Review CI, image build/context checks and JWT presence without reading its value.
2. Approve merge separately. DEV push builds selected images; deployment stops without
   exact-SHA data-operation approval. Configure required Environment reviewers to add
   the independent human approval gate; the SHA marker does not prove that setting.
3. Verify the internal container, expected SHA-tagged image and readiness/inference=false.
4. Normal test-account login through Gateway -> eligibility 200 with no demo field;
   unauthenticated request 401; conversations remain 503. Confirm other ERP health.
5. No real LLM, encrypted conversation, admission or cleanup activation is implied.

If rollout fails, retain diagnostics without env/credentials. Restore the last
known-good Gateway image/env and Compose revision through the approved deployment
process, removing only the AI service when approved. Do not restart unrelated
healthy services, reset databases or remove volumes. No AI database rollback is
needed because this patch performs no AI DDL/data writes. Deploy-script failure
does not automatically undo existing non-AI migrations or seeds.

Approval still needed: independent code review, merge/deployment authorization,
operator data-impact/rollback review, exact-SHA approval and Environment protection,
live secret-distribution verification and a normal-login DEV acceptance check.
Frontend can test eligibility and disabled/error contracts after deployment;
successful conversation CRUD or scripted turns require a later authorization.
