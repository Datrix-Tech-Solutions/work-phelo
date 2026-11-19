# Phase 2B.6 Security Hardening and Release Readiness

Review date: 2026-11-19. This is a local engineering review, not deployment authorization.

## Executive Decision

The default-disabled implementation is ready for backend security review. Both container checks pass. A failed repeat database-suite run is disclosed below and requires repeat CI; this is not an unconditional reliability sign-off. The implementation is not ready for merge or deployment authorization. Production conversation HTTP and Gateway signing remain explicitly prohibited; no real inference, ERP access, provider SDK, tools, or business mutations were added.

After the targeted AI Docker remediation, the specific Git-handoff security blocker is resolved. This permits requesting a fresh Git-handoff approval; it does not automatically resume staging, commits, pushes or PR creation. All broader merge and deployment gates below remain unchanged.

Separate readiness gates:

| Gate                       | Assessment                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Implementation correctness | Targeted invariants and final suites pass; repeat-run reliability qualification below                                |
| Security review            | Ready with documented shared-secret, quotas and restore limitations                                                  |
| Commit                     | Reviewable; requires explicit handoff approval and acceptance of documented validation limits                        |
| Push                       | Not performed; requires approved Git handoff                                                                         |
| Draft PR                   | Content is reviewable; creation requires approved handoff                                                            |
| Merge                      | Not approved; latest-DEV combined CI and independent security review required                                        |
| DEV deployment             | Blocked pending explicit rollout approval and AI runtime/deployment wiring                                           |
| PROD deployment            | Blocked: quotas, authoritative deletion reconciliation, key custody, operational review and explicit policy approval |

## Repository Preservation

Main worktree: /Users/hagyemang/Developer/datrix/work-phelo.

- Branch: feat/ai-conversation-persistence.
- Unchanged HEAD/base: 8fde02a13f537142f7b7727e7634aa21f0714b65.
- Initial reported DEV: 4372e77b69680ddfb37beb6ba9cba6a9beab59cd.
- Final fetched DEV: 520ce8d08bdc0f8c5fcf5183121ba1fa7bb5a5ce.
- HEAD is zero commits ahead and eight behind DEV; pending files are not commits.
- Initial inventory: 70 files, 26 modified tracked plus 44 untracked.
- Inventory after the original review: 75 files, 26 modified tracked plus 49 untracked.
- Inventory after AI Docker remediation: 76 files, 26 modified tracked plus 50 untracked.
- All original 70 paths remain. Hash comparison before this report identified changes only to request-nonce.store.ts and request-integrity.spec.ts; subsequently one inaccurate cleanup comment was corrected.
- Added this phase: this report, real-Auth runner, Gateway Dockerfile-specific ignore, context verification runner and context unit spec.
- The subsequent AI Docker remediation adds scripts/verify-docker-context.mjs and updates only both AI ignore files, the existing Docker contract spec, container verification harness, README and this review. It does not alter the Dockerfile or application behavior.
- No existing migrations, frontend files, domain services, root dependency declarations or deployment workflows were changed during this phase.
- Existing pending AI migrations/schema/lockfile work belongs to earlier Phase 2B slices, not this hardening delta.
- All 16 original stash object IDs retained; nothing staged, committed, pushed, rebased, merged or deployed.

## Findings and Narrow Corrections

| Severity                        | Finding and evidence                                                                                                                                                                                                                                                                      | Disposition                                                                                                                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| High                            | Gateway Dockerfile broadly copies Gateway and shared source trees; root .dockerignore did not exclude all .env.\* variants. A local env could enter builder layers/cache even when not copied into final runtime. No claim of actual credential disclosure.                               | Added apps/api-gateway/Dockerfile.dockerignore with default-deny manifest/TypeScript allowlists and final secret-pattern exclusions. Dockerfile and workflows unchanged.                                |
| High, discovered at Git handoff | AI Docker ignore files still used directory-level inclusions. Synthetic credentials and unexpected descendants were admitted into the effective context and source COPY.                                                                                                                  | Handoff stopped before staging. Targeted file-only allowlist remediation and real Docker regression added; detailed results below.                                                                      |
| Medium                          | RequestNonceStore previously used an independent database transaction budget rather than the earlier signed deadline/proof expiry, and translated deadline failures to 503. A conflicting uncommitted nonce row could occupy the database after the request budget.                       | Pass validUntil into AiDatabaseService.transaction; preserve bounded deadline failures as 504; recheck expiry after transaction. Real PostgreSQL locked-row regression plus unit budget assertion pass. |
| Medium, before enablement       | No practical user/tenant aggregate storage quota or shared concurrency limit. Integer sequence overflow protection is not a product quota.                                                                                                                                                | No speculative policy implemented; proposed limits and ownership below. Default-disabled and production HTTP prohibitions retained.                                                                     |
| High, before production content | Restoring an old database can restore deleted conversations and old replay state. Database deletion alone cannot enforce deletion across backups.                                                                                                                                         | Production content remains blocked. External deletion reconciliation design below requires separate implementation and operations approval.                                                             |
| Existing protocol limitation    | Symmetric identity assertion uses shared platform secret; request integrity uses separate Gateway/AI HMAC keys. Holders can forge their respective assertions; signatures are not non-repudiation. Current identity is a short-lived snapshot, not an atomic transaction with Auth state. | Documented; no unsupported end-to-end or instant-revocation claim.                                                                                                                                      |

