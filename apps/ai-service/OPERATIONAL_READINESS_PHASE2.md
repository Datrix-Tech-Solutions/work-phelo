# Operational readiness Phase 2: review evidence

Date: 2026-11-25. Branch: `feat/ai-shared-resource-safeguards`.
Verified DEV baseline: `60701d11ae924fad05d155c7cf30ca9275e634b7`.
PRs #791, #793, #797, #798 and #807 are ancestors. Subsequent baseline changes
were frontend HR changes, not a different AI security architecture.

## Implemented, not enabled

- Shared Redis tenant/owner admission after current Auth validation; separate
  read, write and delete buckets, HMAC identities, server time, 100 ms total
  deadline, bounded Retry-After and no process-local fallback.
- Redis readiness bound to server run_id and key configuration. Missing/stale
  readiness, mismatched replicas, bad bucket state, ACL errors and eviction-policy
  violations fail closed. Standalone Redis only; recovery is operator-controlled.
- PostgreSQL tenant/owner execution pools with generation fencing and row locks.
  Expiry cannot authorize a previous generation after reuse. Slot initialization
  skips existing rows rather than waiting behind active slot locks.
- Transactional retained envelope/conversation/message accounting and quotas.
  Triggers charge successful inserts only, not ON CONFLICT skips, and cover legacy
  creation, append, rollback, cascades and bounded partial cleanup.
- Separate receipt/nonce caps, configurable cleanup budgets, overdue-backlog
  rejection and bounded tenant reconciliation with durable checkpoints.
- Default-off configuration, production prohibitions, owner-only encryption,
  nonce replay protection and fixed retention remain. No new public endpoints,
  provider SDKs, inference, ERP tools, business mutations or deployment flags.

See [SHARED_RESOURCE_SAFEGUARDS.md](SHARED_RESOURCE_SAFEGUARDS.md) for exact limits,
metadata derivation, configuration, reconciliation and activation prerequisites.
One additive migration: `20261125120000_ai_shared_resource_safeguards`.
Neither applied migration was edited. Only disposable local databases were used.

## Fresh validation

Host: Node 25.8.1, npm 11.11.0; Prisma 5.22.0. Containers: PostgreSQL 16 and Redis 7.
Image/runtime checks separately used Linux/AMD64 and the pinned Node 20 image.

| Check                                           | Result                                                       |
| ----------------------------------------------- | ------------------------------------------------------------ |
| Full AI suite, real PostgreSQL, serial          | 740 passed; 26 suites; zero skips                            |
| Full Gateway suite, real Redis                  | 225 passed; 11 suites; zero skips                            |
| Actual Auth + Gateway + Redis + AI + PostgreSQL | 21 scenarios passed; only outbound Auth messaging doubled    |
| Auth full suite, forced root test execution     | 409 passed                                                   |
| Internal-auth tests, forced root execution      | 43 passed                                                    |
| Accounting supported serial unit command        | 808 passed                                                   |
| AI / Gateway lint                               | Passed; Gateway retains 17 existing warnings                 |
| AI / Gateway typechecks and builds              | Passed                                                       |
| AI Prisma format / generation / validation      | Passed                                                       |
| Fresh additive migration deployment             | Passed in disposable AI schema                               |
| Bounded operator CLI checkpoints                | Passed with validated raw-env configuration and batch size 1 |
| RBAC alignment                                  | Passed; no permission catalog changes                        |
| Linux/AMD64 image + runtime security harness    | Passed                                                       |
| Docker synthetic credential exclusion           | 78 synthetic files excluded; image/layer/cache scans passed  |
| Changed-source formatting / whitespace          | Passed                                                       |

Database regressions include parallel quota-boundary writes, exact tenant/owner
envelope boundaries, 1,000-message cap, successful receipt replay, failed insert
and cleanup rollback, retained expiry, partial/concurrent cleanup, two independent
permit clients, stale generations, actual SIGKILL of an owned fixture worker,
fifteen-second lease configuration, transaction timeout, metadata exhaustion,
missing counters, frozen-tenant denial and resumable/concurrent reconciliation.
Expiry is advanced explicitly only in controlled lease-recovery fixtures; tests
do not claim a production crash/failover drill occurred.

Existing parallel HTTP receipt fixtures retain their final single-write assertions.
Capacity rejection is retried with a fresh proof and the same idempotency key;
security/proof-replay assertions are not removed. Default-deny fixtures explicitly
isolate their disabled configuration and do not inherit previously enabled flags.

## Broader local validation limitations

Forced root build, typecheck and lint were attempted and are NOT green. They stop
in unrelated Marketing Prisma generation with `Unexpected end of JSON input` in
the local generated-client artifact. This patch does not repair, stage or publish
Marketing artifacts or claim root-wide validation passed.

Forced root tests used one workspace at a time and continued to collect failures.
Marketing suites cannot resolve their generated client. Five HR suites cannot
compile against the stale local HR client (including missing ProjectClientSource
and newer project/payroll fields). No HR/Marketing source was changed. The root
Accounting script also combines its built-in maxWorkers with forwarded runInBand,
which Jest rejects; its supported `test:unit -- --runInBand` was run separately and
passed. Root-run passing suites are evidence only for those suites, not a claim
that the entire monorepo passed. Clean-install CI remains a separate review gate.

## Remaining adoption gates

Review and merge are separate from authorization to deploy or enable. Before any
future activation, independently approve migration/DB privileges, tenant accounting
reconciliation, dedicated Redis memory/ACL/epoch, consistent HMAC secrets, measured
latency/capacity, metadata caps, cleanup scheduling and disk/backup retention.
The readiness protocol deliberately rejects Redis restart/failover until recovery;
it is not seamless HA. HMAC rotation requires quiescing all replicas. Database
administrators or disabled triggers are outside this application trust boundary.
Existing shared assertion-secret and signed-snapshot limitations remain.

The unrelated Auth README is excluded. No frontend, domain-service source,
infrastructure, environment files or generated clients belong in this handoff.
Existing stashes/worktrees are preserved. No shared migrations, reconciliation,
deployment, conversation activation or external inference was performed.
