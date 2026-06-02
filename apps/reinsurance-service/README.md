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
- Tenant-scoped facultative Placement, PlacementParticipant and
  PlacementStatusHistory persistence built on active Counterparties.
- Email technical foundation for mailbox connection metadata, provider
  verification, sync proof-of-concept, thread/message metadata, attachment
  metadata and manual placement email links.
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

List requests support `search`, `type`, `origin`, `country`, `page` and
`limit`. Deletion is a soft archive. Every record lookup and mutation is
scoped by authenticated `tenantId`; the service does not accept tenant
ownership from request bodies. Counterparties default to `LOCAL`. `FOREIGN`
counterparties require a two-letter ISO-style `country` code, normalized to
uppercase. When a `PATCH` body supplies `contacts` or `addresses`, the
supplied child collection replaces the stored collection within the same
tenant-scoped parent update.

## Placements API

The gateway forwards these routes under
`/api/v1/operations/reinsurance/placements`:

| Method   | Service route                | Permission                                 |
| -------- | ---------------------------- | ------------------------------------------ |
| `GET`    | `/api/placements`            | `operations.reinsurance.placements:VIEW`   |
| `POST`   | `/api/placements`            | `operations.reinsurance.placements:CREATE` |
| `GET`    | `/api/placements/:id`        | `operations.reinsurance.placements:VIEW`   |
| `PATCH`  | `/api/placements/:id`        | `operations.reinsurance.placements:EDIT`   |
| `PATCH`  | `/api/placements/:id/status` | `operations.reinsurance.placements:EDIT`   |
| `DELETE` | `/api/placements/:id`        | `operations.reinsurance.placements:DELETE` |

List requests support `search`, `status`, `placementType`, `cedantId`, `page`
and `limit`. Deletion is a soft archive. Every lookup and mutation is scoped
by the authenticated `tenantId`; request bodies cannot choose tenant ownership.

Placements currently support the broker-only facultative lifecycle foundation:

```text
DRAFT -> MARKETING -> QUOTED -> BOUND
                   -> DECLINED
                   -> CANCELLED
```

`DECLINED` can return to `MARKETING`; `BOUND` and `CANCELLED` are terminal in
the MVP foundation. Status changes are recorded in `PlacementStatusHistory`.
`BOUND` and `CANCELLED` placements cannot be edited through the header/market
participant update endpoint. `BOUND` placements also cannot be archived.
When a `PATCH /placements/:id` body supplies `participants`, the supplied
array replaces the complete stored participant collection. Omit
`participants` when editing only placement header fields.

Capacity validation is intentionally conservative for Sprint 1:

- Individual `signedLinePercent` cannot exceed that participant's
  `sharePercent` when both are supplied.
- Total `sharePercent` cannot exceed `100`.
- Total `signedLinePercent` cannot exceed `100`.
- Cedants are linked through the placement `cedantId`; they are not allowed in
  the market participant collection.

Participant role validation is tied to Counterparty type:

| Participant role                              | Required counterparty type |
| --------------------------------------------- | -------------------------- |
| `BROKER`                                      | `BROKER`                   |
| `REINSURER`, `LEAD_REINSURER`, `CO_REINSURER` | `REINSURER`                |

## Risk Settings API

Frontend integrations should use the explicit Risk Class and Risk Type routes:

```text
GET    /api/v1/operations/reinsurance/risk-classes
POST   /api/v1/operations/reinsurance/risk-classes
GET    /api/v1/operations/reinsurance/risk-classes/:id
PATCH  /api/v1/operations/reinsurance/risk-classes/:id
DELETE /api/v1/operations/reinsurance/risk-classes/:id

GET    /api/v1/operations/reinsurance/settings/risk-types
POST   /api/v1/operations/reinsurance/settings/risk-types
GET    /api/v1/operations/reinsurance/settings/risk-types/:id
PATCH  /api/v1/operations/reinsurance/settings/risk-types/:id
DELETE /api/v1/operations/reinsurance/settings/risk-types/:id

POST   /api/v1/operations/reinsurance/settings/risk-types/:id/fields
PATCH  /api/v1/operations/reinsurance/settings/risk-types/:id/fields/:fieldId
DELETE /api/v1/operations/reinsurance/settings/risk-types/:id/fields/:fieldId
GET    /api/v1/operations/reinsurance/settings/risk-types/:id/form-schema
```