Only additional source change: correct a stale retention-cleanup comment claiming CREATE had no live writer. No cleanup semantics changed.

## Lifecycle Security Verification

Sources: apps/api-gateway/src/proxy/{proxy.controller,ai-conversation-body,ai-conversation-proxy,ai-request-integrity}.ts; apps/ai-service/src/{auth,security,request-integrity,conversations,persistence,encryption}/.

- Gateway strips client identity/assertion headers and obtains database-backed current identity from Auth. Inactive/deleted/suspended users, changed tenant binding and invalid session versions fail closed.
- Restricted careers scope and unsupported token types are rejected before forwarding. Current Auth tenant state, not JWT entitlement snapshots, is authoritative.
- Exact five conversation policies bind controller, handler identity, verb, route template, canonical raw path and operation. Prefixes, aliases, implicit HEAD, wrong methods and undeclared handlers grant no authority.
- Gateway serializes once and signs actual forwarded method/path/query/body, credential, context, selected headers, idempotency key, nonce and execution deadline. AI verifies captured raw bytes and actual request headers, not client-provided forwarded-path assertions.
- Atomic unique replay digests are committed before business execution. Cross-replica reuse fails; later business rollback does not unspend a nonce. Fresh proof plus same business key is the recovery mechanism.
- Opaque grants carry verified tenant/user/operation/deadline; all repository paths scope by tenant and owner. There is no administrator ownership bypass.
- CREATE and APPEND idempotency receipts are owner/operation scoped and use keyed fingerprints. Matching retries resolve existing live records; changed content conflicts. Missing/deleted/expired parents are not recreated while a receipt is retained.
- After receipt expiry and purge, reusing a key is a new operation, not an indefinite tombstone guarantee.
- AES-256-GCM authenticates contextual tenant/owner/conversation/message/role/sequence/version/key metadata. Malformed ciphertext, wrong context, unknown key and invalid UTF-8 fail closed; no plaintext fallback.
- JSON inputs, canonical query and pagination are bounded. Cookie mutations enforce exact approved Origin; a matching Bearer token does not bypass cookie-origin protection.
- Errors, upstream responses and cookies are sanitized; conversation responses use no-store. Paths/query/body/proof/credential content is not emitted by the AI proxy log path.
- Existing health/readiness and authenticated eligibility retain narrow exceptions and do not require a live nonce database for their own operations.
- Production HTTP enablement is rejected by configuration and guard; production signing is independently rejected. Cleanup scheduling and mock inference are not enabled in production.
- Persistence/provider initialization alone is not a universal NODE_ENV=production prohibition; it does not expose a content-write route. Do not configure production persistence flags as a substitute for release approval.
- AI failure does not add dependency to ERP routes; AI has no ERP clients, outbound business operations or real-provider integration.

## Gateway Docker Context

CI/dev/prod build from repository root with apps/api-gateway/Dockerfile. The new Dockerfile-specific ignore is selected for those exact builds and overrides the incomplete generic root ignore.

Allowed inputs: root package/lock/base-tsconfig, Gateway build manifests and production .ts sources, and exact types/schemas/utils/config manifests and production .ts sources. Nested specs, env variants, node_modules, generated output, credential patterns and private-key patterns are excluded after inclusions.

Service-directory context was already unsupported by the root-relative Dockerfile; it fails closed rather than gaining a second packaging convention.

The canary runner copies only public build inputs to a plain temporary directory, plants synthetic env/credential/key markers and an unrelated package marker, builds builder/runtime plus a temporary COPY-all context-audit target, exports images and scans files/layers/artifacts. It never copies real local env files or credential material. Build stages use npm ci from the current lockfile.

Final Gateway canary result: PASS for Linux/AMD64 builder, runner and COPY-all context-audit images, including exported layers/artifacts and compiled runtime imports. The builder used --no-cache; later runtime stages reused that verified builder. No deployment infrastructure changes are included.

