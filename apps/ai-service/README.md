# AI Service Foundation

The service currently provides foundation-only health/readiness and an internal,
non-production deterministic mock provider. It does not expose inference or
conversation APIs. External inference remains disabled.

## Local workspace commands

From the repository root, use `npm ci` and then:

```sh
npm run test --workspace=apps/ai-service -- --runInBand
npm run check-types --workspace=apps/ai-service
npm run lint --workspace=apps/ai-service
npm run build --workspace=apps/ai-service
```

Required runtime settings are `NODE_ENV` (`development`, `test`, or `production`),
`AI_PROVIDER=mock`, and a nonempty `AI_POLICY_VERSION` identifier. Optional strict
booleans `AI_ENABLED` and `AI_MOCK_ENABLED` default to false. Production rejects
either flag being true. `AI_SERVICE_PORT` defaults to 4011 (1-65535), and
`AI_REQUEST_TIMEOUT_MS` defaults to 5000 (1-25000). No database or provider
credentials are required. Example foundation-only startup after building:

```sh
NODE_ENV=production AI_PROVIDER=mock AI_POLICY_VERSION=foundation-v1 \
  AI_ENABLED=false AI_MOCK_ENABLED=false npm start --workspace=apps/ai-service
```

`GET /api/health` returns `200 {"status":"ok","service":"ai-service"}`.
`GET /api/ready` returns `200` with `status: "ready"`, `service: "ai-service"`,
and `inferenceAvailable: false`; invalid internal state or shutdown returns 503.
Readiness describes only this foundation, not authentication, persistence,
knowledge retrieval, or real inference. Probes make no external calls.

The global default-deny guard exempts only the exact probe controller, handlers,
GET methods and paths. Registered undeclared routes are denied; unknown routes
remain 404. Identity headers never grant access. Logs use generated correlation
IDs and safe route templates, not bodies, credentials, raw paths, or queries.
The mock runs only internally with both flags enabled in development/test. Its
fixed synthetic output and word-based usage counts are non-billable fixtures,
not real model output or measured provider tokens.

## Local-only Docker validation (B6)

Build from the repository root; do not use the service directory as context:

```sh
docker build --no-cache -f apps/ai-service/Dockerfile -t workphelo-ai-foundation:local .
node apps/ai-service/scripts/verify-container.mjs workphelo-ai-foundation:local
docker run --rm --name workphelo-ai-foundation-local --network none \
  --read-only --tmpfs /tmp:rw,noexec,nosuid,size=16m --cap-drop ALL \
  --security-opt no-new-privileges \
  -e NODE_ENV=production -e AI_PROVIDER=mock -e AI_POLICY_VERSION=foundation-v1 \
  -e AI_ENABLED=false -e AI_MOCK_ENABLED=false workphelo-ai-foundation:local
```

From another terminal, probe the same container's loopback interface:

```sh
docker exec workphelo-ai-foundation-local node -e "fetch('http://127.0.0.1:4011/api/ready').then(async r => console.log(r.status, await r.json()))"
docker stop --time 5 workphelo-ai-foundation-local
```

Use a unique image/container name if these names already exist. The example
publishes no host ports and disables external networking. The Docker healthcheck
uses container loopback, which remains available with `--network none`.
SIGTERM/SIGINT trigger Nest shutdown hooks. The image runs as the `node` user;
production dependency installation excludes Prisma CLI and development tooling.
No source, local env files, migrations, or other applications are copied into the
runtime image. The service-generated production Prisma Client and engines are
copied explicitly. Both hoisted and workspace-local dependencies are
retained. Build-time package downloads are separate from runtime networking.

`Dockerfile.dockerignore` is the effective ignore file for the root-context build;
the service `.dockerignore` mirrors it. Keep them identical. A nested
`.dockerignore` alone would not override the repository-root ignore rules. The
allowlist excludes local secrets, tests, generated files, and other services.
Include individual build files or production TypeScript patterns only, never
directory-level negations such as `!apps/` or `!apps/ai-service/src/`. Those can
re-admit arbitrary descendants. Final exclusions also reject hidden files,
credential filenames and private-key fixtures. Migrations are applied separately
from their repository paths; image compilation needs only `prisma/schema.prisma`.

Run the synthetic-only context, exported-layer/cache and runtime regression:

```sh
node apps/ai-service/scripts/verify-docker-context.mjs
node apps/ai-service/scripts/verify-docker-context.mjs --context-only --fallback-ignore
```

