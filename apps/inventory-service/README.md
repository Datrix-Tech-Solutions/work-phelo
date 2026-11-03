# Inventory Operations - Core and Stock In

Port: `INVENTORY_SERVICE_PORT=4009`. Required: `JWT_SECRET` (same verification
secret as Auth/Gateway) and `DATABASE_URL` (service-owned `inventory` schema).
Public process health: `/api/health`; optional Swagger: `/api/docs`.

## API

External prefix: `/api/v1/operations/inventory`; service prefix: `/api`.

- `/categories`, `/units`, `/locations`: POST, GET; `/:id`: GET, PATCH, DELETE.
- `/items`: POST, GET; `/items/:id`: GET, PATCH (including status/reorder level).
- `/stock-in`: POST; `/stock-balances`, `/stock-movements`: GET.
- `/stock-out`, `/stock-transfers`: POST.
- DELETE returns 204; referenced categories, units and locations return 409.
- Lists are deterministic arrays with no search/pagination contract in this batch.
- Names/SKUs are trimmed, required and unique within the tenant (case-sensitive).

Business controllers require fresh signed Gateway context, enabled Operations and
the matching `operations.inventory.{categories|units|locations|items|stock-in|stock-out|transfers}`
grant. Actions are VIEW/CREATE/EDIT/DELETE; items have no DELETE endpoint and
stock-in, stock-out and transfers use CREATE/VIEW only. Balances require items:VIEW.
Shared movement history accepts any corresponding VIEW grant and returns only its
movement types; tenant/super admins retain existing all-types access in their tenant.
No new feature flag.
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

## Issues and Transfers

`POST /stock-out` accepts itemId, locationId, quantity, date, purpose, and optional
recipient/reference/notes. Purpose is required for EVERY issue in this first
implementation (until Jira defines conditional rules): INTERNAL_USE, SALE,
CONSUMPTION, PROJECT_USE, EMPLOYEE_ISSUE, DAMAGE or OTHER. Notes can describe OTHER;
there is no separate reason table or approval flow. Date is a required ISO date/time.

`POST /stock-transfers` accepts itemId, sourceLocationId, destinationLocationId,
quantity, date, and optional reference/notes. Locations must differ. Both operations
require an ACTIVE tenant-owned item and tenant-owned locations. Caller-supplied UOM,
creator, tenant, costs and transferId are rejected.

Item and source balance locks protect availability checks and balance mutations.
Missing or insufficient stock returns 409 with no movement or quantity change.
An issue creates one STOCK_OUT movement and decrements its balance transactionally.
A transfer decrements source, upserts/increments destination, and records
TRANSFER_OUT + TRANSFER_IN sharing a server-generated transferId in one transaction.
Any failure rolls back all writes. Company-wide quantity is conserved on transfer.

Movement quantities stay positive; type encodes direction. New movements capture
the item's configured unit and keep unitCost/totalCost null: no valuation or posting.
Stock In's existing dateReceived field and cost behavior are unchanged.

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
Accounting posting, valuation methods (FIFO/LIFO/average), adjustments, alerts,
scheduled jobs and frontend work remain deferred. Transfers never post to Accounting.