The initial canary check failed because directory-level negations re-admitted the deliberately unrelated packages/not-required/src/canary.ts. Removing directory-level negations and retaining only explicit file patterns fixed it. The context-only diagnostic and complete build/export scan then passed. The unit test now forbids directory-level negations. This failed candidate was not accepted as final evidence.

Residual supply-chain scope: this prevents local file inclusion; it is not an npm dependency vulnerability audit or a defense against deliberately embedding secrets in otherwise approved source/manifests.

## AI Docker Security Blocker Remediation

The final Git-handoff review found that the AI ignore files retained the same unsafe directory-negation pattern previously removed from Gateway. The handoff stopped: no files were staged, committed or pushed and no PR was created. The original AI container-runtime check alone did not prove builder/context isolation; its earlier security interpretation was incomplete.

Reproduction used only public build inputs and 78 uniquely delimited synthetic fixtures in a plain temporary directory. The actual AI Dockerfile was used with an appended scratch COPY-all audit target; the source-copy path matches the real builder. Dockerfile-specific ignore precedence was tested against a deliberately conflicting root ignore.

Before the fix, 35 fixtures were admitted: .aws/credentials, .aws/config, .npmrc, credentials.json, extensionless private keys, hidden configuration (including .config/hidden.ts), nested credential files, unexpected text files, an unrelated app TypeScript file and a migration canary. Eleven were under the source directory copied into the builder. Root fixtures, env variants, .pem/.key/.p12 files and specs were already excluded. No actual credentials were inspected or copied, and no real leakage is claimed.

Root cause: !apps/, !apps/ai-service/, !apps/ai-service/src/, !apps/ai-service/src/\*\*/ and !apps/ai-service/prisma/ recursively re-admitted arbitrary descendants after the initial deny rule. Filename exclusions did not cover all credential/configuration classes.

Both AI ignore files now contain identical file-only inclusions: root package.json/package-lock.json/tsconfig.base.json; AI package.json/nest-cli.json/tsconfig.json/tsconfig.build.json; production src/\*_/_.ts; and prisma/schema.prisma. There are no directory-level inclusions. Final exclusions cover hidden files/directories, credential filenames, extensionless private keys, env variants, tests, generated outputs and key-file extensions. No required dependency was restored by broadening the allowlist.

The runtime build does not use migrations or host verification scripts. Migrations remain unchanged in the repository and are validated by deployment to a disposable local database, not copied into the application image. Prisma generation runs inside the clean builder; the generated client and engine are explicitly copied into runtime. OpenSSL, pinned Node base and non-root runtime settings are unchanged.

Regression: scripts/verify-docker-context.mjs verifies context contents and required build inputs, scans builder output, exported image files/layers/history and a mode=max local BuildKit cache, and runs the existing container harness. It uses no actual env files, credentials, host dependencies or generated clients. The default full check is Linux/AMD64 and uses --no-cache for the complete runtime build; a subsequent builder image export reuses that verified fresh builder. It removes only its own images, containers and temporary context/cache exports.

The documented supported packaging remains repository-root context with Dockerfile.dockerignore. A separate context-only run also verifies the mirrored service .dockerignore as a root-ignore fallback. This does not introduce support for a service-directory build context.

Validation: both context-selection paths excluded all 78 fixtures and retained required build inputs. Two complete clean Linux/AMD64 image/cache/runtime checks passed; the finalized harness also scans builder output. The full runtime build used --no-cache and a mode=max local cache export; exporting the corresponding builder reused that verified build. Builder output, image contents/layers/history and exported cache blobs contained no canaries. All uniquely named test contexts and exported caches were removed by the runner. The two new unit cases enforce exact inclusions and final exclusion ordering in both ignore files.

Fresh remediation regressions: AI with disposable PostgreSQL 694/694 (25 suites, no skips, 16.864 seconds); AI without database 608 passed and 86 explicitly skipped (24 suites passed, one skipped); Gateway 214/214; internal-auth 43/43. AI/Gateway lint passed (Gateway retains 17 existing warnings); Prisma validate and generation passed. Forced root-filtered typechecks passed ten tasks with zero cached (8.777 seconds), and builds passed seven tasks with zero cached (7.156 seconds). RBAC passed. Auth-specific 15-test and real-Auth 21-scenario evidence above is retained from the original review, not claimed as newly rerun in this Docker-only remediation.

The historical PostgreSQL failure did not reappear. Full output was retained locally in /private/tmp/workphelo-ai-remediation-postgres.log; loopback host/database clocks agreed when sampled before and after. This does not identify or resolve the original cause. Repeat combined-tree database-backed CI remains required before merge.

