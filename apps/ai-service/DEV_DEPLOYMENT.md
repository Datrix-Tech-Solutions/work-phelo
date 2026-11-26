# DEV application deployment and authorized database maintenance

## Eligibility-only AI rollout

Pushes to `dev` build selected SHA-tagged images, validate configuration and database
compatibility, roll out applications, then check health. Routine deployment needs
no database-approval variable and never runs migrations, seeds or permission
reconciliation. Normal application business writes/jobs are not disabled by this
separation. PROD deployment is unchanged.

AI uses `http://ai-service:4011` on `workphelo-dev-network`, without a public host
port. Gateway and AI use the existing shared JWT verification secret. Only
authenticated eligibility is enabled. Conversations, persistence, conversation
request signing, demo execution, inference, cleanup and shared-resource execution
remain disabled. AI needs no database, Redis or encryption keys in this mode.
Current Auth-state validation and signed identity assertions remain mandatory.
AI migration, seed and reconciliation are excluded from both workflows.

AI health is `/api/health`; readiness is `/api/ready`, with
`inferenceAvailable: false`. Existing ERP services remain independent of AI.
Gateway exposes documentation at `/api/v1/ai/docs` and `/api/v1/ai/docs-json`.

## Successful baseline and recovery

Change detection compares the latest completed successful `Deploy to Dev` push run
to the candidate DEV SHA, not `main` or merely the previous push. Its successful
Deploy job and `dev-deployment-state` image inventory must agree. Complete legacy
build/push/deploy evidence supports first adoption; otherwise an independently
verified `DEV_DEPLOYMENT_BOOTSTRAP_JSON` inventory is required. No trusted baseline
means no deployment, not a guessed full rebuild.

Shared-package/config filters remain unchanged. Missing AI in a legacy inventory
selects its first build. Unchanged services reuse only the successful inventory's
SHA-tagged references, never mutable `:dev` or partially written server env files.
SHA tags are not digest-level immutability; registry tag replacement remains a risk.

Failed, cancelled and in-progress runs never advance the baseline. The next run
includes missed changes from the last successful release. Reverted failed changes
restore successful images, not partially staged images. Stale reruns cannot deploy
after DEV HEAD advances. Before SSH, the planner rechecks that the successful
baseline has not advanced. Only a fully healthy completed application deployment
publishes a new inventory. Maintenance never publishes a baseline.

Runs are serialized with `cancel-in-progress: false`; assets are isolated by run ID
and attempt. Both workflows hold the same nonblocking host `flock`, including when
a cancelled SSH client leaves a remote script running.

## Read-only compatibility gate

Before application rollout, each candidate image's migration SQL catalog is compared
to its existing service-specific `_prisma_migrations` history. This includes reused
images. The checker overrides the entrypoint: application bootstrap does not run.
Transactions start `READ ONLY`, have bounded connection/pool/statement/lock and
transaction timeouts, and query only migration metadata. No tables are created.

| Service      | Required schema |
| ------------ | --------------- |
| Auth         | `w_auth`        |
| HR           | `hr`            |
| Notification | `notify`        |
| Reinsurance  | `reinsurance`   |
| Accounting   | `accounting`    |
| Marketing    | `marketing`     |
| Inventory    | `inventory`     |

Missing history, pending SQL, checksum mismatch, unresolved failures, duplicate
applied records or applied migrations absent from the candidate block rollout.
Rolled-back attempts remain intact and do not count as applied. A database ahead
of an older image conservatively blocks rollback pending compatibility review.
No automatic history rewriting, reset, restore or resolve is permitted.

Subscription currently imports no database runtime and has no migration directory;
the old ignored migration attempt is removed. A future Subscription migration
catalog blocks until database adoption is explicitly reviewed. AI is excluded.

This verifies migration history, not manual schema drift, all data incompatibilities
or SQL safety. Operators must still review SQL and backward compatibility. The base
DEV database URL must not already contain `schema`; generated service URLs require
exactly their correct schema and no `options` override. Invalid configuration fails
without printing URLs.

DEV Auth receives `AUTH_STARTUP_PERMISSION_BACKFILL_ENABLED=false`, skipping only
the global startup backfill. New-tenant/per-user baseline provisioning is unchanged.
Other environments retain previous behavior unless they explicitly set this switch.
Permission catalog changes now require reviewed maintenance rather than a restart.

