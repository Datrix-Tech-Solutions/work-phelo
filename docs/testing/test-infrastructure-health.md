# Test Infrastructure Health

Status: Draft 1

Scope: Accounting and Reinsurance service Jest infrastructure.

## Current Testing Architecture

- Accounting service tests are primarily unit tests that instantiate services
  directly with mocked Prisma delegates and mocked collaborators.
- Reinsurance service tests follow the same pattern for most domain services,
  with mocked Prisma delegates and mocked integration providers.
- Current Accounting tests do not create Nest application instances, HTTP
  listeners, real Prisma clients, Redis clients, RabbitMQ connections, queues,
  cron jobs or polling loops.
- `prisma generate` runs before test, lint, typecheck and build scripts through
  workspace package lifecycle scripts.

## Investigation

Diagnostics run:

- Accounting: `jest --runInBand --detectOpenHandles`
- Reinsurance: `jest --runInBand --detectOpenHandles`
- Accounting: normal parallel `jest`
- Accounting: bounded parallel `jest --maxWorkers=50%`
- Repository searches for Nest app creation, real Prisma clients, timers,
  event emitters, HTTP listeners, RabbitMQ, Redis and queue/worker resources.

Findings:

- `--detectOpenHandles` reported no open handles for Accounting.
- `--detectOpenHandles` reported no open handles for Reinsurance.
- The Accounting warning reproduced only with the default unconstrained Jest
  worker pool.
- The Accounting suite exited cleanly with `--maxWorkers=50%`.
- No Accounting test currently opens a real external resource.
- Two Accounting test hygiene gaps were found:
  - `internal-service-auth.guard.spec.ts` restored environment variables only
    once at file end.
  - `swagger.config.spec.ts` created Jest spies without restoring them.

## Root Cause

No persistent application socket, timer, Prisma client, HTTP server, Redis
client, RabbitMQ connection or WorkPhelo worker queue was detected.

The reproducible handle type was Jest's child worker process under the default
parallel `ts-jest` worker pool. The suite did not expose an app-level resource
handle under `--detectOpenHandles`, but unconstrained parallel workers were slow
to exit and Jest reported the worker as force-exited.

The actionable root causes were:

- unbounded Jest worker concurrency for a small TypeScript-transformed service
  suite.
- test-global cleanup hygiene gaps that could make worker teardown less
  deterministic and mask future leaks.

## Fix Applied

- Environment variables in `internal-service-auth.guard.spec.ts` are restored
  after each test.
- Swagger module spies in `swagger.config.spec.ts` are restored after each test.
- Accounting service `npm test` now uses `jest --maxWorkers=50%` to keep worker
  teardown deterministic without `--forceExit` or suppressing open-handle
  diagnostics.

## Resources Explicitly Closed Or Restored

| Resource                   | Current Handling                                                                                                                          |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Nest application instances | None created by current Accounting/Reinsurance unit suites. Integration tests must call `await app.close()`.                              |
| Prisma clients             | Current unit tests use mocks. Tests that instantiate `PrismaService` must call `await prisma.$disconnect()` or close the Nest module/app. |
| HTTP servers               | None created by current suites. Tests that call `listen()` must close the returned server/app.                                            |
| Redis/RabbitMQ/queues      | None opened by current Accounting suites. Reinsurance publisher tests use mocks. Real connections must be closed in `afterAll`.           |
| Timers                     | No Accounting timers found. Tests using fake timers must restore real timers in `afterEach`.                                              |
| Jest spies/mocks           | Swagger spies are now restored after each test.                                                                                           |
| Environment variables      | Internal service-auth env overrides are now restored after each test.                                                                     |
| Jest child workers         | Accounting tests use a bounded worker pool to avoid ts-jest worker teardown pressure.                                                     |

## Best Practices For Future Tests

- Prefer direct service construction with mocked dependencies for domain unit
  tests.
- If a test creates a Nest testing module, call `await moduleRef.close()` in
  `afterAll` or `afterEach`.
- If a test creates a Nest app, call `await app.close()`.
- If a test creates a real Prisma client, call `await prisma.$disconnect()`.
- If a test starts a queue, worker, HTTP server, Redis client, RabbitMQ
  connection or stream, close it explicitly.
- Restore `process.env` after each test that mutates it.
- Restore Jest spies and fake timers after each test.
- Use `jest --runInBand --detectOpenHandles` before adding `--forceExit` or
  changing Jest worker settings. Do not hide leaks.

## Integration Test Checklist

- Does the test instantiate a Nest module or app?
- Does the test create a real Prisma client?
- Does the test call `listen()`, `connectMicroservice()` or
  `startAllMicroservices()`?
- Does the test open Redis, RabbitMQ, S3 streams, queues or workers?
- Does the test start timers or cron jobs?
- Does the test spy on global/static functions?
- Does the test mutate `process.env`?
- Is every opened or mutated resource closed/restored in `afterEach` or
  `afterAll`?