The full check builds Linux/AMD64 without cached layers, scans an exported local
BuildKit cache and runs `verify-container.mjs`. It needs a Docker builder with
local cache export support. It copies only public build inputs into a disposable
directory, never local env files, credentials or dependency directories. The
fallback checks the mirrored rules as a root ignore; service-directory context
remains unsupported. Canary checks cannot detect secrets embedded deliberately
in an otherwise approved source or manifest file.
The Node 20 base digest follows this repository's current CI/service major.
Node 20 is now [upstream end-of-life](https://nodejs.org/en/about/eol); this is
an inherited platform risk, not production security approval. A separately
approved runtime/dependency uplift is required before production rollout.

The optional verification script requires a local Docker daemon. It creates only
uniquely named disposable containers, uses no external network or published
ports, checks production safety and both shutdown signals, and removes only the
container IDs it created. It does not build, publish, delete the supplied image,
or touch unrelated Docker resources. Remove your test image separately when done.

## Prisma configuration (B5)

The service reserves ownership of PostgreSQL schema `ai`. The model-free
`prisma/schema.prisma` follows the repository's Prisma 5.22.0 multi-schema
conventions and declares future client output at `prisma/generated/client`.
Declaring this datasource does not create the database schema.

Prisma is an explicit development dependency for validation only. No Prisma
Client dependency, service, repository, connection, model, or migration is
introduced. Application startup, build, tests, health, and readiness do not
require `DATABASE_URL` or initialize a database connection.

From the repository root, validate with a deliberately non-secret placeholder:

```sh
DATABASE_URL='postgresql://placeholder:placeholder@127.0.0.1:1/placeholder?schema=ai' \
  npm run db:validate --workspace=apps/ai-service
```

Validation checks schema configuration; it does not inspect or modify a database.
Do not substitute a shared DEV/PROD connection for this foundation check.

Client generation is deferred until actual persistence models are introduced.
The installed Prisma 5.22.0 CLI rejects zero models by default during generation.
Its optional `--allow-no-models` path is deliberately not used in this foundation.
There is intentionally no `db:generate`, migration script, or automatic
prebuild/pretest Prisma hook. Do not add placeholder models, generate an empty
client, or auto-install `@prisma/client` to make the foundation appear complete.

## Future persistence (not implemented)

Later approved work will add conversations, messages, request receipts, usage,
budget buckets, audit events, and approved knowledge versions/chunks under this
service's `ai` schema. Tenant/user ownership constraints, composite indexes,
idempotency constraints, and migration SQL belong with those concrete models in
`prisma/schema.prisma` and `prisma/migrations/`.

Conversation history retention is approved at 30 days. Audit/receipt retention
and backup-erasure policies remain unresolved; no defaults are assigned here.
Persistence and deployment require separate approval. Phase 1 has no Gateway or
Auth integration, careers-session filtering, conversation APIs/storage/deletion
jobs, encrypted messages, knowledge retrieval, sensitive-input screening,
usage/budget persistence, provider SDKs, tools, business-record reads/writes,
frontend, or Compose/deployment wiring. None of those capabilities is implied
by a healthy container.

Phase 2 requires separate implementation approval, a fresh verified development
baseline, trusted current-state authentication and ownership policy, and
reviewed persistence/encryption/migration design. Before any external inference,
provider terms, data handling, sensitive-input controls, and numerical spend
budgets must be approved. Conversation retention is 30 days; the unresolved
audit/receipt and backup policies above remain release gates for their records.

## Phase 2A.2: Internal Trusted Authentication

This section supersedes the Phase 1 authentication deferral above only for the
internal verification module. No authenticated HTTP handler is registered.
`FoundationOnlyGuard` remains the global exact-handler policy, allowing only
`GET /api/health` and `GET /api/ready`, with their unchanged response contracts.
Enabling authentication does not change this policy or enable inference.

`AI_AUTHENTICATED_ROUTES_ENABLED` is a strict boolean, default false. Foundation
startup needs no JWT secret. When this flag is true, validation requires a
nonempty, unpadded `JWT_SECRET`, using the existing Auth/Gateway shared secret,
not an independent AI secret. The verification guard also fails closed if its
configuration is disabled or unusable. No deployment forwarding is added here.

`TrustedAuthModule` exports verification-only components. A future explicitly
approved handler must use `TrustedAuthGuard` AND be admitted by the exact global
handler policy. There is no reusable public-route bypass. Test-only controllers
exercise authentication without adding application endpoints.

Both original session JWT (cookie first, then bearer) and signed
`x-gateway-auth-context` are mandatory. Verification uses HS256. Current Auth
access JWTs have no issuer/audience/type/scope; scoped, non-user, or unsupported
claim combinations are rejected. Assertions require issuer `workphelo-gateway`,
audience `ai`, integer iat/exp, max age and maximum lifetime 30 seconds, and at
most five seconds future issued-at skew. Original JWT expiration is independently
checked. SHA-256 hashes bind the original token and exact serialized
`x-user-permissions`; signed user/tenant IDs must match the session. Identity,
role, module/feature configuration and permissions come only from verified
context, never unsigned identity headers or stale session permission claims.

Gateway's live Auth `/me` lookup checks ACTIVE user/tenant, membership, access
suspension and session version. AI makes no Auth/database calls: it relies on
that bounded signed result, not independent proof of current database state.
Revocation does not instantly invalidate a captured assertion within its existing
short validity window. Careers and unknown restricted scopes are independently
rejected even with otherwise valid signatures. Authentication grants no ERP
module or resource access, and does not require a TenantAdmin role.

The existing protocol does not bind request method, path, body or query, and has
no replay nonce. Shared HMAC secrets technically let any holder sign assertions;
this module exposes no signing operation, but cannot remove that key-ownership
limitation. Asymmetric trust separation is deferred, not silently implemented.
No eligibility, chat, provider, business-data, persistence or migration work is
included. Phase 2A.3 requires separate approval and explicit handler policy/tests.

## Phase 2A.3: Authenticated Eligibility

This section supersedes the previous no-authenticated-handler limitation only
for `GET /api/eligibility` (Gateway: `GET /api/v1/ai/eligibility`). Successful
responses contain exactly `{"eligible":true,"inferenceAvailable":false}`.
No identity, permissions or runtime/provider configuration is returned.

The global `FoundationOnlyGuard` admits the exact EligibilityController handler,
GET verb and exact path only by directly invoking `TrustedAuthGuard`. A missing
method-level decorator cannot make it public. Probe exemptions are unchanged;
undeclared handlers remain forbidden, unknown routes remain 404. No generic
public decorator or broad controller exemption is introduced.

Eligibility and authentication failures on its GET handler have
`Cache-Control: no-store`. Default-disabled authentication returns a sanitized
503, even with otherwise valid credentials; enabled invalid credentials return
401, never an eligible-false 200. Valid tenant users need no business module,
AI permission assignment or administrator role. Gateway/Auth current-state
validation remains authoritative; the AI service performs no DB/Auth lookup.

`AI_AUTHENTICATED_ROUTES_ENABLED=true` and the established shared `JWT_SECRET`
enable verification, not inference. Production mock restrictions remain intact,
readiness still reports `inferenceAvailable:false`, and no conversation, model
execution, ERP retrieval or deployment wiring is included. Phase 2A.4 requires
separate approval; existing replay/shared-secret limitations remain unchanged.

## Phase 2B.1: Isolated Persistence Foundation

This section supersedes the model-free/generation-only deferrals above. It does
not authorize conversation HTTP APIs or message writes. Existing health,
readiness, trusted authentication and eligibility contracts remain unchanged.

`AI_PERSISTENCE_ENABLED` defaults to false. Disabled foundation/eligibility mode
never constructs/connects a database client and needs no `DATABASE_URL`.
Explicitly enabling persistence requires a PostgreSQL URL with exactly
`schema=ai` and no `options` search-path override. Invalid configuration fails
startup validation; connection failures fail closed with sanitized errors.
Runtime operation failures return sanitized service-unavailable errors. Existing
readiness describes the foundation, not a continuous database availability probe.
No startup path runs migrations. Shutdown disconnects the owned client.

`@prisma/client` and Prisma CLI are pinned to 5.22.0. `db:generate`, plus build,
typecheck and test prehooks, generate only `prisma/generated/client`. Generation
does not connect to a database. Generated files remain ignored. The Docker
builder generates the target-platform client; the runtime copies that client
and engine, not migration SQL or Prisma CLI. No deployment/Compose wiring changes.

### Schema and SQL draft

`20261118120000_add_ai_persistence_foundation` creates three AI-schema tables:
`AiConversation`, `AiConversationMessage`, and `AiSubmissionReceipt`.
Conversation IDs use UUID columns; Auth tenant/user IDs remain opaque text. There are no Auth
or ERP schema foreign keys. Timestamps are `timestamptz(3)`. Expiry is required
explicitly: this slice does not select the still-unapproved 30-day expiry anchor.

The parent composite key `(id,tenantId,ownerUserId)` is referenced by all three
message ownership columns with delete cascade/update restrict. Message sequence
and `(keyId,nonce)` are unique. There are no plaintext message columns or
repository message writes. Envelope CHECKs prove shape only, NOT cryptographic
validity: positive version, nonempty key/ciphertext, 12-byte nonce, 16-byte tag.
Encryption is deferred to 2B.2.

Receipt uniqueness is `(tenantId,ownerUserId,operation,idempotencyKey)`.
Opaque ASCII keys use 1-128 letters/digits/`._:-`, beginning with a letter/digit;
keys must not contain content, identities or credentials. Versioned fingerprints
are 32 bytes with an explicit fingerprint key ID; no fingerprint algorithm or
replay policy is implemented yet. Expiry is required with NO retention default.
Result UUIDs are deliberately not FKs, so parent deletion cannot erase receipts.
There is no receipt write API or completed business-operation workflow here.

Prisma-generated SQL is supplemented with CHECKs for expiry, sequence and
envelope/fingerprint bounds, plus a trigger preventing ownership, ID, creation
time and expiry changes or decreasing next-message sequence. These guarantees
are not expressed by Prisma alone. Future schema diffs must preserve the custom
SQL. Owned-list, parent-FK, unique and expiry indexes are present.

The draft is additive and was applied only to an explicitly disposable AI test
database. It grants no production privileges. Rolling back after data exists
would delete content: prefer disabling persistence and retaining tables; any
destructive rollback requires separate approval and recovery planning.

### Internal repository boundary

`PersistenceModule` exports only `OwnershipContextFactory` and
`ConversationsRepository`, not the generic database provider/client.
`fromRequest()` cryptographically verifies the existing trusted credentials and
mints an opaque WeakMap-backed owner token. JSON objects and client fields
cannot forge it. Trusted Auth IDs must be nonempty; conversation IDs must be UUIDs.
This does not add an Auth/database identity lookup.

Repository operations are `create(context, expiresAt)`, `findOwned(context,id)`,
`requireOwned(context,id)` and `listOwned(context,limit)`. Every access uses both
tenant and owner filters and excludes expiry using a database-clock cutoff.
Only IDs/timestamps are projected, never envelope/receipt data. Missing, foreign,
deleted and expired IDs have the same null/404 behavior. Lists have bounded
limits (default 20, maximum 100) and deterministic creation/UUID ordering; these
are internal bounds, not a finalized public pagination contract. No generic
query, delete, message, decryption or receipt mutation repository API exists.

A Prisma `schemas=["ai"]` declaration is NOT role isolation or tenant RLS.
Production needs a non-superuser AI runtime role with only AI-schema USAGE and
DML on these three tables, no other-schema access, migration-table access or
schema DDL. Use a separately controlled migration role. No shared credentials
or grants were modified. Application ownership filtering remains necessary.

### Validation and remaining gates

Normal AI tests skip `postgres.integration.spec.ts` unless
`AI_TEST_DATABASE_URL` is explicitly supplied. The suite rejects anything except
a loopback URL whose database is `workphelo_ai_2b1` and schema is `ai`, and checks
the database name again before fixtures. Never substitute DEV/PROD URLs.
The disposable integration run applies the actual draft migration, exercises
real constraints/cascade/unique races and role isolation, and checks an owned-list
index plan with sequential scans disabled (index usability, not a production
performance benchmark). Only the identity adapter is mocked for repository tests;
Phase 2A suites separately cover cryptographic authentication.

Pending: expiry anchor; receipt/audit/backup retention; deletion/restore rules;
encryption/key recovery; transactional idempotency and message sequencing;
request integrity before content-bearing APIs. No persistent audit model,
cleanup worker, encryption service, plaintext write, inference, ERP access,
frontend or public storage route is implemented.

## Phase 2B.2: Internal Authenticated Encryption

This section supersedes only the encryption-service deferral above. There are
still no public encryption, message-writing or conversation APIs, no rotation
job, and no inference. No schema/migration or deployment environment changes.

### Runtime key contract

`AI_MESSAGE_ENCRYPTION_ENABLED` defaults to false and is independent of
persistence, authenticated routes and model-execution flags. Disabled mode
requires no keys and encryption/decryption operations fail closed. Enabled
mode validates keys during startup, even with persistence disabled.

Required only when enabled:

- `AI_MESSAGE_ENCRYPTION_ACTIVE_KEY_ID`: the lowercase 64-character SHA-256 hex
  digest of the active key's raw 32 bytes.
- `AI_MESSAGE_ENCRYPTION_KEYS`: JSON ARRAY of objects with exactly `id` and
  `key`. Each `id` has the same content-addressed format; each `key` is canonical
  padded base64 encoding exactly 32 cryptographically random bytes.

Conceptual format: `[{"id":"<SHA256-hex-of-raw-key>","key":"<32-byte-key-base64>"}]`.
These placeholders are NOT usable secrets or defaults. Operators must provision
dedicated high-entropy AI keys using approved secret custody. No application
path generates encryption keys, derives them from passwords or falls back to
JWT/HR/Reinsurance keys. Known reused keys are rejected when their other-service
values are present in the process; absence of those secrets cannot prove global
key separation. Do NOT distribute other services' keys to AI just to compare them.

Array entries reject duplicate IDs, unknown fields, malformed encodings and
wrong lengths. Content-addressed IDs reject changed material under an old ID,
without requiring a database or mutable key registry. IDs are nonsecret
fingerprints, not aliases or key material. This guarantee relies on SHA-256
collision resistance and properly random keys. Length/encoding validation cannot
prove entropy or detect every form of password-derived provisioning.

The key ring is immutable for a process lifetime. Changes require a controlled
restart; there is no reload, key export, removal, retirement or public key API.
The module exports only the encryption service and message-context factory.
Temporary raw buffers are cleared where feasible, but JS strings, process memory
and native crypto state do NOT provide a secure-memory-erasure guarantee.

Keep keys out of process arguments, committed files, debug dumps, tracing,
request/error objects and container-inspect output. Environment-based custody
requires restricted host/Docker/CI access and protected transport. This code
cannot protect keys from a compromised process or authorized host administrator.

### Envelope and authenticated context

`encryptMessage(plaintext, context)` always uses the active key and a fresh
12-byte Node CSPRNG nonce. AES-256-GCM emits a 16-byte tag and the exact Prisma
envelope fields: `encryptionVersion` (1), `keyId`, `ciphertext`, `nonce`,
`authenticationTag`. Binary fields are Buffers; no plaintext is included.

The internal technical ceiling is 16 KiB of UTF-8, NOT an approved public API
contract. Empty input is rejected to preserve the existing SQL nonempty-ciphertext
constraint. Invalid surrogate strings are rejected, not replaced. Whitespace,
BOMs and Unicode normalization are preserved. Decryption accepts only the known
version and exact envelope fields/types/lengths, looks up one key by ID, checks
GCM authentication before returning plaintext, and decodes UTF-8 strictly.
There is no plaintext fallback or trial-and-error key selection.

`MessageContextFactory.forMessage(owner, metadata)` accepts only an opaque
Phase 2B.1 verified owner token plus server-created conversation/message IDs,
USER role and positive PostgreSQL-int sequence. It snapshots these values into
another opaque token. It does NOT prove that the parent exists or is owned:
Phase 2B.3 must perform that scoped, unexpired parent check before allocation
and encryption. Never mint metadata from an unvalidated request body or cache
ownership contexts across requests.

AAD is UTF-8 JSON of this fixed-order tuple:
`["workphelo.ai.message",1,tenantId,ownerUserId,conversationId,messageId,role,sequence,encryptionVersion,keyId]`.
The first integer versions the encoding. Exact strings are preserved; no
ownership normalization occurs. Use exact persisted/server-allocated values.
Unambiguous JSON boundaries and all bound fields, including key ID, prevent
ciphertext substitution between owners/messages or envelope versions.

Internal errors expose static categories only: unavailable configuration/key,
invalid context/plaintext/envelope, failed authentication and non-retirable key.
They contain no underlying OpenSSL error, cause, material, ID or content. Existing
HTTP normalization stays generic. There are no crypto logs or HTTP controllers.

### Rotation compatibility and limits

Active writes and historical reads are supported. An unknown historical key
fails closed; the service cannot recover its content. `assertRetirementCandidate`
rejects active/unknown keys but is NOT retirement approval and does not inspect
live rows, backups or other running processes. There is no automatic retirement.

Future separately approved rotation should:

1. Deploy both keys everywhere with the old key still active, then switch active
   IDs and drain all old writers while retaining historical read keys.
2. Authorize a dedicated maintenance operation; do not forge user ownership
   contexts or add an administrative conversation-read bypass here.
3. Scan bounded batches, preserving IDs/owner/sequence/role/expiry; decrypt using
   the old key and re-encrypt under the active key outside long DB transactions.
4. Atomically compare-and-set ALL envelope fields using row ID and old envelope
   identity. Concurrent deletion/replacement means skip/retry, never recreate.
   Retry a nonce-uniqueness collision with a new envelope, not a reused nonce.
5. Resume after crashes by scanning remaining old-key IDs. Concurrent readers
   must retain both keys and observe complete old/new envelopes, never a mix.
6. Retire only after approved live-reference, writer-drain, backup, restore and
   retention evidence. Keep recovery keys for every retained recoverable backup.

No such scan/job/CAS write is implemented. Restored backups may contain retired
key IDs, and losing historical material is permanent loss. Shared keys do not
provide per-conversation cryptographic erasure. Key custody, backup retention,
restore deletion handling and rotation authority remain approval gates.

Tests exercise a NIST AES-256-GCM primitive vector, real authenticated round-trips,
tampering/context substitution, random nonces, malformed keys/envelopes and
test-only PostgreSQL inserts. The vector has no AAD and validates the native
primitive; separate service tests verify the WorkPhelo AAD contract. Randomness
tests are samples, not a proof of collision freedom or cryptographic security.
The existing database unique `(keyId,nonce)` constraint remains mandatory.

## Phase 2B.3: Internal Transactional Conversation Operations

This slice extends the earlier foundation with internal writes, not HTTP APIs.
No controller, inference, audit store, cleanup worker, deployment wiring or schema
change is added. Earlier phase descriptions record those phases' limitations;
the internal append capability below supersedes their no-append limitation.

### Internal contracts and ownership

`PersistenceModule` exports the existing `OwnershipContextFactory` and
`ConversationsRepository`, plus `ConversationOperationsService`. It does not
export the database client or fingerprint provider.

- Existing `create(context, expiresAt)`, `findOwned`, `requireOwned` and
  `listOwned` remain metadata-only; expiration must be supplied by trusted server
  policy. Creation has no idempotency receipt in this slice.
- `appendUserMessage(context, conversationId, content, idempotencyKey)` returns
  only `{id, conversationId, sequence, role, createdAt}`, never the envelope.
  It accepts exact nonempty valid UTF-8 content up to 16 KiB and an opaque key
  matching `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`.
- `readOwnedMessagePage(context, conversationId, afterSequence=0, limit=20)`
  decrypts at most 100 selected rows in ascending sequence order. Returns
  `{items, nextAfterSequence}`; each item includes content and message metadata,
  not ciphertext. The cursor is the last sequence when the page is full; a
  subsequent empty page is possible. No unrestricted plaintext-list API exists.
- `deleteOwned(context, conversationId)` returns void, cascades messages and
  preserves submission receipts. A repeated deletion returns the same safe 404
  as any unavailable conversation; there is no deletion acknowledgement receipt.

All operations require the opaque server-minted ownership context. Tenant and
user IDs are never normalized or accepted from operation arguments. New internal
message/delete operations accept canonical lowercase server-generated UUIDs;
other spellings are rejected rather than normalized. Foreign tenant/user,
missing, expired and deleted parents return `404 Conversation not found`. No
administrator override exists. Stored result IDs are revalidated for current
owner, parent, message existence and expiry before replay.

### Configuration and fingerprints

`AI_MESSAGE_OPERATIONS_ENABLED` defaults to false. Enabled mode additionally
requires valid `AI_PERSISTENCE_ENABLED=true`, database configuration,
`AI_MESSAGE_ENCRYPTION_ENABLED=true`, and both:

- `AI_FINGERPRINT_ACTIVE_KEY_ID`: lowercase SHA-256 hex of the raw key.
- `AI_FINGERPRINT_KEYS`: JSON array `[{"id":"<digest>","key":"<base64>"}]`,
  with the same strict 32-byte/key-ID encoding contract as encryption.

There are no production secrets or ephemeral defaults. Fingerprint keys must be
dedicated random AI HMAC keys, distinct from every configured encryption key and
from JWT/domain secrets. Known reuse is rejected when comparison material is
available; global key separation and entropy still require operator custody.
Enabled startup fails closed for missing/invalid configuration. Disabled
foundation and eligibility need no fingerprint keys or database connection.

Fingerprints use HMAC-SHA-256 over the UTF-8 JSON tuple
`["workphelo.ai.append-message",1,tenantId,ownerUserId,conversationId,"USER",content]`.
The version and key ID accompany the 32-byte digest in the receipt. Exact content,
including whitespace/Unicode, is authenticated. The idempotency key is separately
bound by the database receipt scope, not normalized into message content.
New writes use the active key; retries use the receipt's historical key and
constant-time digest comparison. Unknown versions or lost historical keys yield
safe 503, never automatic success or a new append. Rotation requires a controlled
restart with old verification keys retained; no fingerprint rewrite/rotation job
is implemented. Changing the active key does not invalidate matching old retries.

### Transactions, retries and replay

Append uses a transaction-scoped PostgreSQL advisory lock over the complete
tenant/owner/APPEND_MESSAGE/key scope before acquiring the owned parent `FOR
UPDATE` lock. Hash collisions only serialize unrelated operations. The receipt
unique index remains authoritative. Lock ordering prevents the same scoped key
from racing across different parents. Different keys serialize at the parent.

After lock acquisition the database clock rechecks expiry. The transaction then
verifies any existing receipt or allocates a UUID and integer sequence, encrypts
with allocated AAD, inserts the encrypted-only row, increments the sequence and
updates the conversation timestamp, and inserts the receipt. A final database
clock check precedes completion. No network/provider work occurs in transactions.
Rollback removes all partial writes and releases locks; retries never consume a
sequence twice. Integer exhaustion fails closed rather than wrapping.

Matching retries return original metadata, different input returns safe 409,
and different owners may reuse the same opaque key. Receipt/result validation
never resurrects a deleted/expired parent. Expired receipts are denied and their
keys are not recycled. A connection failure/uncertain commit returns safe 503;
the caller can explicitly retry the same key to resolve a completed commit.

Read uses a parent `FOR SHARE` lock against concurrent deletion/appends, filters
children by all ownership fields, reconstructs AAD from persisted metadata, and
decrypts only the selected page. Any selected corrupt row fails the whole call
without returning partial plaintext. Delete uses the same exclusive parent lock
as append; the FK cascade is atomic. Expiry is checked again after work. The
database transaction commit is the operation's linearization boundary; clock
checks are not a guarantee against time advancing immediately before commit.

Transactions use ReadCommitted isolation, 2-second pool max-wait, 5-second
transaction timeout, 1.5-second lock timeout and 2.5-second statement timeout.
Only recognized Prisma P2034 / PostgreSQL 40001 or 40P01 conflicts retry, at most
three attempts with short bounded backoff. Driver/network/constraint/lock-timeout
errors do not automatically retry. The total worst-case budget across attempts
must be reconciled with HTTP request deadlines in a later API slice; no HTTP
operation invokes these methods today. All arbitrary errors become static 503;
no content, envelopes, fingerprints, SQL, driver diagnostics or keys are logged.

### Provisional policy and release gates

For internal fixtures only, receipt replay expiry equals the explicitly supplied
conversation expiry. This is NOT an approved production retention schedule.
Receipts physically remain after expiry/deletion; no cleanup or key reuse is
implemented. Production receipt retention, abuse/storage limits, backups,
deletion acknowledgement/tombstones and restored-backup behavior still require
approval. Safe idempotent deletion acknowledgement is a Phase 2B.5 blocker.

Phase 2B.4 must preserve trusted-context checks, validate narrow DTOs, use approved
expiry/receipt policy and bounded request budgets, and map these internal errors
without exposing details. No API slice, Auth/Gateway signing change, real model,
business tool, usage accounting or frontend is included here.

PostgreSQL tests run only against the guarded disposable `workphelo_ai_2b1`
database on loopback. Identity minting uses an explicit test adapter; SQL locks,
unique constraints, cascades, deadlocks, interrupted backends and rollback are
real database operations. Fault triggers/backend termination exist only in tests,
never in the migration or service. Unit tests separately use client mocks for
bounded retry/error classification. Shared databases must never run these tests.

## Phase 2B.4: Provisional Retention and Bounded Cleanup

This section supersedes the earlier provisional expiry/receipt and per-attempt
timeout descriptions. It does not authorize production deletion or expose any
HTTP API. No schema or migration change is required: the existing receipt
`expiresAt` field already supports independent physical retention.

### Fixed expiration and replay eligibility

`ConversationsRepository.create(context)` now accepts no expiry argument. It
captures the database clock at millisecond precision, stores that `createdAt`,
and fixes `expiresAt` to exactly 720 elapsed hours later. This is a duration, not
a calendar month, and activity never extends it. The existing immutable-column
trigger still prevents expiry changes. Historical fixture/imported rows retain
their recorded expiry; any pre-release data with different lifetimes must be
reviewed before rollout. No retrospective shared-data rewrite is performed.

Reads/lists require expiry strictly greater than database time, regardless of
physical cleanup. Append and message reads recheck expiry after lock waits and
before completion. The expiration instant is expired. Cleanup selects
`expiresAt <= statement_timestamp()` using the existing expiry indexes.

New append receipts independently record database-controlled operation time and
expiry exactly 720 hours later. This is only a provisional internal physical
retention deadline, not an activated production policy or guaranteed purge SLA.
Receipt presence never authorizes replay: the owned parent must still exist and
be unexpired, and the scoped fingerprint/result IDs must pass validation.
Deleting a parent therefore immediately prevents replay even while its receipt
remains. Conflicting active keys still return 409.

Expired receipts deny replay until purged; after purge, deduplication ends.
An old key used against another still-active parent is a new operation, NOT a
permanently deduplicated retry. Normally a parent's fixed lifetime ends before
its append receipts expire. Tests deliberately exercise an independently expired
receipt on a live fixture to prove the boundary. No tombstone or deletion retry
acknowledgement is added; repeated owner deletion still returns safe 404.

### Cleanup and scheduling controls

`RetentionCleanupService` is an internal provider, not exported as an owner-facing
API. It depends only on AI persistence and config, not encryption/fingerprint
keys. Unknown or unavailable historical keys cannot block deletion.

- `AI_RETENTION_CLEANUP_ENABLED=false` by default; explicitly enables manual
  internal batches in test/development only. Requires persistence enabled.
- `AI_RETENTION_SCHEDULER_ENABLED=false` by default; additionally enables the
  process timer only when cleanup is enabled. No eager startup cleanup runs.
- `AI_CLEANUP_BATCH_SIZE=25`, integer 1..100: each batch deletes at most this
  many message, parent, receipt and expired nonce rows separately. This is a
  maintenance work budget, not a tenant/user business quota.
- `AI_CLEANUP_INTERVAL_MS=60000`, integer 1000..3600000: timer interval.
- Production cleanup is rejected even if flags are supplied. A separately
  reviewed policy/enablement change is required before production activation.

Each batch is one bounded AI-only transaction. Expired parents are selected by
`(expiresAt,id)` with `FOR UPDATE SKIP LOCKED`. At most batch-size child messages
are locked with `SKIP LOCKED` and deleted before selected empty parents. A dense
expired parent may remain over several passes, still hidden from all user APIs;
deleting a parent has no remaining child cascade to amplify the work. Multiple
workers claim disjoint locked rows; no process-local flag is
used as the cross-replica safety mechanism. A local timer overlap guard merely
avoids redundant calls. Locked rows may remain until a later batch, including
rows briefly locked by an owner deletion that ultimately returns 404.

Expired receipt rows are also selected with `FOR UPDATE SKIP LOCKED`. Append
receipts additionally require a nonblocking try-lock of the exact existing
receipt-key advisory scope. A key held by an in-flight append is skipped rather
than waiting in reversed lock order. CREATE receipts expire with their parent;
expired-key reuse after purge is a new operation. Live receipts and nonexpired
parents are preserved. Expired nonce rows are independently claimed with
`FOR UPDATE SKIP LOCKED`; their existing proof/deadline-plus-margin expiry is
unchanged. Still-valid replay digests are never removed.

Batch mutation bounds apply separately to all four row families. SQL and overall
transaction deadlines still bound execution, and no unbounded drain loop is
installed. Aggregate live storage, request volume and shared concurrency remain
unlimited by this maintenance change; see
[Operational Readiness Phase 1](./OPERATIONAL_READINESS_PHASE1.md) for the explicit
shared-throttling and capacity decisions still awaiting approval.
Failure rolls back the whole current batch; previously committed batches remain
committed. Interrupted batches can be retried explicitly without duplicate
effects. Arbitrary failures do not retry indefinitely.

### Content-free observability

Per-process diagnostics expose last successful batch database timestamp, cumulative
parent/message/receipt/nonce deletion counts, last duration, failure count,
conversation/receipt/nonce backlog samples and oldest expired conversation age.
Each backlog sample is index-ordered and capped at
1000 with an explicit capped indicator; it is not an exact unbounded COUNT or a
physical-erasure guarantee. Success/failure logs use fixed event names and only
these scalar counts/times. No tenant/user/conversation identifiers, message text,
envelopes, fingerprints, keys, request bodies or raw driver errors are logged.
There are no identifier-based metric labels or persistent operational-audit tables.
Counters are replica-local, reset on restart and do not provide durable deletion
proof. No metrics endpoint or external exporter is introduced.

### Deadline and recovery findings

Gateway's default downstream proxy timeout is 30000 ms (configurable), and current
Auth lookup has its own 5000-ms bound. AI's default request/inference configuration
is 5000 ms; that value alone was not an HTTP cancellation mechanism. Previously
three attempts each allowed 2000-ms pool wait plus 5000-ms transactions, potentially
exceeding 21 seconds and a future five-second caller deadline.

All AI repository transactions now share one monotonic budget capped by
`min(AI_REQUEST_TIMEOUT_MS,5000)` with a 100-ms safety reserve. Each attempt gets
only the remaining budget, split into at most 1000-ms pool wait and 4000-ms
transaction execution. Lock timeout is at most 1500 ms; statement timeout at most
2500 ms, both reduced to the remaining transaction allowance. Backoff and at most
three recognized serialization/deadlock attempts consume the SAME budget.
Too-small/exhausted budgets fail closed. Metadata creation/reads/lists also use
this bounded transaction boundary. No global Gateway timeout was changed.

These are bounded driver/SQL deadlines, not proof of hard wall-clock cancellation
under network partitions, stalled event loops or commit acknowledgement loss.
A future HTTP layer must propagate its actual remaining deadline and cancellation
semantics. An independently configured Gateway timeout below this budget could
still expire first; no conversation HTTP caller exists yet to propagate that
shorter deadline. A commit-success/response-loss caller must retry the SAME append key;
an eligible completed receipt returns the original result. Never blindly retry
with a new key. Cleanup's committed batches can simply run again.

### Backup/restore and release gates

Before production deletion or public traffic, approve conversation and receipt
retention, backup retention and legal/deletion obligations, storage limits,
historical-key custody, and operational cleanup monitoring. This code does not
erase backups or verify a storage provider's deletion behavior.

Restore into an isolated environment with public traffic and scheduling disabled.
Recover the exact encryption and fingerprint key history needed by that snapshot.
Do not reset or extend original expiration timestamps. Inventory expired content
and receipt age, run bounded cleanup under approved policy, and verify backlog
before reopening traffic. Replay eligibility still checks current parent expiry
even before cleanup. Monitor failures, oldest expired age, skipped locks and
remaining physical backlog; reconcile committed batches after interruptions.

An unexpired conversation explicitly deleted after a backup can reappear on
restore. Existing receipts are NOT a durable deletion journal and cannot reliably
reconcile those deletions. No tombstone/audit infrastructure was approved here.
The authoritative deletion-reconciliation mechanism and backup deletion evidence
remain deployment blockers; cleanup alone is NOT sufficient. Losing historical
keys is permanent content loss, not an approved backup-erasure mechanism.

Phase 2B.5 must resolve the receipt/deletion/restore policy and capacity/deadline
gates before authorizing any public conversation surface. Production flags remain
off/blocked. No inference, ERP business access, frontend, deployment/Compose
change, rotation job or shared migration is included.

Validation uses `--runInBand --no-cache` with only the guarded disposable loopback
database. Some cleanup tests intentionally clear that disposable AI schema's
fixtures and terminate their own test backend; never point these suites at a
shared database or run the database suites concurrently against one test schema.

## Phase 2B.5B.2: Internal Request Verification and Replay Store

This slice adds no HTTP controller, DTO or conversation-handler registration.
`FoundationOnlyGuard` remains unchanged. The Gateway's production signing
prohibition remains unchanged. A valid proof is NOT handler authorization,
business idempotency, permission to invoke inference, or permission to read ERP data.

### Opt-in configuration and key overlap

`AI_REQUEST_VERIFICATION_ENABLED` defaults to false. Explicit enablement requires
`AI_AUTHENTICATED_ROUTES_ENABLED=true`, `JWT_SECRET`, AI persistence with a valid
AI-schema database URL, migrated nonce storage and `AI_REQUEST_VERIFICATION_KEYS`.
Encryption/message-operation flags remain separate; enabling verification grants
no message operation or conversation HTTP exposure. Disabled foundation/eligibility
startup requires no new key or nonce-store connection. Explicit invalid enablement
fails at configuration/startup; runtime store failure fails closed with safe 503.

Verification keys are a JSON array of 1..8 entries with exactly `id` and `key`:
`[{"id":"<sha256-hex-of-raw-key>","key":"<canonical-padded-base64-32-bytes>"}]`.
Each ID must match Gateway's SHA-256 digest of the raw key. Duplicate IDs,
malformed/short keys and known JWT/encryption/fingerprint key reuse are rejected.
There is no active verification key and no trial decryption/signature search:
the authenticated JWS header selects one explicit known ID. Keys are immutable
for a process lifetime and require controlled restart. No production keys or
ephemeral defaults are generated. Key separation/entropy and secret custody still
require operators; do not distribute other domain keys just for comparison.

Roll out the future verifier with old and new keys first, switch Gateway's one
active signing key only after that rollout, retain the old verifier key through
maximum proof lifetime plus clock/rollout allowance, then deliberately retire it.
There is no rotation automation. HS256 means both peers possess signing-capable
material, not asymmetric proof of Gateway exclusivity. Production signing is
still blocked; no rollout/secret/env/Compose changes are included here.

### Exact protocol and raw request capture

`RequestIntegrityService.authenticateAndConsume(request)` first requires the
explicit configuration and existing real JWT/Gateway identity verification.
It then verifies Gateway Phase 2B.5B.1's compact JWS: HS256 only, exact custom
type `workphelo.ai.request+jwt`, known `kid`, issuer `workphelo-gateway`, audience
`workphelo-ai-request`, `v=1`, safe integer `iat/exp`, lifetime at most 10 seconds,
and no expiration tolerance. Issued-at may be at most 1 second ahead. Header keys
are exactly alg/kid/typ; unsupported/critical headers, extra/missing payload fields,
duplicate JSON members and noncanonical base64url/JSON representations are rejected.
Nonce is canonical base64url encoding of 32 bytes; request ID is a lowercase v4 UUID.

Deadline is a future integer epoch millisecond value bounded by iat+11000 ms,
accounting for Gateway's second-rounded iat and ten-second creation limit. The
effective accepted deadline is the earlier of signed deadline and proof expiry,
rechecked after nonce commit. Digests must be lowercase 64-character SHA-256 hex.

Opt-in raw capture applies only to conversation-shaped request paths, before
JSON parsing. It stores original method/target, selected headers and an exact
private body copy in WeakMap state. Reading it checks for subsequent target/header
mutation and returns a copy; no caller-supplied raw-body/forwarded-path field is
trusted. Other paths, including eligibility/probes, retain ordinary parsing.
The narrow parser rejects duplicate security headers, cookies, Transfer-Encoding,
compressed/unsupported media and malformed framing; limit remains 32 KiB. It
accepts JSON representations, not business DTOs. Malformed JSON returns a safe
parser failure before nonce consumption. Body parsing never substitutes a new
serialization for the captured bytes.

Verifier checks actual uppercase method, canonical downstream conversation path,
validated exact raw query spelling/order, body hash/length, canonical content type,
explicit idempotency absence/value, selected Bearer hash, and the exact existing
identity-assertion hash. Field hashes use Gateway's versioned JSON tuples unchanged.
Noncanonical path aliases, encoded separators, ambiguous queries, changed body
whitespace, credentials and headers fail closed. The existing trusted-context
verifier still checks access-token/identity binding and rejects restricted sessions.
It does not perform a new Auth RPC: current-state validation remains Gateway/Auth's
responsibility and its in-flight revocation window is not eliminated.

On success, callers receive an opaque `VerifiedAiRequest`. Its accessor validates
that it was actually minted after nonce consumption and that its effective
deadline has not passed. It contains only trusted owner/tenant, deadline and
request ID; no content or nonce is exported. Future exact-handler policy must
require this capability and apply existing ownership enforcement. This slice
does not alter the global allowlist, so no conversation handler can run yet.

### Atomic replay metadata and migration

`20261118150000_add_ai_request_nonce_replay` adds only AI-owned `AiRequestNonce`:
32-byte primary-key `replayDigest`, database creation time, expiry, and an expiry
index. Digest is SHA-256 over UTF-8 JSON
`["workphelo.ai.request-nonce",1,"workphelo-gateway","workphelo-ai-request",jti]`.
There are no foreign keys, tenant/user identifiers, raw nonces, credentials,
proofs, request bodies or conversation contents. SQL CHECKs enforce digest length
and a positive retention interval no longer than 75 seconds. The previous
foundation migration is unchanged.

`RequestNonceStore` uses INSERT ... ON CONFLICT DO NOTHING in its own committed,
bounded PostgreSQL transaction. Uniqueness is shared across application replicas,
not process memory. The database clock rechecks issued-at/deadline/proof expiry;
successful consumption is rechecked against the application clock before issuing
a context. Concurrent copies yield one accepted nonce; replay returns safe 401.
Database failure is safe 503 with no fallback or raw diagnostics.

Retention is max(proof expiry,signed deadline)+60 seconds, covering the permitted
clock difference and in-flight verification. The 75-second SQL ceiling bounds
metadata lifetime at insert, not a guaranteed physical purge SLA. Manual internal
`purgeExpired(limit)` uses indexed SKIP LOCKED batches, 1..1000 rows. No scheduler
or public purge API is added. Purge cannot delete a still-valid proof's record
under the stated bounded-clock assumption. Require healthy synchronized clocks;
arbitrary clock rollback, manual row deletion, or replay-store restoration can
invalidate this guarantee. After restore, keep future conversation traffic closed
until old proofs are certainly expired and clock/reconciliation checks pass.

The migration owner creates the table. The restricted AI runtime role needs
SELECT/INSERT/DELETE on this table and AI schema usage, not DDL, UPDATE or access
to other domain schemas. Startup checks table readability only when enabled;
runtime permission failures still fail closed. Apply this migration before any
future verification enablement. No shared database was migrated in this slice.

### Consumption is not business idempotency

A nonce remains spent after later handler denial, validation failure, transaction
rollback or response loss. A client must obtain a fresh Gateway proof for retry
while retaining the SAME business idempotency key. A fresh proof with that key
may reach the existing receipt logic only after future handler authorization.
An uncertain nonce-commit acknowledgement fails closed; do not treat its proof
as reusable. Failed pre-commit storage may be retried if the proof is still valid,
but clients should consistently request a new proof rather than guessing.

Nonce expiry does not grant permanent replay safety, and business receipts do
not replace nonce consumption. Existing conversation deletion/backup-reconciliation
and retention policy blockers remain. No deletion ledger or business HTTP flow
is introduced. Future handlers must propagate the effective remaining deadline;
the new capability does not itself cancel arbitrary downstream operations.

### Test and runtime boundaries

Tests compile the actual Gateway signer/adapter source in memory, send actual
loopback HTTP, and invoke the actual AI parser, JWT/context verifier, proof verifier
and (in PostgreSQL tests) replay store. Positive proofs are not independently
reimplemented. Negative malformed-claim fixtures are deliberately re-signed with
test-only keys to exercise checks jwt.sign itself would otherwise reject.

The test-only observer invokes verification then continues to unchanged application
routing: even an accepted proof receives 404 because no conversation controller
exists. No observer performs business work or bypasses handler authorization.
All observer/compiler/fixture code is in an excluded .spec.ts file. Separate tests
without the observer confirm no proof is consumed by actual conversation routing.
Eligibility and probes still work without request proofs and without invoking
nonce consumption. No full live Auth/database/current-state claim is made from
these signed identity fixtures.

Disposable PostgreSQL evidence includes two independent app instances/connections,
concurrent identical proofs, replay after response loss, independent commit after
business rollback, same business key with fresh proofs, bounded concurrent purge,
store outage/recovery and restricted-role privileges. SQL/schema checks are real;
unit tests clearly mock only nonce storage. Run database tests with --runInBand
against the guarded loopback disposable database, never shared environments.

No new routes, exact-handler registration, production signing/cleanup enablement,
inference, ERP tools, frontend, deployment wiring or production key automation
is included. Phase 2B.5B.3 requires a separately reviewed exact-handler boundary
and explicit enablement; no unsigned or identity-only fallback is authorized.

## Phase 2B.5B.3: internal exact conversation-handler policy

This section supersedes the future-handler notes above. There are still **no
production conversation controllers or HTTP bindings**. The production
`CONVERSATION_HANDLERS` registry is empty, and `AI_CONVERSATION_HTTP_ENABLED`
defaults to false. Changing that flag alone exposes nothing. Test-only fixture
controllers are excluded from builds and container images.

### Policy and execution order

`security/conversation-handler.policy.ts` defines five internal specifications:

| Operation                  | Method | Canonical template                          |
| -------------------------- | ------ | ------------------------------------------- |
| create                     | POST   | /api/conversations                          |
| list                       | GET    | /api/conversations                          |
| read metadata and messages | GET    | /api/conversations/:conversationId          |
| append USER                | POST   | /api/conversations/:conversationId/messages |
| delete owned               | DELETE | /api/conversations/:conversationId          |

These are specifications, not registered routes. Each future binding must match
the exact controller object, handler function, verb, Nest route template, operation
metadata and canonical received pathname. Decorators alone grant no authority.
Controller/handler aliases, duplicate bindings, inherited metadata, encoded IDs,
uppercase IDs, trailing slashes and implicit HEAD/OPTIONS are not approved.

The existing raw-body/framing middleware executes before Nest guards. It may
reject malformed framing/JSON without touching the nonce store. The global guard
then checks exact handler policy and enablement before invoking the existing JWT,
Gateway identity and request-proof verifier. Only after successful independent
nonce commit does it mint an ownership context and an opaque operation capability.
Existing exact health/readiness and eligibility exceptions are unchanged.

`AuthorizedConversationOperations` requires the matching typed capability at
runtime as well as compile time. IDs come from the approved received route, not
caller-supplied tenant/owner fields or a second handler argument. Ownership is
minted directly from `VerifiedAiRequest`; headers are not re-parsed to construct
authority. Tenant administrators have no ownership bypass. Existing repository
and transactional row locks still enforce tenant, owner, existence and expiry.
Future controllers must validate signed input DTOs and map only the validated
content, pagination and idempotency inputs; this slice introduces no such DTOs.

### Configuration and deadlines

When conversation HTTP is enabled, startup validation requires authenticated
routes, AI persistence (`schema=ai`), message encryption, message operations,
request verification and their valid independent keys. The nonce store startup
probe rejects missing replay storage. Disabled eligibility remains independent
of persistence and nonce storage. No new migration is introduced in this slice.

Capabilities and proof-derived ownership expire at the effective signed deadline.
Database operations now clip their existing bounded transaction/retry budget to
that deadline, including pool wait and commit reserve; late transaction work rolls
back. This is bounded cancellation, not a guarantee against arbitrary external
side effects, clock jumps or commit-acknowledgement uncertainty.

Nonce consumption stays separate from business transactions. Business failure,
rollback or response loss never unspends a committed proof. Retry needs a fresh
Gateway proof and the original business idempotency key. Existing globally atomic
nonce uniqueness and expiry retention (maximum proof/deadline plus 60 seconds)
are unchanged. Indexed cleanup cannot remove a still-valid proof's nonce under
the documented bounded-clock assumptions.

### Errors, evidence and remaining rollout gates

Authentication, integrity and replay failures deliberately share safe 401 errors;
they are not remotely distinguishable. Invalid handler policy returns 403;
disabled prerequisites or unavailable dependencies return 503. Foreign, missing,
deleted and expired rows return the same 404. A deadline crossed inside a
transaction returns a safe operation-unavailable error. No proof, nonce, identity
token, request target, content or driver diagnostics are added to logs.

The handler tests exercise actual Nest routing/guards and real cryptography using
test-only signed identity/proof fixtures. The existing request-integrity suite
separately exercises the actual Gateway signer/HTTP adapter. Disposable PostgreSQL
tests execute exact-handler creation, encrypted append/read/delete, replay after
business rollback, and tenant/owner/expiry isolation. They do not claim a live
Auth current-state integration: Gateway/Auth current-state tests remain separate.

Phase 2B.5B.4 still requires reviewed controllers/DTOs, explicit exact bindings,
pagination/cursor contract review and coordinated Gateway signer rollout. The
Gateway signer is separately disabled and rejects production signing; this task
does not change that restriction or deployment configuration. Existing shared
identity-secret trust, short-lived assertion replay, compromised signer/key and
database-restore limitations remain. No inference, ERP access, cleanup automation,
backup reconciliation or business permission grants are enabled.

## Phase 2B.5B.4: protected storage-only HTTP contracts

This section supersedes the earlier absent-controller/empty-registry notes.
There are exactly five registered conversation handlers. They remain default
disabled: `AI_CONVERSATION_HTTP_ENABLED=false`. Explicit true is now rejected
in `NODE_ENV=production`, independently of the Gateway's production signing
prohibition. There is no unsigned or identity-only fallback.

External prefix is `/api/v1/ai`; downstream prefix is `/api`. The production
Gateway still blocks conversation forwarding and is NOT enabled by this slice.
Isolated tests directly exercise downstream HTTP using signed protocol fixtures;
the existing verification suite also exercises the real Gateway signing adapter.

| Method / downstream route                        | Input                                                    | Successful response                               |
| ------------------------------------------------ | -------------------------------------------------------- | ------------------------------------------------- |
| POST /api/conversations                          | JSON `{}` and one required Idempotency-Key               | 201 `{id,createdAt,expiresAt}`                    |
| GET /api/conversations                           | optional `limit` and `cursor`                            | 200 `{items,nextCursor}`; owned metadata only     |
| GET /api/conversations/:conversationId           | optional `limit` and message `cursor`                    | 200 `{conversation,messages:{items,nextCursor}}`  |
| POST /api/conversations/:conversationId/messages | JSON `{content:string}` and one required Idempotency-Key | 201 `{id,conversationId,sequence,role,createdAt}` |
| DELETE /api/conversations/:conversationId        | no body, query or idempotency key                        | 204, empty body                                   |

`ConversationsController` handlers `create`, `list`, `read`, `append` and `remove`
map explicitly to their five operation specifications. All use operation-scoped
opaque grants. Registry checks precede authentication/proof and nonce processing;
Nest interceptors and validated DTO handling execute only after the guard.
Validation reads the captured signed body, not a mutable reconstructed identity
or request body. No controller has generic Prisma access.

### Creation receipts and consistency

Creation uses the existing CREATE_CONVERSATION receipt operation, an owner/tenant/
operation-scoped advisory transaction lock and versioned domain-separated HMAC
over the canonical empty-object request. Conversation and receipt commit together.
Concurrent matching keys return one original result. Keys are scoped per operation:
reuse across create and append is independent, not a global-key conflict. Different
append content or parent conflicts with its scoped receipt. Extra creation input
is invalid (400), not an alternate valid creation fingerprint.

Replays verify the receipt fingerprint/key version, ownership, result existence
and current result/receipt expiry. Deleted or expired results return 404, never
resurrection. Receipts intentionally survive owned deletion until provisional
cleanup; they have no parent cascade. A failure writing a new receipt rolls back
its new conversation. Receipt retention remains the provisional 720-hour policy,
not a permanent deletion/backup reconciliation mechanism.

List uses `(createdAt DESC,id DESC)` seek pagination, default 20/max 100, fetching
at most limit+1 rows. Cursors are bounded canonical base64url JSON position tuples,
not credentials. Every page reapplies owner/tenant/expiry predicates; deleting the
cursor row does not invalidate its position. Later inserts above the cursor will
not appear on subsequent pages; deletes/expiry can shorten pages. No cross-request
snapshot consistency is promised.

Detail acquires one shared parent lock and reads metadata/messages in one bounded
transaction, with expiry rechecked after waits and before returning. Messages
are ascending sequence, at most 100 fetched, with a 256-KiB serialized response
budget including conservative metadata reserve. Only bounded page candidates are
decrypted. A corrupt selected encrypted record fails the whole response. Cursors
continue after the last emitted sequence; a full count-boundary page may yield
an empty terminal page on the next request. No encryption envelopes are exposed.

### Validation, errors and rollout restrictions

Bodies are strict JSON objects with no additional fields. Create requires `{}`;
append requires exact nonempty UTF-8 text up to 16,384 decoded bytes. No trimming,
truncation or normalization occurs. The raw JSON wire limit remains 32 KiB.
Query/header ambiguity and noncanonical paths fail closed. Only canonical JSON
content type `application/json; charset=utf-8` is accepted for bodies. GET/DELETE
reject bodies and idempotency keys. Duplicate security headers are rejected before
proof consumption. Invalid signed request representation can return 401 before
DTO evaluation; invalid DTOs return 400. Malformed/aliased path targets are denied
by the exact policy rather than treated as owned-record lookups.

All conversation responses, including parser, guard and validation failures,
set `Cache-Control: no-store`. Errors retain `{statusCode,code,message,requestId}`:
400 INVALID_REQUEST, 401 UNAUTHORIZED, 403 FORBIDDEN, 404 NOT_FOUND,
409 CONFLICT, 413 REQUEST_TOO_LARGE, 415 UNSUPPORTED_MEDIA_TYPE,
503 SERVICE_UNAVAILABLE and 504 GATEWAY_TIMEOUT. Rate limiting is not implemented;
no new 429 behavior is claimed. Messages remain generic and driver-safe.

Expired accepted capabilities and signed transaction budgets return 504. Pool,
lock, statement and retry limits remain bounded; a clipped request-budget timeout
also returns 504. The nonce commit remains independent of business rollback.
Response-loss recovery uses a fresh proof with the SAME business key, never a
replayed proof or an automatically generated replacement business key.

No schema or migration change is needed for this slice. Tests apply only the
existing migrations to a new guarded loopback disposable database. No shared
database is used. HTTP fixtures cover real controllers/guards/interceptors/DTOs;
the database suite additionally uses real Prisma, row/advisory locks, nonce
storage, encryption and receipts. No live Auth/current-state integration is
claimed by the signed identity fixtures.

Remaining gates: reviewed Gateway signing rollout, production permission to
enable storage HTTP, approved retention/backup-deletion reconciliation, and
operational rate limiting. Deletion remains non-production and returns 404 on
repeat; no tombstone/external deletion ledger is introduced. No inference,
assistant responses, ERP retrieval/actions, frontend or deployment wiring is added.

### Phase 2B.5B.4 validation commands

Executed from the repository root. `AI_TEST_DATABASE_URL` was supplied only for
the explicitly guarded loopback disposable `workphelo_ai_2b1?schema=ai` database;
it was absent for the no-PostgreSQL run. No local/shared environment file was edited.

```bash
AI_TEST_DATABASE_URL="$AI_TEST_DATABASE_URL" npm test --workspace=apps/ai-service -- --runInBand --silent
npm test --workspace=apps/ai-service -- --runInBand --silent
npm test --workspace=apps/api-gateway -- --runInBand --silent
npm test --workspace=packages/internal-auth -- --runInBand --silent
npm test --workspace=apps/auth-service -- --runInBand auth/strategies/jwt.strategy.spec.ts auth/auth.controller.current-context.spec.ts --silent
npm run check-types --workspace=apps/ai-service
npm run check-types --workspace=apps/api-gateway
npm run lint --workspace=apps/ai-service
npm run lint --workspace=apps/api-gateway
npm run build --workspace=apps/ai-service
npm run build --workspace=apps/api-gateway
npm run check-types -- --filter=ai-service --filter=api-gateway --filter=@work-phelo/internal-auth --force
npm run build -- --filter=ai-service --filter=api-gateway --filter=@work-phelo/internal-auth --force
npm run check-rbac
DATABASE_URL='postgresql://placeholder:placeholder@127.0.0.1:1/placeholder?schema=ai' CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=true npm run db:validate --workspace=apps/ai-service
npm run db:generate --workspace=apps/ai-service
docker build --platform linux/amd64 -f apps/ai-service/Dockerfile -t workphelo-ai-foundation:b4-validation .
node apps/ai-service/scripts/verify-container.mjs workphelo-ai-foundation:b4-validation
git diff --check
```

Prettier was checked against every file changed in this slice, not the entire
unrelated repository. AI tests: 645 passed with PostgreSQL; 567 passed/78 expected
database skips without it. Gateway: 189; internal-auth: 43; focused Auth security: 15. Forced root-filtered typechecks/builds used zero cached tasks. Gateway lint
retains 17 existing warnings; AI lint has none. A transient probe 401 in an earlier
full run did not reproduce in the isolated probe run or subsequent full runs;
no unsupported baseline-cause claim or unrelated code fix was made.

The linux/amd64 image build and container verification passed, including default
conversation denial, isolated probes, safe logging, startup rejection and shutdown.

### Phase 2B.5B.4 changed-file inventory

All 26 files touched in this slice are below, relative to `apps/ai-service/`.
Pre-existing pending changes in other workspaces were not modified.

```text
README.md
scripts/verify-container.mjs
src/app.spec.ts
src/auth/trusted-auth.spec.ts
src/common/error-codes.ts
src/common/http-exception.filter.spec.ts
src/common/http-exception.filter.ts
src/config/runtime-env.ts
src/conversations/conversation-bindings.ts
src/conversations/conversation.dto.ts
src/conversations/conversations.controller.ts
src/conversations/conversations.http.spec.ts
src/encryption/message-encryption.spec.ts
src/persistence/ai-database.service.ts
src/persistence/conversation-operation.error.ts
src/persistence/conversation-operations.service.ts
src/persistence/conversation-operations.spec.ts
src/persistence/conversation-pagination.ts
src/persistence/conversations.repository.ts
src/persistence/submission-fingerprint.service.ts
src/request-integrity/raw-request.ts
src/request-integrity/request-integrity.service.ts
src/request-integrity/request-integrity.spec.ts
src/security/conversation-authorization.module.ts
src/security/conversation-authorization.service.ts
src/security/conversation-authorization.spec.ts
```

## Phase 2B.5B.5: real Gateway-to-AI storage integration

The Gateway now connects the five exact conversation routes to its immutable
signing/forwarding adapter in controlled development/test configuration. This
supersedes the earlier always-blocked Gateway notes. Signing remains default
disabled and prohibited in production; AI conversation HTTP is independently
default disabled and prohibited in production. No environment or deployment file
is changed. Eligibility and internal health/readiness boundaries are preserved.

See the Gateway README's Phase 2B.5B.5 section for framing, Origin policy and
response sanitization. The same explicit `ALLOWED_ORIGINS` configuration used by
the frontend CORS layer is required for cookie-authenticated POST/DELETE; CORS
alone is not authorization. Bearer-only access remains possible. No wildcard,
forwarded Host inference or automatic business-idempotency key is introduced.

The five-second Gateway budget begins before Auth `/me` and spans signing,
transport, proof/nonce verification, AI transaction/encryption and response
processing. It excludes client upload/parsing time. AI retains its signed
deadline-clipped transaction budget. HTTP timeout/cancellation is not proof that
a transaction rolled back: real tests drop a response AFTER observing a durable
commit, then retry with a fresh proof and the original key and obtain one result.

Real Nest Gateway and AI apps are used over real loopback HTTP. A test-only relay
observes the actual adapter output and injects byte/header/path mutations after
signing. Tests verify canonicalized Unicode/whitespace/escaping, exact raw query
binding, empty versus absent body, no identity-only fallback, eight concurrent
copies of one proof (one execution), fresh-proof receipt retries, ownership,
encrypted-only persistence, fixed 720-hour expiry, cascade deletion, key mismatch,
database/nonce outage, revoked-session response and bounded Auth lookup.

Auth `/me` is an explicit HTTP stub controlling current identity/session validity,
not a real Auth database integration. Separate real Auth JWT strategy/current-
context component tests pass. Full Auth database integration is still a coverage
limitation, not implied by the signed fixtures or Node20 smoke.

A transport regression alternating legacy eligibility and conversation forwarding
surfaced pooled-connection 400 responses. The private signed adapter now disables
shared connection pooling without changing the global agent or ordinary ERP
forwarding. Rejected framing/unread-body connections are closed. Auth lookup
timeout is mapped to the AI deadline without increasing global proxy timeouts.
No request content, raw URL/query, credential, assertion/proof, key, nonce or
fingerprint logging is introduced. Upstream errors/headers/cookies are discarded;
bounded success objects are validated before forwarding. All conversation
responses remain no-store.

Capacity is not production-ready. The Gateway has only existing in-process/IP
throttling (30/second, 150/10 seconds, 600/minute), not shared AI user/tenant quotas.
No Redis-backed throttler store was found, and no aggregate conversation/message/
byte or concurrency cap is implemented. Nonce/receipt/conversation cleanup,
retention, shared rate limits, key operations and authoritative backup/deletion
reconciliation remain explicit rollout decisions. No inference or ERP access is
enabled and no new persistent audit tables, schema or migrations are added.

### Phase 2B.5B.5 validation evidence

Results: full AI suite 690 passed with disposable PostgreSQL; 605 passed with 85
expected database skips without it. Gateway 203, internal-auth 43, focused Auth
security 15. Forced root-filtered checks: 10 typecheck tasks and 7 build tasks,
zero cached. AI lint is clean; Gateway retains 17 pre-existing warnings. Prisma,
RBAC, formatting and whitespace checks pass. Earlier transient socket/probe test
failures were rerun; final full runs pass without altering unrelated services.

Commands executed from repository root (database URL supplied only for the guarded
loopback disposable `workphelo_ai_2b1?schema=ai` target):

```bash
AI_TEST_DATABASE_URL="$AI_TEST_DATABASE_URL" npm test --workspace=apps/ai-service -- --runInBand --silent
npm test --workspace=apps/ai-service -- --runInBand --silent
npm test --workspace=apps/api-gateway -- --runInBand --silent
npm test --workspace=packages/internal-auth -- --runInBand --silent
npm test --workspace=apps/auth-service -- --runInBand auth/strategies/jwt.strategy.spec.ts auth/auth.controller.current-context.spec.ts --silent
npm run check-types --workspace=apps/api-gateway
npm run lint --workspace=apps/api-gateway
npm run lint --workspace=apps/ai-service
npm run check-types -- --filter=ai-service --filter=api-gateway --filter=@work-phelo/internal-auth --force
npm run build -- --filter=ai-service --filter=api-gateway --filter=@work-phelo/internal-auth --force
npm run check-rbac
DATABASE_URL='postgresql://placeholder:placeholder@127.0.0.1:1/placeholder?schema=ai' npm run db:validate --workspace=apps/ai-service
npm run db:generate --workspace=apps/ai-service
docker build --platform linux/amd64 -f apps/ai-service/Dockerfile -t workphelo-ai-foundation:b5-validation .
node apps/ai-service/scripts/verify-container.mjs workphelo-ai-foundation:b5-validation
git diff --check
```

Prettier checks cover every changed file using its workspace configuration. AI
Prisma generation also ran as the workspace test/typecheck/build pre-hook.
The linux/amd64 AI image build was cached (runtime sources did not change), but
container regressions ran fresh. A separate read-only Node20/linux-amd64 container
mounted ONLY compiled Gateway/config artifacts and a temporary test script, linked
ONLY the owned disposable PostgreSQL container, and executed all five real Gateway
to AI to DB operations successfully with Auth stubbed. This was rerun sequentially
after builds with `NODE_PATH=/app/node_modules` for the mounted artifacts.

The full Gateway Dockerfile image was NOT built: its existing broad COPY context
does not exclude every local `.env.*` variant. That separate context-hardening risk
was not silently changed here. No environment files were mounted into the smoke
container. The compiled Gateway runtime itself was exercised on Node20/linux-amd64.
Temporary script, smoke containers, test database and validation image tag are
removed after validation; no shared database or deployment is involved.

### Phase 2B.5B.5 changed-file inventory

```text
apps/ai-service/README.md
apps/ai-service/src/conversations/gateway.integration.spec.ts
apps/api-gateway/README.md
apps/api-gateway/src/main.ts
apps/api-gateway/src/proxy/ai-conversation-body.ts
apps/api-gateway/src/proxy/ai-conversation-proxy.ts
apps/api-gateway/src/proxy/ai-conversation-proxy.spec.ts
apps/api-gateway/src/proxy/ai-request-integrity.ts
apps/api-gateway/src/proxy/current-state.spec.ts
apps/api-gateway/src/proxy/proxy.controller.ts
```
