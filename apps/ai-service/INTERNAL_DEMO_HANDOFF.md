# Internal Demo MVP: Frontend Contract v1

## Scope and truthfulness

This is a scripted product-guidance demo, NOT a real LLM. Always show a persistent
"Scripted demo - no real AI inference or live ERP data" badge. Never claim the
assistant accessed company records. No provider SDK, external inference, business
data client, RabbitMQ job or ERP mutation is involved.

Baseline: DEV `64b410cd2b0a52c727bd15b490b1a9e7fc2da061`. Existing conversation
CRUD, authentication, encryption and shared safeguards are reused. Previously,
append stored only a user message; there was no authenticated response-generation
flow. The generic mock fixture was not a useful product demonstration.

AI is not included in the baseline DEV Compose/build/migration inventory. Merged
source is NOT deployed or enabled functionality. Current shared server state is
not asserted here; deployment investigation is explicitly out of scope.

## Stable endpoints

### Swagger / OpenAPI

AI-specific Gateway documentation:

- Local UI: `http://localhost:4000/api/v1/ai/docs`
- Local OpenAPI JSON: `http://localhost:4000/api/v1/ai/docs-json`
- Intended DEV UI: `https://dev-app.workphelo.com/api/v1/ai/docs`
- Intended DEV JSON: `https://dev-app.workphelo.com/api/v1/ai/docs-json`

Local examples use the standalone Gateway default `PORT=4000`. The DEV URLs are
intended routes, not verified live availability: they require this Gateway build,
enabled Swagger policy, and deployment/reverse-proxy route verification. The
frontend's existing `/api/v1/*` rewrite forwards them to its configured Gateway.
No frontend, Nginx or deployment configuration change is included here.

The existing root Gateway UI **`/docs`** and JSON **`/docs-json`** remain available
under the same policy: `http://localhost:4000/docs` and
`http://localhost:4000/docs-json` at the default local port. Use the actual Gateway
origin when it differs. UI, initializer, relative assets, JSON and trailing-slash
behavior are exercised by automated HTTP tests.

The six operations are grouped under **AI Assistant**. Documentation augments
Gateway's existing generated spec because its wildcard proxy cannot discover
concrete downstream paths. Dedicated docs filter the same generated paths/schemas;
there is no second schema catalog or AI-side Swagger server. HR instead hosts its
own Swagger, which the Gateway proxies. AI docs are registered at the Gateway
before its wildcard proxy, so they require neither an AI URL nor an AI process.
Only documentation GET/static routes are added; business authorization is unchanged.
AI `/api/health` and `/api/ready` remain internal probes,
not documented public assistant endpoints.

Availability follows existing `isSwaggerEnabled`: recognized `ENABLE_SWAGGER`
overrides first, otherwise `DEPLOY_ENV` controls it, falling back to `NODE_ENV`.
Documentation is public only when that existing Swagger policy enables registration,
even while conversation execution is off. This does not turn Swagger or AI on in
any shared environment. Authenticate
normally; Swagger's cookie security definition does not mint an HttpOnly session.
Cookie-based Try it out mutations also require the Swagger UI origin to be an
explicitly allowed Origin. Do not broaden CORS or enable features just to use docs.

All browser calls go through Gateway; do not call AI directly or construct identity
headers or request proofs. Prefix below is `/api/v1/ai`.

| Method/path                                  | Request                                | Success                                                                                       |
| -------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------- |
| GET `/eligibility`                           | no body                                | 200 `{eligible:true,inferenceAvailable:false}`                                                |
| POST `/conversations`                        | `{}` and Idempotency-Key               | 201 `{id,createdAt,expiresAt}`                                                                |
| GET `/conversations?limit=20&cursor=...`     | no body                                | 200 `{items:[{id,createdAt,updatedAt,expiresAt}],nextCursor}`                                 |
| GET `/conversations/:id?limit=20&cursor=...` | no body                                | 200 `{conversation:{id,createdAt,updatedAt,expiresAt},messages:{items:[Message],nextCursor}}` |
| POST `/conversations/:id/messages`           | `{content:string}` and Idempotency-Key | 201 `DemoTurn` when isolated demo mode is enabled                                             |
| DELETE `/conversations/:id`                  | no body                                | 204; repeated/missing/foreign/expired record returns 404                                      |