The existing runtime harness also adds a generated-Prisma-engine load check against unreachable loopback port 1 under network-none: it must produce only P1001 rather than missing client, engine or OpenSSL errors. This does not claim a container-to-database integration test. The same runtime was built separately with cache reuse for that additional harness check; clean-build evidence is the two complete builds above.

The strengthened container harness passed in full, including non-root/read-only/network-none execution, actual generated engine initialization, probes, production inference prohibitions, safe errors/logs and graceful SIGTERM/SIGINT. An intermediate test assertion used error.code rather than PrismaClientInitializationError.errorCode; correcting the harness assertion made the expected P1001 engine check pass. No application behavior changed. Both AI migrations were applied only to the disposable local database, whose contents and volume were removed after validation.

Final formatting, whitespace, inventory and stash-preservation checks passed. The complete pending inventory is 76 files: 26 tracked modifications and 50 untracked; the index remains empty and all 16 original stash IDs remain unchanged. Nothing was committed, pushed, merged or deployed, and no shared migration or production feature enablement occurred.

Remediation scope (seven paths): apps/ai-service/.dockerignore; apps/ai-service/Dockerfile.dockerignore; apps/ai-service/src/docker-foundation.spec.ts; apps/ai-service/scripts/verify-docker-context.mjs (new); apps/ai-service/scripts/verify-container.mjs; apps/ai-service/README.md; apps/ai-service/PHASE_2B_RELEASE_REVIEW.md. No original pending file was removed and no non-AI file changed during this remediation.

Remaining limits: an allowlisted source or manifest can itself contain deliberately embedded secrets; this is not a full supply-chain or malicious-source defense. Only synthetic local cache exports/build artifacts were inspected, not existing shared CI caches or registries. Prior caches could retain historical material and need separate operator review if exposure is suspected. Native x86 performance and production runtime/dependency uplift remain separate requirements. The unexplained PostgreSQL failure remains unresolved.

## Real Auth Integration

Runner: apps/ai-service/scripts/verify-real-auth.cjs.

Uses actual Auth AppModule, Prisma, JWT strategy, guarded /me controller/service; actual compiled Gateway proxy and AI application; disposable PostgreSQL ai and w_auth schemas. Synthetic fixture identities/tokens only. Only outbound HR/Notification messaging clients are replaced with rejecting doubles.

Auth is booted from an empty temporary current directory so its default ConfigModule cannot load local .env. Fixtures use loopback URLs and no external messaging/OAuth. A fixture JWT is minted for testing; actual email login, OAuth and Microsoft providers are not exercised.

PASS: 21 scenarios:
active identity/tenant; INACTIVE; SUSPENDED; accessSuspendedAt; old session-version rejection; fresh matching version; PENDING/SUSPENDED/CANCELLED tenant; removed/reassigned tenant linkage; cross-tenant JWT binding; careers scope; unsupported token type; database-stalled Auth lookup returning 504 within 6.5 seconds; deleted identity; Auth outage returning 503.

The additional five requests create a conversation, append a message, read its decrypted paginated result, delete it with 204 and verify subsequent detail is 404. Together with the active-user list request, all five operation types traverse actual Auth, Gateway, AI and PostgreSQL. One intermediate runner assertion incorrectly assumed messages was an array; it was corrected to the existing messages.items contract without changing application behavior.

Membership is User.tenantId in this implementation, not a separate membership table. Revocation tested here means current sessionVersion invalidation; revoking only an unrelated refresh-token row is not claimed to invalidate an issued access token.

The actual Auth database stall uses a local ACCESS EXCLUSIVE lock released by its fixture transaction. No shared database was accessed.

## HTTP, Database and Deadline Evidence

Full AI integration specs exercise all five operations over actual HTTP and PostgreSQL: encrypted-only storage, fixed expiry, owner isolation, cross-tenant denial, cascade deletion, concurrent duplicates, changed-content conflict, database/nonce outages, proof mismatch, spent proofs, failed business transactions and fresh-proof recovery.

An actual client connection is dropped after durable CREATE commit; a fresh proof with the same business key recovers without duplicate creation. A timeout or lost response is not evidence of rollback.

Gateway shares a five-second budget across Auth lookup and forwarding. Signed request validity is bounded to ten seconds; AI uses the earlier proof expiry/execution deadline. Database transaction/retry/pool/statement/lock budgets are clipped to remaining time. No ERP-wide timeout was increased.

