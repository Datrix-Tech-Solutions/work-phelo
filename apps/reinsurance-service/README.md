# Reinsurance Service

`reinsurance-service` is the bounded backend for broker-only Reinsurance
Operations. It is intentionally separate from HR and platform Core domains.

## Current Surface

The service foundation and Counterparties domain provide:

- Service bootstrapping on port `4007`.
- Runtime validation for `DATABASE_URL`, `JWT_SECRET` and `RABBITMQ_URL`.
- Prisma migration ownership of PostgreSQL schema `reinsurance`.
- Database-readiness health endpoint at `/api/health` using a lightweight
  PostgreSQL connectivity check.
- Protected access verification endpoint at `/api/access/verify`.
- JWT, tenant module, tenant feature and resource-action guard foundations.
- Tenant-scoped Counterparty, CounterpartyContact and CounterpartyAddress
  persistence for cedants, reinsurers and brokers.

`/api/health` performs only a database connectivity check and is exposed
through `/api/v1/operations/reinsurance/health` for deployment verification.
It does not expose tenant data. `/api/access/verify` is reachable through
`/api/v1/operations/reinsurance/access/verify` only with authenticated,
entitled and authorized tenant context.

## Counterparties API

The gateway forwards these routes under
`/api/v1/operations/reinsurance/counterparties`:

| Method   | Service route             | Permission                                     |
| -------- | ------------------------- | ---------------------------------------------- |
| `GET`    | `/api/counterparties`     | `operations.reinsurance.counterparties:VIEW`   |
| `POST`   | `/api/counterparties`     | `operations.reinsurance.counterparties:CREATE` |
| `GET`    | `/api/counterparties/:id` | `operations.reinsurance.counterparties:VIEW`   |
| `PATCH`  | `/api/counterparties/:id` | `operations.reinsurance.counterparties:EDIT`   |
| `DELETE` | `/api/counterparties/:id` | `operations.reinsurance.counterparties:DELETE` |

List requests support `search`, `type`, `page` and `limit`. Deletion is a
soft archive. Every record lookup and mutation is scoped by authenticated
`tenantId`; the service does not accept tenant ownership from request bodies.
When a `PATCH` body supplies `contacts` or `addresses`, the supplied child
collection replaces the stored collection within the same tenant-scoped
parent update.

## Boundary Rules

- Use authenticated tenant context for every business query.
- Require `moduleConfig.operations`, `featureConfig.operations.reinsurance`
  and endpoint-specific `operations.reinsurance.*` actions for tenant-facing
  routes.
- Trust dynamic permission headers only when signed by the API gateway.
- Do not query Core service database schemas.
- Use Core notification and audit contracts instead of owning those records.
- Store broker workflow records only in the `reinsurance` schema.
- Publish `reinsurance.counterparty.*` lifecycle events to Auth for central
  audit persistence; event failure is logged after a successful domain write.

## Development Deployment

The dev deployment builds and runs `reinsurance-service`, applies its Prisma
migrations, validates its runtime environment and checks direct and gateway
health reachability. Production activation is intentionally deferred until
the dev access verification step has been exercised with an entitled tenant.
Prisma Client generation now runs before builds, type checks, linting and
tests because Counterparties is the first persisted Reinsurance domain.

Detailed Reinsurance planning documentation is maintained internally/local-only
and is intentionally not tracked in Git.
