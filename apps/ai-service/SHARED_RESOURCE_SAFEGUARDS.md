# Shared resource safeguards

Review-only implementation, not authorization to deploy, migrate shared databases,
reconcile tenants, enable conversations or call external providers.

## Policy and authority

Only the five existing conversation operations use shared admission, after trusted
Gateway authentication and current Auth validation. Existing IP throttling, health
and eligibility behavior are unchanged. Redis atomically spends tenant and owner
token buckets using Redis TIME and versioned HMAC keys. There is no local fallback.
429 includes integer Retry-After 1..60; untrusted admission returns 503. All Redis
work, including connection and readiness, has a combined 100 ms ceiling.

| Resource                        |  Owner |   Tenant |
| ------------------------------- | -----: | -------: |
| Reads / minute; burst           | 60; 10 | 600; 100 |
| Create + append / minute; burst |  10; 2 |  100; 20 |
| Separate delete / minute; burst |  10; 2 |  100; 20 |
| Executions                      |      2 |       10 |
| Retained conversations          |     50 |      500 |
| Encrypted envelope bytes        | 10 MiB |  100 MiB |

Each conversation retains at most 1,000 messages in protected mode. Existing 16 KiB
message limits, five-second deadlines, 720-hour fixed retention, owner-only access,
encryption, proof binding and nonce/receipt semantics remain intact. Conversation
and cleanup flags remain default-off and prohibited in production.

AI independently consumes the trusted nonce, atomically obtains both PostgreSQL
permit scopes, then executes business work. The empty owner namespace is reserved
for tenant capacity. Slots use random lease IDs, monotonic generations and a
15-second recovery window. Each business transaction verifies generation and
unexpired lease, then holds SHARE row locks until commit/rollback. Reclaim uses
FOR UPDATE SKIP LOCKED: an expired but locked execution cannot overlap a reused
slot. A paused former generation cannot commit after reuse. Conditional release
cannot free a newer lease. Gateway disconnects do not release AI permits. Existing
transaction deadlines remain; protected transactions add a four-second idle watchdog.

Source-table triggers update tenant, owner and conversation counters in the same
transaction as all creation paths, append, cascade deletion and partial cleanup.
Tenant-scoped advisory locks serialize accounting, never all tenants globally.
Charge = ciphertext length + nonce length + authentication-tag length + UTF-8
key-ID length + two bytes for the stored SMALLINT version. This accounts for the
envelope, not physical PostgreSQL row/index/WAL overhead. Successful receipt replay
does not insert or double-charge. Nonce ON CONFLICT charges only an actual insert.

Expired retained rows remain charged until deletion commits. Historical over-limit
rows are preserved. Reads and authorized deletion do not check storage capacity;
metadata exhaustion, accounting freeze or dependency failure can deny them
independently. Storage rejection is 409 `AI_STORAGE_QUOTA_EXCEEDED`. Gateway forwards
only that approved code, never raw upstream errors or sensitive headers.

## Configuration and recovery

Both processes default `AI_RESOURCE_SAFEGUARDS_ENABLED=false`. AI HTTP conversation
enablement requires it plus all existing prerequisites. This patch changes no
deployment flags or infrastructure settings.

Gateway requires `AI_ADMISSION_REDIS_URL` and `AI_ADMISSION_KEY_HMAC_SECRET` (canonical
base64 32 bytes, independent of JWT/assertion/encryption/fingerprint keys, shared by
Gateway replicas). Use dedicated Redis 7 standalone, TLS/scoped ACLs in deployed
environments, positive maxmemory and **noeviction**. Redis Cluster is not supported:
the readiness key is global. Memory policy and server run_id are checked on each
admission. ACLs must allow connection/readiness including INFO, EVAL, GET, TYPE,
TIME, HMGET, HSET and PEXPIRE on `ai:admission:v1:*`. Provision ACLs outside the app.
OOM, ACL/network errors, bad state types, missing epoch and restart fail closed.
Capacity-test memory sizing; noeviction does not make an undersized instance safe.

No automatic cold-start blessing exists. After reset/failover or HMAC rotation,
stop protected admission on ALL replicas, wait at least 60 seconds (exceeding the
maximum bucket refill interval), verify memory policy, server identity and shared
secret, then an authorized operator sets `ai:admission:v1:epoch` to the current
INFO server run_id joined by `:` to the hex HMAC-SHA256 of the fixed string
`workphelo.ai.admission.v1` using that shared key. This binds readiness to server
identity and secret configuration; a mismatched replica fails closed. Do not print
the key or its derived readiness tag. Verify independently before resuming. Use a credential-safe
client, not credentials in shell history. Never flush live buckets or initialize
the epoch in deployment startup. Only known-empty disposable fixtures initialize
immediately. This is a standalone Redis recovery protocol, not seamless failover.

