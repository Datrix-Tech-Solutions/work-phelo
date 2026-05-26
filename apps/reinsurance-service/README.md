# Reinsurance Service

`reinsurance-service` is the bounded backend for broker-only Reinsurance
Operations. It is intentionally separate from HR and platform Core domains.

## Phase 1 Surface

The Phase 1 service foundation provides:

- Service bootstrapping on port `4007`.
- Runtime validation for `DATABASE_URL` and `JWT_SECRET`.
- Prisma migration ownership of PostgreSQL schema `reinsurance`.
- Database-readiness health endpoint at `/api/health` using a lightweight
  PostgreSQL connectivity check.
- Protected access verification endpoint at `/api/access/verify`.
- JWT, tenant module, tenant feature and resource-action guard foundations.

No counterparty, placement or email business endpoint exists in this phase.
`/api/health` performs only a database connectivity check and is exposed
through `/api/v1/operations/reinsurance/health` for deployment verification.
It does not expose tenant data. `/api/access/verify` is reachable through
`/api/v1/operations/reinsurance/access/verify` only with authenticated,
entitled and authorized tenant context.

## Boundary Rules

- Use authenticated tenant context for every future business query.
- Require `moduleConfig.operations`, `featureConfig.operations.reinsurance`
  and endpoint-specific `operations.reinsurance.*` actions for tenant-facing
  routes.
- Trust dynamic permission headers only when signed by the API gateway.
- Do not query Core service database schemas.
- Use Core notification and audit contracts instead of owning those records.
- Store broker workflow records only in the `reinsurance` schema.

## Development Deployment

The dev deployment builds and runs `reinsurance-service`, applies its Prisma
migrations, validates its runtime environment and checks direct and gateway
health reachability. Production activation is intentionally deferred until
the dev access verification step has been exercised with an entitled tenant.
Because no Reinsurance domain table exists yet, Prisma Client generation is
intentionally deferred until the first approved persisted model is added.

Detailed Reinsurance planning documentation is maintained internally/local-only
and is intentionally not tracked in Git.
