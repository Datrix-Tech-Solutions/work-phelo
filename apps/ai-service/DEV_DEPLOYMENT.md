# Minimal DEV AI eligibility deployment

## Scope

Adds AI to the restored historical DEV pipeline without changing its deployment
framework. Baseline inspected: `13ce1dad85d6215215efd705413597d1852bbdd2`.
The non-AI deployment reference remains
`64b410cd2b0a52c727bd15b490b1a9e7fc2da061`.

The existing workflow detects/builds AI with `apps/ai-service/Dockerfile` and its
normal SHA and `dev` tags. Filters include AI source, shared packages/manifests,
TypeScript configuration and AI integration files. The initial integration changes
Compose, the deployment script and workflow, so AI is selected for its first build.
Gateway also rebuilds for the script/Compose integration changes. No comparison
baseline, concurrency, deployment job, Environment policy or approval gate changes.

AI resolves its image through the existing `resolve_image_ref` helper and the host
Compose env, exactly like other services. Adoption requires a SHA-tagged AI image;
an absent inventory plus an unselected AI build fails instead of adopting `:dev`.
Unchanged AI images use the existing host reference. SHA tags are not digest-level
immutability. No successful-run artifact, new image planner, host lock, staging
scheme or release authorization variable is introduced.

## Container and configuration

`ai-service` joins `workphelo-dev-network`, exposes internal port `4011`, has no
host-published port and uses generated `apps/ai-service/.env.dev`. It needs no
database, Redis, RabbitMQ or other startup dependency. Gateway does not depend on
AI health for startup; existing ERP services remain independent of AI availability.

AI receives:

```dotenv
NODE_ENV=production
AI_SERVICE_PORT=4011
AI_PROVIDER=mock
AI_POLICY_VERSION=dev-eligibility-v1
AI_AUTHENTICATED_ROUTES_ENABLED=true
AI_ENABLED=false
AI_MOCK_ENABLED=false
AI_INTERNAL_DEMO_ENABLED=false
AI_PERSISTENCE_ENABLED=false
AI_MESSAGE_ENCRYPTION_ENABLED=false
AI_MESSAGE_OPERATIONS_ENABLED=false
AI_REQUEST_VERIFICATION_ENABLED=false
AI_CONVERSATION_HTTP_ENABLED=false
AI_RESOURCE_SAFEGUARDS_ENABLED=false
AI_RETENTION_CLEANUP_ENABLED=false
AI_RETENTION_SCHEDULER_ENABLED=false
```

`JWT_SECRET` is supplied from the same existing secret used by Auth and Gateway;
no independent AI secret is created. Do not print its value. The current parser
requires `AI_POLICY_VERSION` as well as the explicitly listed flags. All other
settings use parser defaults. There are no provider keys, database URLs, Redis
credentials, request-signing keys or encryption/fingerprint keyrings in AI's env.

Gateway receives `AI_SERVICE_URL=http://ai-service:4011` and explicitly disables
`AI_REQUEST_SIGNING_ENABLED`, `AI_RESOURCE_SAFEGUARDS_ENABLED` and
`AI_INTERNAL_DEMO_ENABLED`. This disables conversation execution signing, not
the existing trusted Gateway identity assertion required for eligibility.
Auth current-state lookup, JWT verification and bound identity assertions remain
mandatory. Restricted/careers sessions remain excluded.

Before rollout the existing script pulls/reuses the image and invokes AI's actual
configuration parser in a network-disabled container. It verifies authenticated
routes are enabled and every other parsed `_ENABLED` flag is false. Compose checks
`/api/ready`; deployment waits for AI health and probes `/api/health` and
`/api/ready` internally. No new public AI listener or inference endpoint is added.

## Historical behavior and risks retained

The existing implicit paths-filter baseline, `cancel-in-progress: true`, shared
SSH asset directory, host-based image reuse/fallback and Compose execution remain.
The default branch is `main`; implicit comparison can select more services than
intended. Failed/cancelled deployments retain their historical recovery limitations.
This PR deliberately does not redesign those behaviors or add a deployment gate.

Original non-AI migration and Auth/HR seed blocks are unchanged byte-for-byte.
Routine DEV deployment still attempts migrations for Auth, HR, Notification,
Subscription, Marketing, Reinsurance, Accounting and Inventory. Subscription's
migration failure remains ignored. Auth seed can update administrator password/status,
permissions and demo tenant state; HR seed upserts demo departments/employees and
Auth linkage, with failure nonfatal. Existing Auth startup backfill is unchanged.
Successful SQL and partial seed effects are not automatically rolled back if later
deployment fails. AI migrations/seeds/reconciliation are entirely excluded.

Local isolated tests do not prove current shared-DEV migration or seed safety.
No live DEV data/history or configured credential values were inspected for this
feature. Review existing database effects before merging into automatic deployment.
No PROD deployment wiring or business-service implementation is changed.

## Post-deployment acceptance (not executed by this PR)

1. Confirm the build includes AI and Gateway, the expected SHA-tagged AI image is
   selected, and `ai-service` is healthy without a host port or DB/Redis credentials.
2. Confirm Gateway and existing ERP health/login remain healthy. Inspect internal
   AI `/api/health` and `/api/ready`; readiness must report `inferenceAvailable:false`.
3. Log in normally as an active, fully authenticated tenant user and request
   `GET /api/v1/ai/eligibility` with the access cookie or Bearer token. Expect:

```json
{ "eligible": true, "inferenceAvailable": false }
```

4. Confirm unauthenticated requests return 401, careers sessions are denied,
   revoked/current-state-rejected sessions fail closed, and direct forged headers
   cannot establish AI identity. Never manufacture internal signing headers.
5. Conversation creation must remain 503; no mock reply, persistence, admission,
   cleanup or inference executes. Gateway Swagger remains `/api/v1/ai/docs` and
   `/api/v1/ai/docs-json`; docs availability alone does not prove the upstream works.

This integration does not authorize conversation/demo activation, AI migrations,
shared reconciliation or external inference. Do not deploy from the feature branch.