`limit` is 1..100; cursors are opaque and endpoint-specific. No arbitrary query
fields, repeated parameters, trailing slashes or client-provided roles/tenant IDs.
Dates are ISO UTC; IDs are lowercase UUIDs. List order and message order follow the
existing stable pagination contract. Eligibility is authentication eligibility,
NOT dependency readiness or authorization to execute a real model. It deliberately
continues to report `inferenceAvailable:false` for a scripted demo. When configured,
it additionally returns `demo:{configured:true,mode:'scripted-demo',disclaimer,questions:string[]}`.
This supplies the display label and allowed questions, not a Redis/database health
probe. Hide/disable demo chat when this field is absent; handle dependency failures
from actual chat operations.

```ts
type Message = {
  id: string;
  conversationId: string;
  sequence: number;
  role: 'USER' | 'DEMO_ASSISTANT';
  createdAt: string;
  content: string;
};
type DemoTurn = Omit<Message, 'content'> & {
  role: 'USER';
  demo: { mode: 'scripted-demo'; synthetic: true; reply: Message & { role: 'DEMO_ASSISTANT' } };
};
```

Example append body: `{"content":"What can this demo do?"}`. The response includes
the committed USER metadata and `demo.reply`, whose content begins:
`Scripted WorkPhelo demo. No LLM or live ERP data was used.` The reply has the next
sequence number. Both rows are encrypted and committed with the append receipt in
one transaction. On retry, the exact stored reply/IDs/timestamps are returned.
Committed replay is resolved under the existing owner/receipt locks before any
mock invocation. Provider unavailability does not prevent returning a valid stored
turn. A new turn generates only after no receipt is found, inside the existing
bounded transaction; this is safe only for the local mock, not a future external LLM.
Each turn consumes two message slots, both encrypted envelope charges, and one
append receipt under the existing quotas. History pages may split a turn; merge
pages by message ID and sequence rather than assuming every page contains pairs.
Default mode remains the original user-metadata-only append contract; it must not
be presented as chat. Do not silently fall back to it when a demo reply is absent.

## Authentication and requests

Use the normal local tenant login and access-token session. Only active,
fully authenticated tenant users qualify; careers/restricted sessions are excluded.
Cookie requests use `credentials:'include'`. Mutations using cookies require an
exact Origin allowed by Gateway `ALLOWED_ORIGINS`; localhost and 127.0.0.1 are
different origins. Bearer authentication is supported; do not combine conflicting
cookie/Bearer credentials. Never store a private service key in frontend env.

Gateway writes a mandatory boolean `demoIntent` into the existing signed request
proof, using only its server configuration. AI verifies that claim and compares
its own mode BEFORE consuming a nonce or entering business execution. Authenticated
mode disagreement returns sanitized 503; missing/malformed/forged claims return 401.
Neither case creates an AI nonce, message or receipt. Gateway admission can still
conservatively consume its own rate budget before AI rejects the request.
Browsers must not send mode headers or add intent fields to the JSON body; such
values cannot select the signed mode. Both ON permits only catalog turns; both OFF
preserves the existing user-only behavior. Both processes must be updated together
while conversation traffic is disabled: older proofs without the claim are rejected.

```ts
const turnKey = crypto.randomUUID(); // Persist until the result is resolved.
const response = await fetch(`${gateway}/api/v1/ai/conversations/${id}/messages`, {
  method: 'POST',
  credentials: 'include',
  headers: { 'Content-Type': 'application/json', 'Idempotency-Key': turnKey },
  body: JSON.stringify({ content: 'What can this demo do?' }),
});
const body = await response.json();
if (response.ok && body.demo?.synthetic === true) {
  // Render the submitted question and body.demo.reply with the scripted-demo badge.
}
```

## Allowed sample questions

New appends in both modes must exactly match one of these strings. Show them as
suggestion buttons in the isolated demo. The allowlist rejects all other input,
including benign paraphrases.

- `What can this demo do?`
- `How do I get started with WorkPhelo?`
- `How are employee records different from user access?`
- `Who can read my demo conversation?`

Catalog version `workphelo-product-guidance-v1` assigns a stable ID to each
question and answer. All entries are pending Product review and their approval
metadata has empty approver and timestamp fields. Review the copy before
authorizing any human demo. Future external inference requires separately
approved entries and provider authorization. The local mock receives the matched
server-owned question as its only message. Historical conversation messages are
excluded from generation.

