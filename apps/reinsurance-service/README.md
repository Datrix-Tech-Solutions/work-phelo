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
- Development-only Swagger/OpenAPI documentation for live contract discovery.

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

## OpenAPI Documentation

Swagger is enabled only when `ENABLE_SWAGGER=true`. The dev deployment writes
that flag for the gateway and Reinsurance service; production does not.

| Access path          | URL                                                        |
| -------------------- | ---------------------------------------------------------- |
| Direct local service | `http://localhost:4007/api/docs`                           |
| Local gateway        | `http://localhost:4000/api/v1/operations/reinsurance/docs` |
| Dev gateway          | `/api/v1/operations/reinsurance/docs`                      |

The Swagger UI exposes both a gateway server and a direct-service server.
Select the gateway server when testing browser-facing integration. Protected
endpoints accept the HTTP-only `access_token` cookie established by login, or
a Bearer token for API tooling. Documentation routes and their assets are
public through the gateway only when `ENABLE_SWAGGER=true`; the dev deployment
sets that flag and the production deployment does not. For local development,
set `ENABLE_SWAGGER=true` in both `apps/reinsurance-service/.env` and
`apps/api-gateway/.env`.

## Frontend Integration Handoff

The Next.js application should call only the gateway surface:

```ts
const COUNTERPARTIES_PATH = '/operations/reinsurance/counterparties';
```

The existing Axios instance in `apps/web/work-phelo-web/src/lib/api.ts`
already uses `baseURL: '/api/v1'` and `withCredentials: true`, so the
HTTP-only access cookie is sent automatically. Do not read or store tokens in
frontend code.

### Authorization Flow

A tenant user can use Counterparties only when all of the following are true:

- The tenant has `moduleConfig.operations` enabled.
- The tenant has `featureConfig.operations.reinsurance` enabled.
- The user has the relevant action permission:
  `operations.reinsurance.counterparties:VIEW`, `CREATE`, `EDIT` or `DELETE`.

Frontend handling expectations:

| HTTP status | Meaning                                          | UI behavior                                       |
| ----------- | ------------------------------------------------ | ------------------------------------------------- |
| `401`       | Session is missing or expired                    | Let the shared refresh/login flow handle it       |
| `403`       | Entitlement or permission is unavailable         | Show access-denied state; hide disallowed actions |
| `404`       | Record is absent, archived or outside the tenant | Return to list or show unavailable record         |
| `409`       | Active type/name combination already exists      | Show field-level duplicate feedback               |

### Contract Examples

List active records:

```http
GET /api/v1/operations/reinsurance/counterparties?search=ghana&type=REINSURER&page=1&limit=20
```

```ts
type CounterpartyType = 'CEDANT' | 'REINSURER' | 'BROKER';

interface CounterpartiesResponse {
  items: Counterparty[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
```

Create payload:

```json
{
  "type": "CEDANT",
  "name": "Acme Insurance Ltd",
  "registrationNumber": "C-00123",
  "email": "operations@acme.example",
  "contacts": [
    {
      "fullName": "Ama Mensah",
      "jobTitle": "Treaty Manager",
      "email": "ama@example.com",
      "isPrimary": true
    }
  ],
  "addresses": [
    {
      "label": "Head Office",
      "line1": "1 Independence Avenue",
      "city": "Accra",
      "country": "GH",
      "isPrimary": true
    }
  ]
}
```

`POST` and `PATCH` return the stored counterparty including nested
`contacts` and `addresses`. `DELETE /counterparties/:id` soft-archives and
returns the archived record; archived records are excluded from regular list
and detail requests. A `PATCH` request that includes `contacts` or `addresses`
replaces that entire child collection, so edit forms should submit the full
current collection or omit that property.

### Recommended React Query Shape

Use an Operations-specific API/type/hooks boundary rather than placing new
domain calls in HR hooks:

```text
src/
├── hooks/operations/reinsurance/useCounterparties.ts
├── lib/operations/reinsurance/counterparties-api.ts
├── types/operations/reinsurance.ts
└── app/[tenantSlug]/operations/reinsurance/counterparties/
```

Recommended query keys and mutations:

```ts
const counterpartyKeys = {
  all: ['operations', 'reinsurance', 'counterparties'] as const,
  list: (params: CounterpartyQuery) =>
    [...counterpartyKeys.all, 'list', params] as const,
  detail: (id: string) => [...counterpartyKeys.all, 'detail', id] as const,
};
```

- Use `useQuery` for paginated/searchable lists and individual detail pages.
- Debounce search input before updating query parameters.
- Use `useMutation` for create, update and archive, then invalidate list and
  affected detail keys after success.
- Prefer refetch/invalidation over optimistic archive or child replacement
  until the UI is stable; replacement semantics make optimistic rollback
  unnecessarily fragile for the MVP.
- Render an archive confirmation dialog instead of a destructive-delete label.

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
