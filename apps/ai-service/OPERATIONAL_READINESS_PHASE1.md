# AI Operational Readiness Phase 1

Local implementation/review record. No Jira API action, commit, PR, deployment or traffic enablement is authorized by this document.

## Baseline And Infrastructure Findings

Branch: feat/ai-resource-safeguards, created from clean origin/dev at d14b5a21dd0fe3b87948244cc77d698c0cb0cb46. Phase 2B commit cd598d83 is included. All 16 original stashes must remain intact.

- Redis exists in both infrastructure/docker-compose.dev.yml and docker-compose.prod.yml. PROD uses password authentication; DEV/PROD have separate volumes. HR uses REDIS_URL through BullModule in apps/hr-service/src/app.module.ts. HR explicitly declares ioredis; it is not a shared platform throttling adapter.
- Gateway uses @nestjs/throttler with the default storage in apps/api-gateway/src/app.module.ts and throttler.config.ts. Limits are 30/second, 150/10 seconds and 600/minute, process-local/IP-based. Multiple replicas do not share counters. A Compose depends_on redis declaration is not a distributed limiter.
- Neither Gateway nor AI declares/uses a Redis client or distributed limiter. AI deployment/service/Redis wiring is not implemented. Adding an AI/Gateway dependency on Redis availability, credential isolation and failure policy requires explicit runtime/deployment approval; this phase does not introduce it.
- PostgreSQL is already AI's shared persistence dependency. AiDatabaseService bounds operations to five seconds, clips the signed deadline, limits transaction retries and uses statement/lock timeouts. Existing ownership/row/advisory locks implement correctness, not user/tenant rate or concurrency quotas.

## Resource Assessment And Implementation Choice

| Resource                   | Current bound / gap                                                                                 | This phase                                                            |
| -------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| User/tenant request volume | Only process-local IP throttling; no distributed user/tenant policy                                 | Design below; approval required, not implemented                      |
| Conversation creation      | No user/tenant count quota                                                                          | No arbitrary quota introduced                                         |
| Message append volume      | 16 KiB/message; sequence ceiling is not a practical quota                                           | No business cap invented                                              |
| Aggregate messages/bytes   | No durable usage ledger or approved aggregate cap                                                   | Defer schema/policy until approved                                    |
| Concurrent requests        | Ownership locks and request/transaction deadlines; no shared admission slots                        | Design below; no process-local substitute claimed                     |
| Nonce write amplification  | Each accepted proof, including reads/retries, writes one row; expiry does not physically purge rows | Add bounded nonce maintenance to the existing opt-in cleanup worker   |
| Receipt accumulation       | Separate 720-hour receipts, bounded existing cleanup; no request-rate bound                         | Preserve replay/expiry semantics and bounded receipt cleanup          |
| Expired backlog            | Parent batch limit does not bound ON DELETE CASCADE child volume                                    | Explicitly delete bounded expired message chunks before empty parents |

The demonstrated narrow defect: one expired parent may own arbitrarily many messages. Deleting a bounded number of parents can still cascade through all of those messages, exceed the database budget and repeatedly roll back without draining the backlog. Separately, RequestNonceStore.purgeExpired exists but is not called by the scheduler, so expired nonce rows accumulate even when retention scheduling is enabled.

Chosen local change: harden only existing opt-in maintenance. Use the existing AI_CLEANUP_BATCH_SIZE as a technical row budget per family (messages, parents, receipts and nonces), not a user business quota. Keep the existing 1..100 validation, fixed conversation lifetime, five-second transaction budget, scheduler defaults and production cleanup prohibition. No schema, migration, dependency, Gateway route or Auth change is required.

Algorithm: lock at most batch-size expired parents with FOR UPDATE SKIP LOCKED; delete at most batch-size children belonging to those parents; delete only selected parents now having no children. Thus parent cascades have no remaining child rows to amplify. Retain partial expired parents for subsequent passes; all user operations already hide/reject expired records. Receipt handling stays unchanged. Independently claim/delete at most batch-size expired nonces with SKIP LOCKED, using their existing conservative expiresAt field (proof/deadline plus retention margin). Never remove a live replay digest. All changes in a batch commit or roll back together, and existing shutdown/non-overlap behavior remains.