The screen applies after committed receipt resolution. Exact retries use the
original key and content and can return a still-live committed result even if its
question is retired. A changed payload with an existing live key returns `409`.
A rejected new append returns a generic `400` without creating a message or
append receipt. The request still goes through admission and nonce verification.

## Errors and retries

Conversation-helper errors normally have `{statusCode,code,message,requestId}`.
Existing generic Gateway errors (notably early eligibility rejection and global
HTTP handling) may instead contain only `statusCode` and `message`, with optional
`error` or other existing metadata. OpenAPI models both shapes. Use HTTP status as
the fallback when code/requestId is absent; do not display raw internals.

| Status/code                            | Frontend behavior                                               |
| -------------------------------------- | --------------------------------------------------------------- |
| 400 `INVALID_REQUEST`                  | Use a catalog question; fix payload, do not auto-retry          |
| 401 `UNAUTHORIZED`                     | Reauthenticate normally                                         |
| 403 `FORBIDDEN`                        | Restricted session/origin/access denied; do not retry blindly   |
| 404 `NOT_FOUND`                        | Missing, expired or out-of-scope; do not disclose existence     |
| 409 `CONFLICT`                         | Same key with different input; resolve the pending turn         |
| 409 `AI_STORAGE_QUOTA_EXCEEDED`        | Capacity reached; do not auto-create replacement conversations  |
| 413 / 415                              | Correct size/media type                                         |
| 429 `RATE_LIMITED`                     | Respect bounded `Retry-After` (1..60 seconds); no retry storm   |
| 503 `SERVICE_UNAVAILABLE`              | Disabled/misconfigured/unavailable dependency; show unavailable |
| 504 `GATEWAY_TIMEOUT` or lost response | Commit may have succeeded; retry SAME operation/input/key       |

Use a new idempotency key only for a genuinely new turn. Gateway signs each retry
with a fresh proof automatically. Never reuse or construct proof/nonce headers.
All responses are no-store. Render plain text, not untrusted HTML.

## Isolated local enablement (separate operator authorization)

This PR enables NOTHING. Do not edit shared DEV/PROD settings. Use dedicated local
AI/Gateway processes and synthetic accounts, with isolated AI data and Redis keys.
Reuse the platform's PostgreSQL, Redis and local Auth where appropriate; no new
service, broker or persistence technology is required. Never point test commands
at a shared database. Do not reuse the HMAC namespace/secret of shared admission.

AI requires existing persistence/encryption/fingerprint/request-verification keys
and all existing conversation/security flags. Additional demo configuration:

| Process | Settings                                                                                                                                                                                                                                                              |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AI      | `NODE_ENV=development`, `AI_PROVIDER=mock`, `AI_ENABLED=true`, `AI_MOCK_ENABLED=true`, `AI_INTERNAL_DEMO_ENABLED=true`, `AI_RUNTIME_SCOPE=isolated-demo`                                                                                                              |
| AI      | `AI_AUTHENTICATED_ROUTES_ENABLED=true`, `AI_PERSISTENCE_ENABLED=true`, `AI_MESSAGE_ENCRYPTION_ENABLED=true`, `AI_MESSAGE_OPERATIONS_ENABLED=true`, `AI_REQUEST_VERIFICATION_ENABLED=true`, `AI_CONVERSATION_HTTP_ENABLED=true`, `AI_RESOURCE_SAFEGUARDS_ENABLED=true` |
| Gateway | `NODE_ENV=development`, `AI_SERVICE_URL=http://127.0.0.1:4011`, `AI_REQUEST_SIGNING_ENABLED=true`, `AI_RESOURCE_SAFEGUARDS_ENABLED=true`, `AI_INTERNAL_DEMO_ENABLED=true`, `AI_RUNTIME_SCOPE=isolated-demo`                                                           |
| Gateway | Correct local `AUTH_SERVICE_URL`, explicit `ALLOWED_ORIGINS`, dedicated `AI_ADMISSION_REDIS_URL` and `AI_ADMISSION_KEY_HMAC_SECRET`                                                                                                                                   |
| Both    | Existing compatible JWT/assertion and request-signing/verification configuration; secret values supplied securely, not committed or passed in CLI arguments                                                                                                           |