## Explicit maintenance authorization

The default branch is `main`: a new `workflow_dispatch` file on `dev` alone would
not be dispatchable. Instead, an operator deliberately pushes a lightweight tag at
**current DEV HEAD** with one of these exact shapes:

```text
dev-maintenance-migrate-<service>-<completed-application-run-id>
dev-maintenance-seed-auth-service-<completed-application-run-id>
dev-maintenance-seed-hr-service-<completed-application-run-id>
```

Only the seven listed services may migrate, only Auth/HR may seed, and AI is never
supported. The referenced normal DEV run must be completed at the same commit with
successful Quality Gates and a successful build-and-push step for that service. A failed pending-migration gate
is valid build evidence; cancelled or unbuilt runs are not. There is no arbitrary
image, database, SQL or command input.

Before any upload/SSH, the workflow verifies `dev-maintenance` Environment metadata:

- Configured required human/team reviewers, prevention of self-review and no
  administrator bypass.
- Custom deployment policies containing only tag pattern `dev-maintenance-*`.
- Token permissions: `actions: read` for runs/jobs/Environment metadata,
  `contents: read` for checkout and `packages: read` for image pulls.
- Reviewers authorize the exact release, service, SQL/seed effects, existing state,
  compatibility and recovery point before approving the run.

Missing permissions, unsupported protection features or an unprotected auto-created
Environment block maintenance before SSH. An administrator must configure protection
and scope existing DEV credentials to this Environment separately. This PR does
not create settings or authorize maintenance. Required names: `DEV_SERVER_HOST`,
`DEV_SERVER_USER`, `DEV_SSH_KEY`, `DEV_DATABASE_URL`. Auth seed also requires
`SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`. Never put values in tags or source.

After independent authorization, from a verified checkout (replace the run ID):

```bash
git fetch origin
git tag dev-maintenance-migrate-auth-service-APPLICATION_RUN_ID origin/dev
git push origin dev-maintenance-migrate-auth-service-APPLICATION_RUN_ID
```

Migration and seed are separate requests/reviews. The runner uses the candidate's
installed Prisma CLI, never downloads a CLI, starts the application, rolls out
containers or advances deployment state. Existing service env files supply settings;
a mode-600 temporary file supplies the exact schema URL. Temporary connection and
output files are removed on exit. A read-only post-check verifies migration state.

## Data impact and recovery

No live DEV database evidence was collected for this patch. Actual pending history
and affected tenant/user data remain operator prerequisites. CI does not prove
shared migrations or seeds safe.

Auth seed upserts platform/demo tenants, resource catalogs/templates/system sets
and permissions. It can change the administrator password/status and reactivate
demo tenants. HR seed upserts demo departments/employees and links `w_auth` users.
These are not harmless health checks. Review current affected records read-only
and the exact seed source before approving each explicit operation.

For pending SQL: routine rollout stops; review histories, SQL and compatibility;
authorize maintenance; then rerun the normal application workflow at the same
current DEV SHA. If DEV advances, build/review the new release, not a stale image.

Failures stop maintenance. Successful DDL or partial seed writes are never undone
automatically after later failure. Inspect state read-only; obtain approval for a
forward fix or recovery. Never automatically retry a failed seed, reset, restore,
resolve or rewrite histories. Raw migration/seed output is not printed in Actions
because it may contain sensitive connection or row data; safe failure classes and
post-check results are reported. PROD is unaffected.

## Post-deployment acceptance

1. Verify successful run/inventory SHA and seven read-only history checks; confirm
   no migration/seed ran.
2. Check existing ERP health, frontend login, Gateway, internal AI health/readiness.
3. Log in normally; request `GET /api/v1/ai/eligibility` with the access cookie or
   Bearer token. Expect `{ "eligible": true, "inferenceAvailable": false }`.
4. Confirm unauthenticated, spoofed and Auth-rejected contexts fail closed, and
   careers sessions are rejected. Never fabricate trusted internal headers.
5. Confirm conversation creation remains disabled (503), no AI host port exists,
   and no AI database, Redis, keyring or external inference is used.
