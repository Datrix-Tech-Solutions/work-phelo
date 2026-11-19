# WorkPhelo API Gateway

The API Gateway is the public HTTP entry point for WorkPhelo backend services.
Current environment URLs are listed in the root repository README.

## Responsibilities

- Route `/api/v1/*` requests to downstream services.
- Validate JWT cookies or bearer tokens for protected routes.
- Forward tenant/user context headers to downstream services.
- Fetch and sign dynamic permission headers for non-auth services.
- Stream multipart uploads, including HR employee import CSV uploads.
- Expose gateway Swagger when Swagger is enabled.

## Route Prefixes

| Prefix                             | Downstream service   |
| ---------------------------------- | -------------------- |
| `/api/v1/auth/*`                   | Auth Service         |
| `/api/v1/hr/*`                     | HR Service           |
| `/api/v1/notification/*`           | Notification Service |
| `/api/v1/subscription/*`           | Subscription Service |
| `/api/v1/marketing/*`              | Marketing Service    |
| `/api/v1/operations/reinsurance/*` | Reinsurance Service  |
| `/api/v1/accounting/*`             | Accounting Service   |

Downstreams must be configured for the target environment. A route can exist in
dev but return `503 Service is not configured` in prod if that service is not in
the prod deployment.

## Local Development

```bash
npm run dev --workspace=apps/api-gateway
```

Default local port: `4000`

Local Swagger: `http://localhost:4000/docs`

## Deployed URLs

| Environment | API Gateway                            |
| ----------- | -------------------------------------- |
| Dev         | `https://dev-api.workphelo.com/api/v1` |
| Prod        | `https://api.workphelo.com/api/v1`     |

Browser code should still call same-origin `/api/v1/...` from the app host.

## Key Environment Variables

- `JWT_SECRET`
- `AUTH_SERVICE_URL`
- `HR_SERVICE_URL`
- `NOTIFICATION_SERVICE_URL`
- `SUBSCRIPTION_SERVICE_URL`
- `MARKETING_SERVICE_URL`
- `REINSURANCE_SERVICE_URL`
- `ACCOUNTING_SERVICE_URL`
- `ALLOWED_ORIGINS`
- `ENABLE_SWAGGER`

Do not commit secret values.

## Optional AI Routing Foundation

`AI_SERVICE_URL` is an optional, operator-controlled HTTP(S) origin (no credentials,
path, query, or fragment). Missing or invalid configuration disables AI routing
with a 503 response without preventing ERP startup. AI is an optional health
dependency; an unreachable or unhealthy AI service does not fail Gateway health.
The health aggregator may inspect the internal `/api/health` probe, but the
business namespace does not forward `/api/v1/ai/health` or `/api/v1/ai/ready`.

The reserved `/api/v1/ai/...` namespace maps to `/api/...` using the existing
JWT verification and live Auth `/me` lookup. Forwarded assertions have audience
`ai`, expire after 30 seconds, and retain the existing token/permission hash
binding. Caller identity headers are replaced with current Auth state. Careers
and other explicitly scoped sessions cannot access AI. Existing assertion
signatures do not bind request bodies or queries; this slice does not change
that protocol or authorize any business operation.

Registration itself grants no authenticated AI operation. Phase 2A.3 adds only
`GET /api/v1/ai/eligibility`, verified by the AI service's exact handler policy
and trusted-context guard when authentication routes are enabled. Internal
probes remain excluded from this namespace, and undeclared AI handlers remain
denied. Mock downstream tests prove routing only, not live Auth/DB validation or
an available chat/inference API. `AI_ENABLED` is not consulted by Gateway and
cannot grant inference access.

A later, separately reviewed rollout must supply `AI_SERVICE_URL` through the
Gateway runtime environment. This change adds no deployment/Compose forwarding,
provider credentials, or tenant configuration. Downstream trusted-context
verification is a prerequisite before any authenticated AI handler is added.

## Phase 2B.5B.1: Isolated AI Request-Integrity Foundation

`src/proxy/ai-request-integrity.ts` provides an internal final-forwarding builder,
signer and HTTP adapter. No controller invokes the builder/signer/adapter. There
is no public conversation endpoint or downstream verifier, and no nonce storage.
Signing configuration does not activate a route or authorize production use.

The live proxy still creates the original identity assertion unchanged. Only
AI-specific hygiene is added: caller `x-ai-request-integrity` is stripped, valid
cookie-only access is forwarded as one canonical Bearer credential without cookies,
and conflicting/ambiguous credentials fail closed. Other services retain existing
behavior. Eligibility is not signed and requires no new key. The future
conversation namespace and ambiguous AI path aliases are blocked; the existing
downstream exact-handler/default-deny policy remains unchanged.

### Configuration and custody