The worker exposes internal content-free counters for messages/nonces removed and bounded nonce/receipt backlog samples, in addition to existing parent metrics. This is not a new public metrics/identity endpoint and does not measure total tenant storage. Failure diagnostics retain no raw SQL, keys, proofs, content or identity labels.

Deletion totals are process-local diagnostics, not a durable cluster-wide quota ledger. Backlog samples come from the shared database and are bounded/approximate. Cleanup now requires the already-reviewed nonce table and worker DELETE privileges on messages/nonces as well as parents/receipts; both existing AI migrations must be present. No grants, migration SQL or production role is changed here.

These changes reduce maintenance amplification; they do NOT bound admission, total live data, database disk usage or replica-wide request concurrency. An already-retained large backlog still requires repeated approved maintenance and disk monitoring. Cleanup remains disabled until separately enabled in an authorized non-production environment.

## Shared Admission Design — Not Implemented Or Approved

Prefer the existing Redis service only after its AI/Gateway access, authentication/TLS/network boundaries, availability and memory/eviction policy are approved. Do not use a transitive HR dependency or silently introduce a new production dependency. A service-owned PostgreSQL limiter is an alternative, but request-counter writes/lock contention would amplify the database this feature is trying to protect; it needs explicit benchmarking and approval rather than an unreviewed new schema.

- Place AI-only admission at Gateway after current Auth validation and before generating a fresh request proof/nonce traffic. Resolve user/tenant exclusively from current trusted identity, never caller headers. Keep existing global ERP behavior unchanged.
- Use atomic shared user AND tenant request buckets, with distinct reads/creation/appends/deletion where approved. Select token-bucket/fixed-window semantics, burst/steady limits and fairness with product/security. No production numeric defaults are approved here.
- Use environment/version-prefixed hashed identities, not emails/tokens. For Redis Cluster, user/tenant keys involved in an atomic decision need the same tenant hash slot. Scope identities across tenants to prevent cross-tenant interference; test several actual service replicas.
- Concurrency needs atomic leased user AND tenant permits, bounded acquisition time and release on success, error, timeout and disconnect. Unique lease tokens prevent another request releasing a permit. Expiry handles crashed processes but must exceed the enforced request-execution budget plus approved drift margin; a lease alone is not proof all downstream execution stopped.
- Retried or response-lost HTTP calls still consume request budget and concurrency permits. They must not consume additional durable storage allowance when an existing idempotency receipt is replayed. Do not exempt retries from abuse controls based on client-supplied idempotency keys.
- Return authenticated safe 429/Retry-After for admission exhaustion, not tenant/user counters or identities. Fail closed with safe 503 when the shared protective store is unavailable; no process-local fallback advertised as distributed. Do not increase the five-second deadline or affect health/eligibility/ERP paths.
- Redis eviction/restart can reset counters/leases. Review cold-start/failover policy before promising strict limits; durable storage accounting belongs transactionally in PostgreSQL, not volatile Redis. Do not use cross-store increments as an atomic database storage quota.

## Aggregate Storage Design — Approval Required

Approve count/byte accounting semantics first: logical plaintext bytes vs ciphertext/physical bytes, retained expired data, per-conversation/per-user/per-tenant limits, receipts/nonces, administrator behavior and reuse after deletion. Threshold values and tenant-specific overrides are not approved.

If approved, add an AI-owned transactional usage ledger/counters updated with actual new conversation/message writes under owner AND tenant coordination. A receipt replay contributes zero new storage delta. Rollback contributes zero; explicit deletion/maintenance must decrement exactly once. Missing/corrupt accounting must fail closed and require bounded reconciliation, not silently recalculate full-table aggregates on every request. No proposed schema/migration is executed or added in this phase.

## Validation Plan And Boundaries