New nonce regression holds a conflicting nonce INSERT uncommitted, supplies a 600ms execution deadline and verifies 504 in less than 1200ms. The blocker is safely released and its single nonce row remains; the test does not assert that already-committed replay state is rolled back.

Database callbacks have at most three retries for classified serialization/deadlock errors, not arbitrary automatic replay of every failure. Response serialization is byte-bounded.

## Capacity Assessment and Proposed Limits

Verified current limits:

| Dimension                            | Implemented behavior                                                                                                  |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| Per-message plaintext                | 16,384 UTF-8 bytes                                                                                                    |
| Raw HTTP request                     | 32 KiB                                                                                                                |
| Detail response                      | 256 KiB; bounded rejection, not unbounded response                                                                    |
| Page                                 | Up to 100 records; list fetches one extra for continuation                                                            |
| Conversation message count           | Sequence overflow guard only: up to 2,147,483,646 messages                                                            |
| Aggregate conversation content       | No practical cap; integer ceiling permits approximately 32 TiB plaintext before envelope/index overhead               |
| User/tenant conversations or storage | No durable aggregate quota                                                                                            |
| Concurrency                          | Transaction/lock deadlines bound individual work; no shared per-user/tenant inflight cap                              |
| Nonces                               | One database write per accepted proof, including reads and requests whose later business transaction fails            |
| Nonce lifetime                       | Beyond max(proof expiry, execution deadline) by 60 seconds; internal purge is bounded but not automatically scheduled |
| Receipts                             | CREATE plus each unique APPEND; fixed 720-hour receipt lifetime                                                       |
| Expired data                         | Hidden at expiry but remains physically stored until cleanup runs                                                     |

Existing Gateway throttling is process-local and IP-based (30/second, 150/10 seconds, 600/minute), not a tenant quota or distributed concurrency policy. Redis availability elsewhere does not mean AI uses shared quota enforcement. Restricting a page does not bound total tenant growth.

At the configured 600 requests/minute ceiling, one continuously active IP/process could theoretically create 25,920,000 nonce rows in 30 days if nothing purges them. This is a configured-window growth illustration, not a throughput benchmark, and multiple replicas/IPs multiply it. Monitor clock synchronization across Gateway, AI and PostgreSQL rather than widening proof/deadline acceptance to hide clock problems.

PROPOSED, NOT APPROVED: initial closed DEV pilot caps of 50 conversations/user, 1,000 messages/conversation, 10 MiB plaintext-equivalent/user and 100 MiB/tenant, whichever cap is reached first; two inflight operations/user and ten/tenant; ten writes/minute/user and 100/tenant; 60 reads/minute/user and 600/tenant. Include ciphertext/nonce/receipt/index overhead in a separate measured physical-storage ceiling.

Before enablement, product/security approve ceilings and administrator behavior; engineering implements atomic quota reservation with conversation writes and shared rate/concurrency enforcement; operations supplies storage/latency alerts, cleanup budgets and load-test evidence. No proposed quota is represented as implemented.

## Retention, Deletion and Backup Recovery

Conversation expiry is fixed createdAt + 720 hours, never extended by append/read. Explicit deletion is ownership-scoped and returns 204 once, 404 on repeat; message FK cascade is atomic. Cleanup needs no decryption, takes bounded expired-parent locks with SKIP LOCKED and handles receipt contention without blocking reverse lock order. Scheduler is off by default; multi-replica and failure tests pass.

CREATE receipts expire with their parent; APPEND receipts use their own creation-based 720 hours. A retained receipt referring to a deleted parent fails rather than recreating it. Expired-key reuse after purge is permitted as a new operation, not replay of an old proof.

A restore can resurrect rows that were absent at backup time and can restore old nonce/receipt state. Proposed authoritative reconciliation design, outside this database restore boundary:

1. Separate durable deletion journal with immutable operation ID, tenant/owner/conversation UUID, deletion generation/time and committed watermark; no message content. Use independently retained, access-controlled/WORM or versioned storage.
2. Define an approved crash-safe acknowledgement protocol. Record deletion intent durably outside the restore domain before acknowledging final deletion, and transactionally remove content plus retain a retryable local tombstone/outbox; reconcile interrupted intents idempotently. Do not claim a DB transaction alone atomically commits external storage.
3. Restore into an isolated environment with user traffic and outbound delivery disabled. Obtain the authoritative journal watermark independently of the restored backup.
4. Replay deletions/tombstones and expiry using original timestamps; remove restored content/receipts that conflict with authoritative deletion, and verify zero surviving rows for covered IDs.
5. Reconcile replay state and rotate/invalidate pre-restore request-signing keys so stale proofs cannot become usable. Confirm all Gateway/AI replicas use the new keys before routing traffic.
6. Record evidence/watermarks and require operations/security approval before reopening. Backup expiry and key retention require provider-specific verification; no promise of physical erasure from backups is made.