- `AI_REQUEST_SIGNING_ENABLED`: strict `true|false`, absent means disabled.
- `AI_REQUEST_SIGNING_KEY`: canonical padded base64 encoding of exactly 32
  dedicated random bytes. No generated/default runtime key exists.
- `AI_REQUEST_SIGNING_KEY_ID`: lowercase SHA-256 hex digest of those raw bytes.
  This stable content-addressed ID rejects material replacement under an old ID.
- Enabled signing is restricted to `NODE_ENV=test|development` in this foundation.
  Production use requires a separately reviewed verifier/nonce/enablement slice.

`parseAiSigningConfig` fails closed for enabled invalid configuration. It is not
part of global required-service startup validation: missing optional AI signing
material cannot disable ordinary ERP startup, health or existing eligibility.
An internal caller must explicitly validate config before constructing the signer.
The flag alone has no effect on live proxy signing in this slice.

Keys must differ from JWT, AI encryption, submission-fingerprint and other domain
keys. Known reuse is rejected when comparison material is present; do not copy
other services' secrets to Gateway merely to compare them. Configuration cannot
prove entropy or global key separation. Keep key strings out of command arguments,
environment dumps, request/header logging and diagnostics. Buffer clearing is
best effort, not secure erasure of JS strings, environment or native key state.
No deployment/Compose/env files or dependencies are changed here.

Future rotation: Gateway uses one deliberate active key/ID; the future AI verifier
must temporarily retain previous verification keys across rollout plus maximum
proof lifetime/clock allowance. Switch the signer only after verifier rollout,
drain old proofs, then retire by approved procedure. No rotation or verifier is
implemented. Symmetric keys are known to both peers: this is not asymmetric proof
that only Gateway could sign, and a compromised peer remains trusted-key risk.

### Descriptor and wire contract

The descriptor is an opaque frozen token backed by private WeakMap state. It
captures uppercase method, normalized downstream path, exact validated raw query,
one final JSON serialization as private bytes, canonical content type, selected
token, existing identity assertion/permission representation, optional idempotency
key, absolute deadline and random request UUID. Caller mutation cannot change it;
mutable Buffers/native HTTP request objects are not exposed.

The builder accepts only the five proposed conversation method/path forms, not
eligibility, probes or arbitrary services. Canonical lowercase UUIDs are required.
Duplicate slashes, trailing aliases, dot segments, percent-encoded paths and
backslashes cannot be normalized into valid targets. GET query keys are limited
to unique `limit` (1..100) and `cursor` (bounded base64url token spelling after
strict percent decoding). Exact accepted query order/escaping is preserved, not
sorted/re-encoded. No shared ambiguous canonicalization helper is reused.

Transfer-Encoding and duplicate framing are rejected. Only identity content
encoding and JSON content type are accepted. Parsed POST JSON is serialized once;
body absence, `{}` and JSON null are distinct. Wire size is at most 32 KiB. The
original Content-Length may differ after parsing/reserialization: the adapter
replaces it with the final byte length. The builder assumes the ingress parser
has consumed valid framing; future live integration must enforce AI-specific
ingress limits before parsing and use the same exact final descriptor. This is
not a conversation DTO validator: required content fields/limits belong to the
future API slice. GET/DELETE bodies are rejected.

The adapter emits only the captured credential/context, permissions, proof,
idempotency and canonical body headers. Native transport adds Host/connection
framing; it does not reconstruct signed fields. It writes the captured bytes
directly and permits only send/cancel, with an absolute deadline and sanitized
failure callback. No automatic retry is installed.

### Proof version 1

Compact JWS, HS256, explicit `kid`, type `workphelo.ai.request+jwt`, issuer
`workphelo-gateway`, audience `workphelo-ai-request`, and integer `iat/exp` with
validity at most 10 seconds. Deadline is a safe integer epoch-millisecond instant,
future and no more than 10 seconds away when the descriptor is built. Proof expiry
is capped by that deadline (second precision may expire slightly earlier).

Payload fields: `v=1`, `method`, `pathHash`, `queryHash`, `bodyHash`, `bodyLength`,
`contentType`, `idempotencyKeyHash`, `tokenHash`, `identityAssertionHash`,
`deadlineAtMs`, `requestId`, and `jti` (32 random bytes encoded base64url).
Request IDs are random UUIDs. Hashes use SHA-256 lowercase hex. Path/query fields
hash UTF-8 JSON tuples `["workphelo.ai.request",1,field,value]`, with field labels
`path` and `raw-query`. Idempotency uses label `idempotency-key`, with value
`JSON.stringify(keyOrNull)`, distinguishing absence explicitly. Body hashes cover
the final bytes directly; token/assertion hashes cover their exact UTF-8 strings.
Content type is `application/json; charset=utf-8` when a JSON body exists,
otherwise the empty string. Raw query excludes the leading question mark.

### Evidence and next gate