Add actual PostgreSQL regressions for large expired parents, separate tenants/users, live row preservation, concurrent cleanup replicas, held locks, retained nonce replay, dependency failure and atomic rollback. Keep scheduler non-overlap/shutdown tests. Rerun all AI/Gateway/internal-auth/relevant Auth tests and actual Auth-to-AI scenarios on disposable dependencies.

Per-user/tenant distributed throttling, admission concurrency, 429s, shared Redis failure and aggregate-quota retries cannot be truthfully tested as implemented because those controls are deferred. Existing Phase 2B request ownership/idempotency/response-loss/deadline tests remain security regressions, not evidence that new quotas exist.

## Local Validation Results

| Check                                                    | Result                                                                |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| Focused cleanup suite, disposable PostgreSQL             | 33 passed, zero skipped                                               |
| Full AI suite, disposable PostgreSQL                     | 702 passed, 25 suites, zero skipped                                   |
| Full AI suite, no database configured                    | 609 passed, 93 explicitly skipped; 24 suites passed, one skipped      |
| Gateway suite                                            | 214 passed                                                            |
| Internal-auth suite                                      | 43 passed                                                             |
| Auth JWT/current-state suites                            | 15 passed                                                             |
| Actual Auth -> Gateway -> AI -> disposable PostgreSQL    | 21 scenarios passed                                                   |
| Forced root-filtered AI/Gateway/internal-auth typechecks | Ten tasks passed, zero cached                                         |
| Forced root-filtered AI/Gateway/internal-auth builds     | Seven tasks passed, zero cached                                       |
| AI lint                                                  | Passed, zero errors/warnings                                          |
| Gateway lint                                             | Passed, 17 existing warnings, zero errors                             |
| Prisma validation/generation                             | Passed; existing migrations applied only to local disposable database |
| RBAC alignment                                           | Passed                                                                |

New regressions cover dense-parent row budgets, retained-expired invisibility, locked child/parent/nonce skipping, live rows across users in one tenant and separate tenants, independent database-backed worker instances, expired/nonexpired nonce boundaries, still-spent valid proof and expired-proof rejection, rollback across message/receipt/nonce deletion, bounded indexed queries, and timer non-overlap/shutdown. All existing exact-handler, authenticated error, ownership, encryption, production prohibition, idempotent retry, response-loss recovery and normal ERP/Gateway regressions passed.

An initial run had two new test assertion failures because worker counters are cumulative across a suite; assertions were corrected to compare to their pre-batch baselines. No application behavior was changed to satisfy those assertions. This was not a reproduction of the earlier unexplained 41-failure run. That historical cause remains unresolved; the complete current PostgreSQL run is retained as /private/tmp/workphelo-op1-ai-postgres.json and .log.

No new distributed request limiter, aggregate quota, Redis client or admission semaphore was tested or claimed. Shared dependency outage coverage is the existing PostgreSQL cleanup safe-503/reconnection behavior, not a new Redis rate-limiter outage test. Redis deployment compatibility, performance/load tests and actual configured policy thresholds are deferred. No Docker image/deployment build was required or performed for this AI-only maintenance change.

Exact changed paths: README.md; OPERATIONAL_READINESS_PHASE1.md (new); src/persistence/retention-cleanup.service.ts; src/persistence/retention-cleanup.spec.ts, all under apps/ai-service. No other service, schema, migration, package manifest, environment file or deployment file changed.

## Jira Subtask Progress — Local Proposal Only

These are planning identifiers, not verified Jira keys. Previous Jira status is UNKNOWN for every row; no Jira API was called. No row is marked Done, merged or deployed. The cleanup subtasks below are implemented locally and proposed as awaiting PR review; final commit/PR references belong in the handoff PR rather than this pre-commit snapshot.