Owner: separate persistence/operations workstream. No external deletion ledger is implemented. Production content persistence remains blocked until this policy and its implementation are verified.

## Keys and Runtime Database Privileges

AES uses independently configured 32-byte keys with random 12-byte nonce and 16-byte authentication tag. Historical ciphertext selects the exact embedded key ID; no trial-decrypt or plaintext fallback. Fingerprint HMAC and request-proof HMAC have separate configuration and purpose; reused material is rejected where configured together.

Keep encryption and fingerprint historical keys for at least all still-readable ciphertext/receipts and any approved restore horizon; do not retire a key merely because the active key changed. Gateway/AI proof verification overlap must cover in-flight requests, and backup recovery must explicitly invalidate proofs. There is no automatic rotation.

Missing/corrupt historical keys fail reads safely, not data recovery. Provision and back up keys separately with controlled custody; losing keys can make data irrecoverable. JavaScript strings cannot be reliably zeroed even though temporary buffers are cleared. Neither encrypted storage nor key ID hashing prevents process-memory compromise.

Restricted-role PostgreSQL fixtures demonstrate denied cross-service schema access and DDL, not production role provisioning or row-level-security isolation. Application owner predicates, not PostgreSQL RLS, enforce user isolation. Migration owner and runtime roles must be separate. Avoid granting runtime superuser/schema-creation privileges; propose a dedicated cleanup role rather than DELETE on replay state to ordinary request handlers. Do not treat test fixture grants as an approved production grant script.

## Validation Commands and Results

All listed tests were fresh process executions, not Turbo cache hits.

| Command / boundary                                                                                                  | Result                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| AI_TEST_DATABASE_URL=<loopback disposable> npm test --workspace=apps/ai-service -- --runInBand                      | 25 suites, 692 passed, zero skipped                                                                                                     |
| env -u AI_TEST_DATABASE_URL npm test --workspace=apps/ai-service -- --runInBand                                     | 24 suites passed, one suite skipped; 606 passed, 86 skipped                                                                             |
| npm test --workspace=apps/api-gateway -- --runInBand                                                                | 10 suites, 214 passed                                                                                                                   |
| npm test --workspace=@work-phelo/internal-auth -- --runInBand                                                       | Four suites, 43 passed                                                                                                                  |
| npm test --workspace=apps/auth-service -- --runInBand jwt.strategy.spec.ts auth.controller.current-context.spec.ts  | Two suites, 15 passed                                                                                                                   |
| AI_TEST_DATABASE_URL=<loopback disposable> node apps/ai-service/scripts/verify-real-auth.cjs                        | 21 real Auth/Gateway/AI/database scenarios passed                                                                                       |
| npm test --workspace=apps/ai-service -- --runInBand request-integrity.spec.ts                                       | Post-lint correction: 56 passed, nine database tests explicitly skipped without URL                                                     |
| npm run check-types -- --filter=ai-service --filter=api-gateway --filter=@work-phelo/internal-auth --force          | Ten tasks passed; zero cached                                                                                                           |
| npm run build -- --filter=ai-service --filter=api-gateway --filter=@work-phelo/internal-auth --force                | Seven tasks passed; zero cached                                                                                                         |
| npm run lint --workspace=apps/ai-service                                                                            | Passed after typed test assertions corrected                                                                                            |
| npm run lint --workspace=apps/api-gateway                                                                           | Passed; 17 pre-existing warnings, zero errors                                                                                           |
| DATABASE_URL=<nonconnecting placeholder> npm run db:validate --workspace=apps/ai-service                            | Passed                                                                                                                                  |
| npm run db:generate --workspace=apps/ai-service                                                                     | Passed via fresh build/test/typecheck prehooks; generated output ignored                                                                |
| npm run check-rbac                                                                                                  | Passed                                                                                                                                  |
| Pending-file prettier --check --ignore-unknown                                                                      | Passed; final report also formatted and checked                                                                                         |
| git diff --check                                                                                                    | Passed                                                                                                                                  |
| docker build --no-cache --platform linux/amd64 -f apps/ai-service/Dockerfile -t workphelo-ai-foundation:b6-review . | Passed; fresh npm ci and application build                                                                                              |
| node apps/ai-service/scripts/verify-container.mjs workphelo-ai-foundation:b6-review                                 | Passed: non-root, read-only/network-none, health/readiness, default deny, production startup prohibitions, safe errors/logs and signals |
| node apps/api-gateway/scripts/verify-docker-context.mjs                                                             | Passed after file-only allowlist correction; builder/runtime/context image and layer scans, compiled runtime imports                    |

