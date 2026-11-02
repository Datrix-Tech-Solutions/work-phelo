# Inventory Operations - Core and Stock In

Port: `INVENTORY_SERVICE_PORT=4009`. Required: `JWT_SECRET` (same verification
secret as Auth/Gateway) and `DATABASE_URL` (service-owned `inventory` schema).
Public process health: `/api/health`; optional Swagger: `/api/docs`.

## API

External prefix: `/api/v1/operations/inventory`; service prefix: `/api`.

- `/categories`, `/units`, `/locations`: POST, GET; `/:id`: GET, PATCH, DELETE.
- `/items`: POST, GET; `/items/:id`: GET, PATCH (including status/reorder level).
- `/stock-in`: POST; `/stock-balances`, `/stock-movements`: GET.
- DELETE returns 204; referenced categories, units and locations return 409.
- Lists are deterministic arrays with no search/pagination contract in this batch.
- Names/SKUs are trimmed, required and unique within the tenant (case-sensitive).

Business controllers require fresh signed Gateway context, enabled Operations and
the matching `operations.inventory.{categories|units|locations|items|stock-in}`
grant. Actions are VIEW/CREATE/EDIT/DELETE; items have no DELETE endpoint and
stock-in uses CREATE/VIEW only. Balances require items:VIEW. No new feature flag.
Tenant and creator are derived from verified context, never request payloads.

## Receipts

Stock In locks the tenant-owned item, validates ACTIVE status and tenant location,
creates the movement and atomically increments/upserts its location balance in one
transaction. Decimal quantities/prices support 14 integer and 4 fractional digits;
send strings to avoid client-side floating-point loss. Numeric JSON inputs are also
accepted within those limits. Quantity must be positive; prices/reorder non-negative.

`totalCost = quantity * unitCost` uses a local 40-digit Decimal context and is stored
at Decimal(36,8). Omitted/null unitCost produces null totalCost, not a default price.
The movement captures the configured item unit; callers cannot override it. Item
unit changes after a balance exists return 409 because conversion is out of scope.
`isLowStock` is derived per location using <=; null means no reorder level configured.

No idempotency key is defined in these stories: repeated successful POSTs record
distinct receipts; clients must not blindly retry an ambiguous successful request.

## Validation

```bash
npm ci
npm run build --workspace=packages/types --workspace=packages/config --workspace=packages/internal-auth
npm run db:generate --workspace=apps/inventory-service
npm run check-types --workspace=apps/inventory-service
npm run lint --workspace=apps/inventory-service
npm test --workspace=apps/inventory-service -- --runInBand
npm run build --workspace=apps/inventory-service
```

Database acceptance tests additionally require an explicit disposable localhost
`INVENTORY_TEST_DATABASE_URL`, database name `inventory_test`, with the migration
applied. Never use DEV/PROD URLs for these tests.

DEV deployment configuration is prepared; no deployment/migration against shared
environments is performed here. PROD activation is separate. No RabbitMQ or Redis.
Accounting posting, valuation methods (FIFO/LIFO/average), stock-out/transfers,
adjustments, alerts, scheduled jobs and frontend work remain deferred.