Tests capture actual loopback HTTP method/target/headers/body and verify signed
claims against those exact received bytes. They also cover post-seal caller
mutation, framing/alias rejection, key separation, nonce/request-ID samples,
cryptographic claim tampering, credential handling and legacy proxy regressions.
Identity/current-Auth fixtures are explicit; this is not live Auth or AI receiver
validation. Randomness samples are not a proof of collision freedom.

No replay prevention is claimed. The future verifier must strictly check proof
types, algorithm, issuer/audience/lifetime, both credential/context hashes,
actual received raw bytes and target, deadline, and atomically consume nonces
across replicas. It must reject legacy/unsigned conversation execution and never
let idempotency receipts substitute for replay protection. TLS/network isolation,
CSRF/browser-origin policy, key custody, deadline propagation and existing backup
reconciliation/retention gates remain prerequisites. Do not enable conversation
HTTP, inference or ERP access from this signing foundation.

# Phase 2B.5B.5: controlled conversation forwarding

This section supersedes earlier notes saying conversation forwarding is always
blocked. Exactly the five storage routes are connected through the AI-specific
immutable descriptor, signer and private HTTP adapter. They remain disabled by
default (`AI_REQUEST_SIGNING_ENABLED` absent/false), and production signing is
prohibited. No deployment/env file, public inference or ordinary ERP proxy flow
is changed.

`main.ts` installs `aiConversationJsonBoundary()` before ordinary JSON parsing.
It bounds AI JSON to 32 KiB and rejects duplicate security/framing headers,
transfer encoding, unsupported media/encoding, invalid UTF-8 and length ambiguity.
Rejected framing/unread-body connections are closed rather than reused. Actual
body presence is recorded separately from Express's empty parsed body defaults.
The descriptor serializes the final body once; original whitespace/escaping may
canonicalize, but the adapter sends exactly the resulting signed bytes. Empty
and absent bodies are not silently converted into `{}`.

The conversation path selects one unambiguous credential, rejects restricted
JWTs, pins HS256 and calls Auth `/me` for every request. Caller identity/integrity
headers are stripped. No signing key or valid Auth state means no forwarding.
Gateway mints the existing identity assertion and signs the final verb, canonical
downstream path, raw query, bytes, length, media type, credential, assertion,
idempotency header (including absence), request ID and absolute deadline.
No business idempotency key is generated or replaced.

Cookie-authenticated POST/DELETE require exact canonical Origin membership in
`ALLOWED_ORIGINS`, using the existing frontend default `http://localhost:3000`
when unset. Missing/null/malformed/untrusted Origin and wildcard configuration
are rejected. No Host/forwarded-header reflection or subdomain wildcard grants
trust. Matching cookie+Bearer still counts as cookie authentication for this
check; differing credentials are rejected. Bearer-only non-browser requests
remain supported; cookie GET does not require mutation-CSRF Origin validation.
CORS is unchanged and is not treated as authorization. CORS preflight, when
handled by the existing global CORS layer, does not authorize/sign an operation.

The AI-specific five-second deadline starts at conversation dispatch, before
Auth lookup; it does not impose an upload deadline. Auth lookup and outbound
request/response processing share this budget. Global ERP proxy timeouts remain
unchanged. The signed adapter uses isolated connections (`agent:false`), avoiding
reuse with the legacy identity-only eligibility proxy. Alternating those paths
exposed pooled-connection 400 responses in integration tests; isolation removes
that interference without changing the global agent or other service forwarding.
Client cancellation/timeout destroys the outbound request, not an already
committed database transaction. Recovery requires a fresh proof and the original
business key; no rollback claim is made solely from an HTTP timeout.

Responses are buffered to 256 KiB, structurally checked against the operation's
success contract, and re-serialized without forwarding upstream cookies, headers
or raw error details. Errors use safe status/code/message/requestId; all
conversation responses use `Cache-Control:no-store`. This path adds no raw
request URL/body/token/proof/key logging. Unknown targets/verbs do not get signed.
Eligibility and operational probes retain their earlier boundaries.

Real HTTP integration tests compile current Gateway source in memory and use a
real AI app and disposable PostgreSQL. Auth `/me` is explicitly stubbed; separate
Auth strategy/current-context tests cover those components, not a full Auth DB
integration. Tests include actual client response loss after verified DB commit,
eight concurrent copies of one proof, fresh-proof receipt retries, altered-byte
rejection, outage/key mismatch, ownership, CSRF and total Auth deadline behavior.

Capacity remains a rollout blocker: global in-process/IP Throttler buckets are
30/second, 150/10 seconds and 600/minute, not AI user/tenant quotas and not shared
across replicas. No Redis-backed throttler storage was found. Redis elsewhere in
the platform does not itself provide shared AI rate limits. No aggregate
conversation/message/byte cap or concurrent-job quota is implemented. Retention,
nonce/receipt cleanup, backup deletion reconciliation, shared limits and key
operations require explicit production approval; none is enabled here.