AI image was Linux/AMD64 tested through Docker emulation on an ARM64 host; this is not native x86 performance evidence. Host Node v25.8.1 and container Node 20 differ; container validates Node 20 behavior. Dependency deprecation warnings are not remediated by this task.

Failed/repeated checks: AI lint initially caught two unsafe test mock-call assertions; typed matcher assertions fixed them and lint passed. After an initial full 692-test PostgreSQL pass, a repeat run reported 41 failures across six suites, including 401 proof responses and expired-data backlog mismatches. A serialized rerun with no concurrent image build passed all 692 in 18.18 seconds. Host/container/database clocks agreed when subsequently checked; no causal clock skew or baseline defect was proven. Do not dismiss the failed repeat as a confirmed environmental issue. Require repeat database-backed CI on the combined candidate before merge. Final Gateway rerun passed all 214 tests.

A second isolated final PostgreSQL run also passed all 692 in 17.945 seconds. Final forced root-filtered validation passed again: ten typecheck tasks (6.881 seconds) and seven build tasks (3.918 seconds), zero cached in each. The simple pending-file credential-pattern check inspected all 75 paths and found no local env paths, private-key blocks or high-confidence AWS/GitHub token patterns; it is not a comprehensive secret-scanner guarantee.

Two AI migrations were applied only to the disposable database. Auth current schema was materialized only in that same disposable database's w_auth schema with prisma db push --skip-generate; no reset or shared migration was executed.

No full unfiltered monorepo build/typecheck is claimed. Requested forced root-filtered tasks passed; unrelated Marketing/Accounting artifact repairs were not attempted.

## Latest DEV Compatibility

Final DEV has eight commits beyond HEAD, including PRs #794/#795/#796: leave-on-behalf, payroll-by-currency backend/schema, HR payroll UI and minor other frontend presentation. All 32 changed paths are HR/frontend, with no overlap with the pending 76-path feature. No root manifest/lockfile, AI/Gateway/Auth or deployment change intersects this feature.

Incoming HR migrations are separate from AI schema migrations and have distinct directory names. Read-only git diff HEAD..origin/dev --binary | git apply --check passes against the current main worktree, without applying anything.

This is source/patch compatibility evidence, not a combined-tree test or mergeability guarantee from GitHub. No clean commit was created, and no additional persistent worktree was allowed. Full combined latest-DEV CI is deferred to authorized Git handoff; intervening DEV advancement must be checked again. No assertion that unrelated payroll/frontend changes pass their own tests is made.

## Remaining Requirements and Next Actions

| Requirement                                                                         | Owner / gate                                                                 |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Review full pending inventory and security patch, authorize Git handoff             | Maintainer/security before commit/push/draft PR                              |
| Validate combined latest DEV in PR CI                                               | Maintainer/CI before merge                                                   |
| Add AI image/service/deployment/migration wiring and independent Gateway/AI secrets | Infrastructure; no existing AI entries found under .github or infrastructure |
| Approve closed DEV-only flags, local schema/runtime grants and rollout limits       | Security/operations before DEV content enablement                            |
| Shared quotas/concurrency/abuse protection and physical-storage monitoring          | Product/backend/infrastructure before broader enablement                     |
| Authoritative external deletion reconciliation and restore rehearsal                | Persistence/operations before production content                             |
| Key custody/backup/rotation/retirement and restore invalidation                     | Security/operations before production                                        |
| Independent review, explicit deployment authorization                               | Maintainer; never implied by tests                                           |

Do not start Phase 2C, real inference, retrieval or ERP tools. This report does not authorize Git handoff.

## Final Closeout

Main branch and HEAD remain unchanged. Final index is empty; 26 tracked modifications and 50 untracked files remain after AI context remediation, all in the inventory below. All 16 original stash object IDs are unchanged. No frontend/local environment files were edited. No shared database migration, commit, push, merge, deployment, inference or ERP business access occurred.

The task-owned disposable PostgreSQL container and its volume were removed after tests. The task-owned AI image tag was removed; Gateway canary runs remove their own temporary image tags and directories. Existing host services and images were not pruned. Ordinary Docker build cache may remain; it contains only the public/synthetic test context from these builds.

## Complete Pending File Inventory

All paths below are relative to repository root. M means tracked modification; ? means untracked. No staged files.