Receipt caps derive from 30 days of write refill plus burst:
`AI_METADATA_OWNER_RECEIPT_LIMIT=432002`,
`AI_METADATA_TENANT_RECEIPT_LIMIT=4320020`.
`AI_METADATA_OWNER_NONCE_LIMIT=256` and `AI_METADATA_TENANT_NONCE_LIMIT=4096` exceed
twice the 70-second proof traffic envelope (read + write + delete), rounded upward.
The existing SQL maximum nonce lifetime remains 75 seconds. Limits may be lowered,
not raised above these derived defaults. These are ceilings, not provisioned disk
capacity: approve lower operational caps if measured storage cannot sustain them.
Existing unscoped nonces are retained, not assigned invented ownership. A bounded
4097-row sample denies protected traffic above 4096 until safe expiry cleanup.

`AI_METADATA_BACKLOG_GRACE_SECONDS=120` (1..3600) blocks new metadata growth for a
tenant with overdue expired receipts/nonces. Never discard live replay records.
`AI_CLEANUP_RECEIPT_BATCH_SIZE` (1..100) and `AI_CLEANUP_NONCE_BATCH_SIZE` (1..1000)
default to `AI_CLEANUP_BATCH_SIZE` (25); parent/child work retains its own bounded
budget. Cleanup skips frozen tenants, uses row SKIP LOCKED and nonblocking tenant
accounting locks, and commits deletion/decrements together. Logs contain bounded
counts and durations only. Scheduler remains off pending separate approval.

## Migration and explicit reconciliation

`20261125120000_ai_shared_resource_safeguards` adds counter, slot and checkpoint
tables plus nullable nonce ownership/indexes. Neither applied migration changes.
No data backfill runs at startup. Fresh empty scopes initialize on first protected
nonce/mutation; populated scopes with missing counters fail closed. Negative
counters are rejected by CHECK constraints, missing owner/conversation usage fails
closed. Suspected drift from administrative SQL/disabled triggers requires explicit
reconciliation; quotas do not defend against a privileged database administrator.

With separately approved persistence configuration and built AI artifacts:

```sh
node apps/ai-service/scripts/reconcile-resource-accounting.cjs TENANT_ID
```

Each call processes at most 100 source rows and prints only stage/processed/done.
Repeat until done. Durable checkpoints and a tenant advisory lock make retries
resumable and concurrent workers serialized. That tenant is frozen throughout;
others continue. Phases clear owner counters in bounded batches, scan conversations,
encrypted messages, receipts, scoped nonces, then separately finalize. No decryption
or source deletion occurs. Counters and cursor commit together. Over-limit history
remains readable/deletable after completion; new growth is denied. To rebuild a
completed scope explicitly, use `--restart-completed`. Never abandon a frozen scope.
The step API and optional CLI `--batch-size=25` permit 1..500 rows. A deadline failure rolls back only that
checkpoint; resume with a smaller batch if 100 cannot fit the deadline. Runtime DB
grants must cover new tables and trigger functions; verify least privilege apart
from migration-role credentials. No public reconciliation endpoint is added.

## Validation and future activation

Database tests own guarded disposable loopback DB `workphelo_ai_2b1`, schema `ai`;
Redis tests own loopback port 17991, database 0. Run database suites serially.

```sh
npm test --workspace=apps/ai-service -- --runInBand
npm test --workspace=apps/api-gateway -- --runInBand
node apps/ai-service/scripts/verify-real-auth.cjs
```

Set `AI_TEST_DATABASE_URL` / `AI_TEST_ADMISSION_REDIS_URL` only to those fixtures.
The last command also requires built AI/Gateway artifacts and Auth migrations/client
in the disposable DB. Only outbound Auth messaging is doubled. Existing transport
fixtures explicitly double Redis admission; separate tests cover real shared Redis.
Concurrent receipt fixtures retry capacity rejection with fresh proofs and the
same idempotency key; they preserve final single-write assertions.

Future activation requires independent authorization for migration, privileges,
tenant reconciliation, Redis memory/ACL/epoch and secret distribution, cleanup
capacity/scheduling, monitoring and backup-retention policy. No external inference,
provider SDKs, ERP tools, mutations or background model work is included. Existing
shared assertion-secret and bounded signed-snapshot/replay limitations remain.