| Parent story                                     | Planning subtask                                                            | Previous status | New proposed status                       | Implementation/tests                                                                                                     | PR/commit               | Remaining work                                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------- | --------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------------------- | --------------------------------------------------------------------------------------------------- |
| Story 4 — Manage AI Conversation History         | AI-04.10 — Bounded expired-message/conversation cleanup                     | UNKNOWN         | Implemented locally — awaiting PR review  | Dense-parent row budget, empty-parent removal, held child/parent locks, active-record isolation and independent workers  | This change; PR pending | Independent review, CI, merge and deployment authorization; not marked Done                         |
| Story 4 — Manage AI Conversation History         | AI-04.11 — Bounded nonce cleanup                                            | UNKNOWN         | Implemented locally — awaiting PR review  | Bounded expired nonce deletion, held nonce locks, valid-proof retention, expired-proof rejection and expiry index checks | This change; PR pending | Independent review, CI, merge and deployment authorization; not marked Done                         |
| Story 22 — Handle AI Errors and Service Failures | AI-22.10 — Cleanup rollback and failure validation                          | UNKNOWN         | Implemented locally — awaiting PR review  | Rollback of message/receipt/nonce work, database outage/reconnection, safe logs, timer non-overlap and shutdown tests    | This change; PR pending | Independent review and CI; historical 41-failure cause remains unresolved; no merged/deployed claim |
| Story 4 — Manage AI Conversation History         | AI-04.9 — Implement approved aggregate conversation storage limits          | UNKNOWN         | Blocked — policy/design only              | Accounting design only; bounded cleanup is not an aggregate cap                                                          | None, local/uncommitted | Approve semantics/thresholds, ledger/schema, reconciliation and integration                         |
| Story 19 — Enforce Tenant and Module Access      | AI-19.7 — Implement tenant-scoped AI resource consumption safeguards        | UNKNOWN         | In Progress — local maintenance subset    | Live data preserved across tenant/user fixtures; full AI 702 and Auth 15 pass                                            | None, local/uncommitted | Approve/implement actual user/tenant admission and storage policy; review/merge/deploy separately   |
| Story 22 — Handle AI Errors and Service Failures | AI-22.8 — Implement shared AI request throttling and safe limit errors      | UNKNOWN         | Blocked — infrastructure/policy approval  | Redis/throttler audit and fail-closed design; no shared limiter/new 429 behavior                                         | None, local/uncommitted | Approve runtime Redis access, limits, cold-start/outage behavior and implementation                 |
| Story 22 — Handle AI Errors and Service Failures | AI-22.9 — Validate distributed concurrency, throttling failures and retries | UNKNOWN         | In Progress — maintenance validation only | Independent cleanup instances, rollback/outage/lock tests; 33 cleanup and 21 actual Auth scenarios pass                  | None, local/uncommitted | Distributed request/concurrency/Redis-outage tests require the deferred limiter                     |

Next recommendation: review this local maintenance patch and approve store/policy decisions for a separate AI-only shared-admission implementation. Do not proceed to key management, backup-deletion reconciliation, inference or production enablement automatically.

## Pre-Handoff Local Snapshot

HEAD and fetched origin/dev remain d14b5a21dd0fe3b87948244cc77d698c0cb0cb46 on feat/ai-resource-safeguards. The prior feat/ai-conversation-persistence branch still points to cd598d83a2125b3f1eab5d27ab97989af507c623. Three tracked AI files are modified and this document is untracked; the index is empty. All 16 original stash IDs are unchanged.

Formatting and git diff --check passed. The test-owned PostgreSQL container/volume was removed. There is no new schema/migration, package dependency, shared database change, commit, push, PR, merge, deployment, real inference or ERP business action. Jira statuses above are proposals only, not successful Jira updates. Local maintenance readiness is not completion of the shared-throttling/aggregate-quota workstream and does not authorize traffic enablement.

The subsequent Git handoff was separately authorized for only these four files. It does not authorize merge, deployment, cleanup/traffic enablement or Phase 2. Use the final handoff PR for current Git/CI references; this snapshot preserves the local validation boundary. Commitlint does not currently allow the suggested ai scope, so the handoff uses the existing security scope without altering commit policy or bypassing hooks.