The scope flag is an explicit operator acknowledgement, not automatic proof of
physical isolation. Verify process URLs, ports, database target and Redis namespace
before enabling. Production demo execution is rejected. Keep cleanup scheduling
off unless separately authorized. Synthetic records still expire after 720 hours.

An additive migration adds `DEMO_ASSISTANT` to the message-role enum. Apply it only
to an authorized isolated target before starting updated clients. No applied SQL
is rewritten. Do not downgrade the enum or remove keys to roll back: stop demo
writes and retain reader compatibility with existing demo rows.

After secure local configuration, use existing workspace commands:
`npm run dev --workspace=apps/ai-service` and
`npm run dev --workspace=apps/api-gateway`. Start local Auth through its existing
workspace command if not running; it needs its established PostgreSQL/RabbitMQ
configuration. AI itself does not require RabbitMQ. See SHARED_RESOURCE_SAFEGUARDS.md
for explicit disposable Redis epoch setup and safe recovery; never bless live
Redis readiness automatically.

## Integration acceptance procedure

1. Normal login -> eligibility; confirm real inference is unavailable.
2. Create a conversation with a durable idempotency key.
3. Submit two different catalog questions; show two labeled synthetic replies.
4. Repeat an append with the same key/body; confirm identical IDs and no duplicates.
5. Refresh history/list; confirm ordered USER/DEMO_ASSISTANT rows and pagination.
6. Reject private/arbitrary text and foreign-user access without creating a turn.
7. Delete the conversation; detail becomes 404 and it disappears from list.
8. Turn demo configuration off in the isolated process; no scripted reply may execute.

Automated real Gateway/AI/PostgreSQL tests use an explicit Auth-current-state stub;
they do NOT replace the normal-login acceptance step with fabricated trusted headers.
CI's disposable resource runner also executes all 18 demo integration scenarios
and rejects silent skips, alongside real PostgreSQL/Redis safeguard coverage.

## Separate real-LLM approval gate

Before any external model: approve provider terms, data location/retention/training
policy and credentials; approve a versioned product-guidance corpus and a fail-closed
sensitive/uncertain-input screen. Define per-request input/output/token limits,
tenant/user budgets, total spending caps, timeouts, cancellation and sanitized
failure behavior. Authorize the specific internal demonstration and test rejection
paths. No live ERP retrieval, tools, mutations or background model execution.
No external provider SDK or connection is part of this MVP.

## Handoff validation

Local Swagger handoff validation: AI 779 tests / 27 suites; Gateway 248 tests / 12 suites,
with isolated dependencies and no skipped tests in those runs. The expanded
zero-skip runner passed PostgreSQL=22, Redis=16 and DemoGateway=18 (the Gateway
integration file also runs the existing security regressions). The 14 generated
OpenAPI contract tests exercise root and dedicated UI/initializer/JSON/assets,
trailing slashes, six operations, shared schemas, authentication, errors, disabled
Swagger policy and unchanged default-disabled AI behavior. AI/Gateway
typechecks, builds and lint passed; Gateway retains 17 pre-existing warnings.
Prisma generation/validation, fresh disposable migration sequence, formatting,
RBAC alignment and whitespace checks passed. Only disposable local databases were
migrated. No Docker image rebuild was performed for this MVP change.

Real Auth AppModule -> Gateway -> AI -> disposable PostgreSQL passed 21 scenarios;
only outbound messaging clients were replaced with rejecting doubles. The first
full AI run had one socket reset in an existing authorization HTTP fixture; its
isolated 69-test suite and the final full 779-test rerun passed without changing
its assertions or timeouts. This observation is not a claim that transport flakiness
has been eliminated.

The initial clean-install CI job failed because Gateway's `@work-phelo/config`
workspace was not built. The focused job now explicitly builds that workspace
before the runner, which requires all 18 demo cases and zero skips. No Redis or
PostgreSQL tests were removed or relaxed. The four existing migrations are unchanged.

Forced root typecheck stopped in unrelated local Marketing Prisma generation with
`Unexpected end of JSON input`; no Marketing source or generated artifacts are
included. Root-wide validation is not claimed green locally. Fresh-install GitHub
CI is a separate review gate; its actual status belongs in the PR/report.

No shared deployment, migration, key rotation, permission reconciliation, real
provider call or feature activation was performed. Frontend UI implementation and
an authorized normal-login demonstration remain subsequent integration steps.
