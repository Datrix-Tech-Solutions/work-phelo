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

| Value                                            | Source / policy                                                                                     |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| `AI_SERVICE_IMAGE`                               | Existing changed-service SHA image selection; mutable fallback rejected                             |
| `AI_SERVICE_URL`                                 | Generated `http://ai-service:4011` in Gateway env                                                   |
| `JWT_SECRET`                                     | Existing GitHub secret -> SSH env -> mode-600 AI env file; same verification secret as Gateway/Auth |
| `NODE_ENV`                                       | `production`, deliberately enforcing existing execution prohibitions                                |
| `AI_SERVICE_PORT`                                | `4011`, Docker network only; no host-published port                                                 |
| `AI_PROVIDER`                                    | `mock`, identifier only; no execution                                                               |
| `AI_POLICY_VERSION`                              | `dev-eligibility-v1`, versioned non-secret configuration                                            |
| `AI_AUTHENTICATED_ROUTES_ENABLED`                | `true`, permits only trusted authenticated eligibility                                              |
| Every other AI `*_ENABLED` flag                  | Explicit `false`                                                                                    |
| Gateway signing, resource safeguards, demo flags | Explicit `false`                                                                                    |

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

DEV paths-filter outputs and the existing image matrix include AI. Initial Compose,
workflow and script changes select the new AI image. Compose/script changes also
rebuild Gateway. All use the existing SHA build and deploy pipeline. Updates reuse
prior immutable image refs for unchanged services. The existing Compose rollout
recreates changed services in place; this is not a zero-downtime rolling strategy.

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

The existing DEV script still migrates other domain services and seeds Auth/HR on
every deployment. This patch does not run that script or change those commands.
Review their pending state before authorizing the normal DEV deployment.

## Authorized rollout and rollback plan

1. Review CI, image build/context checks and JWT presence without reading its value.
2. Approve merge/deployment separately. Normal DEV push automation will build selected
   images and run the existing deployment; this draft PR alone does neither.
3. Verify the internal container, immutable image and readiness/inference=false.
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
operator secret-presence verification and a normal-login DEV acceptance check.
Frontend can test eligibility and disabled/error contracts after deployment;
successful conversation CRUD or scripted turns require a later authorization.