```text
M apps/ai-service/.dockerignore
M apps/ai-service/Dockerfile
M apps/ai-service/Dockerfile.dockerignore
M apps/ai-service/README.md
M apps/ai-service/package.json
? apps/ai-service/prisma/migrations/20261118120000_add_ai_persistence_foundation/migration.sql
? apps/ai-service/prisma/migrations/20261118150000_add_ai_request_nonce_replay/migration.sql
? apps/ai-service/prisma/migrations/migration_lock.toml
M apps/ai-service/prisma/schema.prisma
M apps/ai-service/scripts/verify-container.mjs
? apps/ai-service/scripts/verify-docker-context.mjs
? apps/ai-service/scripts/verify-real-auth.cjs
M apps/ai-service/src/app.module.ts
M apps/ai-service/src/app.setup.ts
M apps/ai-service/src/app.spec.ts
M apps/ai-service/src/auth/trusted-auth.spec.ts
M apps/ai-service/src/common/error-codes.ts
M apps/ai-service/src/common/http-exception.filter.spec.ts
M apps/ai-service/src/common/http-exception.filter.ts
M apps/ai-service/src/config/runtime-env.spec.ts
M apps/ai-service/src/config/runtime-env.ts
? apps/ai-service/src/conversations/conversation-bindings.ts
? apps/ai-service/src/conversations/conversation.dto.ts
? apps/ai-service/src/conversations/conversations.controller.ts
? apps/ai-service/src/conversations/conversations.http.spec.ts
? apps/ai-service/src/conversations/gateway.integration.spec.ts
M apps/ai-service/src/docker-foundation.spec.ts
? apps/ai-service/src/encryption/encryption-error.ts
? apps/ai-service/src/encryption/encryption.module.ts
? apps/ai-service/src/encryption/key-ring.config.ts
? apps/ai-service/src/encryption/key-ring.service.ts
? apps/ai-service/src/encryption/message-context.ts
? apps/ai-service/src/encryption/message-encryption.service.ts
? apps/ai-service/src/encryption/message-encryption.spec.ts
M apps/ai-service/src/main.ts
? apps/ai-service/src/persistence/ai-database.service.ts
? apps/ai-service/src/persistence/conversation-operation.error.ts
? apps/ai-service/src/persistence/conversation-operations.service.ts
? apps/ai-service/src/persistence/conversation-operations.spec.ts
? apps/ai-service/src/persistence/conversation-pagination.ts
? apps/ai-service/src/persistence/conversations.repository.ts
? apps/ai-service/src/persistence/ownership-context.ts
? apps/ai-service/src/persistence/persistence.module.ts
? apps/ai-service/src/persistence/persistence.spec.ts
? apps/ai-service/src/persistence/postgres.integration.spec.ts
? apps/ai-service/src/persistence/request-nonce.store.ts
? apps/ai-service/src/persistence/retention-cleanup.service.ts
? apps/ai-service/src/persistence/retention-cleanup.spec.ts
? apps/ai-service/src/persistence/retention-policy.ts
? apps/ai-service/src/persistence/submission-fingerprint.service.ts
M apps/ai-service/src/prisma-foundation.spec.ts
? apps/ai-service/src/request-integrity/raw-request.ts
? apps/ai-service/src/request-integrity/request-integrity.module.ts
? apps/ai-service/src/request-integrity/request-integrity.service.ts
? apps/ai-service/src/request-integrity/request-integrity.spec.ts
? apps/ai-service/src/request-integrity/verification-keys.ts
? apps/ai-service/src/security/conversation-authorization.module.ts
? apps/ai-service/src/security/conversation-authorization.service.ts
? apps/ai-service/src/security/conversation-authorization.spec.ts
? apps/ai-service/src/security/conversation-handler.policy.ts
M apps/ai-service/src/security/foundation-only.guard.spec.ts
M apps/ai-service/src/security/foundation-only.guard.ts
? apps/api-gateway/Dockerfile.dockerignore
M apps/api-gateway/README.md
? apps/api-gateway/scripts/verify-docker-context.mjs
? apps/api-gateway/src/docker-context.spec.ts
M apps/api-gateway/src/main.ts
? apps/api-gateway/src/proxy/ai-conversation-body.ts
? apps/api-gateway/src/proxy/ai-conversation-proxy.spec.ts
? apps/api-gateway/src/proxy/ai-conversation-proxy.ts
? apps/api-gateway/src/proxy/ai-request-integrity.spec.ts
? apps/api-gateway/src/proxy/ai-request-integrity.ts
M apps/api-gateway/src/proxy/current-state.spec.ts
M apps/api-gateway/src/proxy/proxy.controller.ts
M package-lock.json
? apps/ai-service/PHASE_2B_RELEASE_REVIEW.md
```