The storage model has moved from BusinessClass/BusinessClassField to
RiskClass/RiskType/RiskTypeField. Frontend integrations should use the explicit
Risk Class and Risk Type routes listed above.

Recommended setup flow:

1. Create a risk class with `POST /risk-classes`.
2. Create one or more risk types with `POST /settings/risk-types`.
3. Add dynamic fields with `POST /settings/risk-types/:riskTypeId/fields`.
4. Fetch the dynamic form schema with
   `GET /settings/risk-types/:riskTypeId/form-schema`.
5. Create placements with `riskTypeId` plus `businessDetails` and
   `offerDetails`.

Example create risk class payload:

```json
{
  "name": "Marine",
  "description": "Marine insurance risks",
  "isActive": true,
  "displayOrder": 0
}
```

Example create risk type payload:

```json
{
  "riskClassId": "5af43f8f-ec68-41c4-9096-1a89c9fcb23b",
  "name": "Marine Cargo",
  "description": "Cargo transported by sea",
  "isActive": true,
  "displayOrder": 0
}
```

Example create risk type field payload:

```json
{
  "section": "BUSINESS_DETAILS",
  "fieldKey": "vessel_name",
  "label": "Vessel Name",
  "fieldType": "TEXT",
  "required": true,
  "placeholder": "e.g. MV Ocean Pioneer",
  "displayOrder": 0,
  "isActive": true
}
```

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

### Counterparty Contract Examples

List active records:

```http
GET /api/v1/operations/reinsurance/counterparties?search=ghana&type=REINSURER&origin=FOREIGN&country=NG&page=1&limit=20
```

```ts
type CounterpartyType = 'CEDANT' | 'REINSURER' | 'BROKER';
type CounterpartyOrigin = 'LOCAL' | 'FOREIGN';

interface CounterpartiesResponse {
  items: Counterparty[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
```

Create payload:

```json
{
  "type": "CEDANT",
  "origin": "LOCAL",
  "name": "Acme Insurance Ltd",
  "registrationNumber": "C-00123",
  "taxId": "TIN-0042024",
  "licenseNumber": "NIC/2024/001",
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

For foreign counterparties, include `country`:

```json
{
  "type": "REINSURER",
  "origin": "FOREIGN",
  "name": "Continental Re Nigeria",
  "country": "NG",
  "licenseNumber": "NAICOM/2024/001"
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

### Placement Contract Examples

List active placements:

```http
GET /api/v1/operations/reinsurance/placements?search=FAC-2026&status=MARKETING&placementType=FACULTATIVE&page=1&limit=20
```

Create payload:

```json
{
  "reference": "FAC-2026-0001",
  "title": "Acme Energy Facultative Placement",
  "cedantId": "7c2d7cae-1dd2-4a7c-9332-4a23f2e1b9a9",
  "riskTypeId": "5f28e76c-35b0-4bf2-95e3-7cf143feef15",
  "businessDetails": {
    "projectType": "Offshore drilling",
    "equipmentValue": 12000000,
    "contractorDetails": "Kente Engineering Ltd"
  },
  "offerDetails": {
    "offeredShare": 45,
    "proposedRate": 12.5,
    "leader": "Acme Re"
  },
  "inceptionDate": "2026-06-01T00:00:00.000Z",
  "expiryDate": "2027-05-31T23:59:59.000Z",
  "currency": "USD",
  "sumInsured": 5000000,
  "participants": [
    {
      "counterpartyId": "2ee7957a-5a47-472b-95d1-983c2d86be16",
      "role": "LEAD_REINSURER",
      "sharePercent": 45
    }
  ]
}
```

Change status:

```http
PATCH /api/v1/operations/reinsurance/placements/:id/status
```

```json
{
  "status": "MARKETING",
  "note": "Submitted to selected markets."
}
```

Decimal values such as `sumInsured`, `sharePercent` and
`signedLinePercent` are accepted as numbers in requests and are returned by
Prisma as JSON strings. Frontend types should model them as `string | null`
on responses and convert only at display/form boundaries.

Placement fields are split into:

- Fixed fields: `cedantId`, `placementType`, `riskTypeId`, `classOfBusiness`, `status`,
  `currency`, `sumInsured`, `inceptionDate`, `expiryDate`, `participants`.
- Dynamic fields: `businessDetails` and `offerDetails` (JSON objects) that are
  driven by `riskTypeId` and should be rendered from the risk type form schema.
  When `riskTypeId` is supplied, the backend validates these JSON keys against
  active RiskTypeField definitions and denormalizes `classOfBusiness` from the
  selected RiskType name.

Recommended placement frontend structure:

```text
src/
├── hooks/operations/reinsurance/usePlacements.ts
├── lib/operations/reinsurance/placements-api.ts
├── types/operations/reinsurance.ts
└── app/[tenantSlug]/operations/reinsurance/placements/
```

Use placement query keys parallel to Counterparties:

```ts
const placementKeys = {
  all: ['operations', 'reinsurance', 'placements'] as const,
  list: (params: PlacementQuery) =>
    [...placementKeys.all, 'list', params] as const,
  detail: (id: string) => [...placementKeys.all, 'detail', id] as const,
};
```

Prefer mutation success invalidation over optimistic updates for the first UI
pass because participant replacement and status history make optimistic
rollback more complex than the MVP needs.

Current frontend note: the initial Facultative UI uses placeholder labels like
`Pending`, `Active`, `Expired` and `Cancelled`. When wiring it to this API,
use the backend lifecycle statuses directly in API calls and map labels in the
view layer, for example `DRAFT`/`MARKETING`/`QUOTED` as work-in-progress,
`BOUND` as active, `DECLINED` as declined and `CANCELLED` as cancelled.
The backend does not expose split `/cedants`, `/reinsurers` or `/brokers`
placement endpoints; retrieve those through `/counterparties?type=...`.

Frontend mapping guidance:

- Use `GET /settings/risk-types/:riskTypeId/form-schema` to render
  class-specific `businessDetails` and `offerDetails` sections.
- Submit the values from those dynamic sections under `businessDetails` and
  `offerDetails` respectively, together with the selected `riskTypeId`.
- Keep search/reportable fields in fixed columns; do not push UI labels into
  backend status enums.

## Email Foundation API

This phase establishes the technical base for embedded Reinsurance mailbox
workflows. It is intentionally not the full email workflow MVP yet.

Implemented now:

- Mailbox connection metadata and encrypted OAuth token storage.
- Microsoft Graph provider abstraction and connection verification.
- Manual sync proof-of-concept for recent message metadata.
- Email threads, messages and attachment metadata persistence.
- Manual placement-to-thread/message links.

Deferred:

- Sending, replying and forwarding.
- Attachment file downloads.
- AI parsing or OCR.
- Automatic placement/counterparty updates.
- Webhook subscriptions and background schedulers.

Microsoft Graph is the recommended first production provider because most
broker operations teams use Outlook/Exchange and Graph gives clean OAuth,
thread/message metadata and attachment metadata APIs. Gmail remains reserved
in the enum for future provider support but is not enabled yet.

Mailbox token encryption uses `REINSURANCE_MAILBOX_TOKEN_ENCRYPTION_KEY`.
This variable is not required for service boot, but it is required before any
mailbox token can be stored or decrypted. Use a 32-byte key encoded as 64 hex
characters or base64. Never expose encrypted tokens through API responses.

The gateway forwards these routes:

| Method   | Gateway route                                                                         | Permission                                   |
| -------- | ------------------------------------------------------------------------------------- | -------------------------------------------- |
| `GET`    | `/api/v1/operations/reinsurance/email/mailboxes`                                      | `operations.reinsurance.email-settings:VIEW` |
| `POST`   | `/api/v1/operations/reinsurance/email/mailboxes/connect`                              | `operations.reinsurance.email-settings:EDIT` |
| `POST`   | `/api/v1/operations/reinsurance/email/mailboxes/:id/verify`                           | `operations.reinsurance.email-settings:EDIT` |
| `POST`   | `/api/v1/operations/reinsurance/email/mailboxes/:id/sync`                             | `operations.reinsurance.email-settings:EDIT` |
| `DELETE` | `/api/v1/operations/reinsurance/email/mailboxes/:id`                                  | `operations.reinsurance.email-settings:EDIT` |
| `GET`    | `/api/v1/operations/reinsurance/email/threads`                                        | `operations.reinsurance.email:VIEW`          |
| `GET`    | `/api/v1/operations/reinsurance/email/threads/:id`                                    | `operations.reinsurance.email:VIEW`          |
| `GET`    | `/api/v1/operations/reinsurance/email/messages`                                       | `operations.reinsurance.email:VIEW`          |
| `POST`   | `/api/v1/operations/reinsurance/email/threads/:threadId/placements/:placementId/link` | `operations.reinsurance.email:EDIT`          |
| `DELETE` | `/api/v1/operations/reinsurance/email/links/:id`                                      | `operations.reinsurance.email:EDIT`          |

Connect payload:

```json
{
  "provider": "MICROSOFT_GRAPH",
  "emailAddress": "placements@broker.example",
  "displayName": "Reinsurance Placements",
  "accessToken": "oauth-access-token",
  "refreshToken": "oauth-refresh-token",
  "tokenExpiresAt": "2026-05-28T12:00:00.000Z"
}
```

The access and refresh tokens are write-only inputs. Responses return mailbox
metadata only. `sync` stores provider message metadata and attachment metadata
only; it does not download attachment content.

Email frontend integration should follow the same route/key style as
Counterparties and Placements:

```text
src/
├── hooks/operations/reinsurance/useEmail.ts
├── lib/operations/reinsurance/email-api.ts
├── types/operations/reinsurance-email.ts
└── app/[tenantSlug]/operations/reinsurance/email/
```

Recommended query keys:

```ts
const emailKeys = {
  all: ['operations', 'reinsurance', 'email'] as const,
  mailboxes: (params: MailboxQuery) =>
    [...emailKeys.all, 'mailboxes', params] as const,
  threads: (params: EmailThreadQuery) =>
    [...emailKeys.all, 'threads', params] as const,
  messages: (params: EmailMessageQuery) =>
    [...emailKeys.all, 'messages', params] as const,
};
```

Prefer refetch/invalidation after mailbox sync and manual link mutations.
Avoid optimistic updates for sync because provider state and local persistence
can diverge during the foundation phase.

## Boundary Rules

- Use authenticated tenant context for every business query.
- Require `moduleConfig.operations`, `featureConfig.operations.reinsurance`
  and endpoint-specific `operations.reinsurance.*` actions for tenant-facing
  routes.
- Trust dynamic permission headers only when signed by the API gateway.
- Do not query Core service database schemas.
- Use Core notification and audit contracts instead of owning those records.
- Store broker workflow records only in the `reinsurance` schema.
- Publish `reinsurance.counterparty.*`, `reinsurance.placement.*` and
  `reinsurance.email.*` lifecycle events to Auth for central audit
  persistence; event failure is logged after a successful domain write.

## Development Deployment

The dev deployment builds and runs `reinsurance-service`, applies its Prisma
migrations, validates its runtime environment and checks direct and gateway
health reachability. Production activation is intentionally deferred until
the dev access verification step has been exercised with an entitled tenant.
Prisma Client generation now runs before builds, type checks, linting and
tests because Counterparties is the first persisted Reinsurance domain.

Detailed Reinsurance planning documentation is maintained internally/local-only
and is intentionally not tracked in Git.
