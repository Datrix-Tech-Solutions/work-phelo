# Reinsurance Service

`reinsurance-service` is the bounded backend for broker-only Reinsurance
Operations. It is intentionally separate from HR and platform Core domains.

## Scaffold Surface

The current scaffold provides:

- Service bootstrapping on port `4007`.
- Runtime validation for `DATABASE_URL`.
- Prisma migration ownership of PostgreSQL schema `reinsurance`.
- Liveness endpoint at `/api/health`.

Business endpoints, email providers, notification publishing and audit
publishing will be implemented only after their contracts are reviewed.
The Prisma client and database-readiness health probe will be introduced with
the first approved persisted domain model rather than a placeholder table.
`/api/health` is intended for internal container/deployment liveness checks,
not as evidence that business persistence is ready.

## Boundary Rules

- Use authenticated tenant context for every future business query.
- Do not expose business endpoints until trusted Core tenant entitlement and
  resource-permission checks are enforced in this service.
- Do not query Core service database schemas.
- Use Core notification and audit contracts instead of owning those records.
- Store broker workflow records only in the `reinsurance` schema.

See [../../docs/reinsurance-operations.md](../../docs/reinsurance-operations.md)
for the MVP decision record and implementation plan.
