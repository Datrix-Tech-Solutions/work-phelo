# Inventory Operations - Stock Movements and Balances

Port: `INVENTORY_SERVICE_PORT=4009`. Required: `JWT_SECRET` (same verification
secret as Auth/Gateway) and `DATABASE_URL` (service-owned `inventory` schema).
Public process health: `/api/health`; optional Swagger: `/api/docs`.

## API

External prefix: `/api/v1/operations/inventory`; service prefix: `/api`.

- `/categories`, `/units`, `/locations`: POST, GET; `/:id`: GET, PATCH, DELETE.
- `/items`: POST, GET; `/items/:id`: GET, PATCH (including status/reorder level).
- `/stock-in`: POST; `/stock-balances`, `/stock-movements`: GET.
- `/stock-out`, `/stock-transfers`, `/stock-adjustments`: POST.
- DELETE returns 204; referenced categories, units and locations return 409.
- Lists are deterministic arrays with no search/pagination contract in this batch.
- Names/SKUs are trimmed, required and unique within the tenant (case-sensitive).

Business controllers require fresh signed Gateway context, enabled Operations and
the matching `operations.inventory.{categories|units|locations|items|stock-in|stock-out|transfers|adjustments}`
grant. Actions are VIEW/CREATE/EDIT/DELETE; items have no DELETE endpoint and
stock-in, stock-out, transfers and adjustments use CREATE/VIEW only. Balances require items:VIEW.
Shared movement history accepts any corresponding VIEW grant and returns only its
movement types; tenant/super admins retain existing all-types access in their tenant.
No new feature flag.
Tenant and creator are derived from verified context, never request payloads.

## Settings Contracts

Categories accept name, nullable description (max 4000), nullable icon key (max 100)
and optional ACTIVE/INACTIVE status. Icons are strings, not a React-specific enum.
Category list/detail responses derive itemCount from the item relation.

Units accept name, symbol (1-10 trimmed characters), nullable description (max 4000)
and optional status. Symbols need not be unique. Locations accept name, code (1-50
trimmed uppercase characters, unique per tenant), nullable address (max 4000),
optional type and status. New locations default to WAREHOUSE when type is omitted;
PATCH never resets an omitted type. All configuration statuses default to ACTIVE.
Locations list/detail derive itemCount from balance rows: one row per distinct
item/location, including zero-quantity rows. stockValue is unsupported until an
approved valuation contract exists; clients should render unavailable, not zero.

Compatibility: existing name-only unit and name/type location API requests remain
valid. New UI integrations should always send the chosen symbol/code. Omission on
create generates an identifier-based placeholder (unit: first 10 ID characters;
location: LOC-<uppercase full UUID>); omission on PATCH preserves current values.
Empty/null supplied symbol/code/type/status is rejected. The migration backfills
legacy unit symbols from IDs and unique LEGACY-<ordinal> codes per tenant without
changing names, item relationships, movements or balances. No unit conversions.

Inactive categories/units remain readable and cannot be newly assigned to items.
Existing items stay valid; PATCH retaining the same category/unit is allowed, but
switching to an inactive configuration is not. Inactive locations remain readable
with their history and balances; all new receipts, issues, transfer source/destination
activity and adjustments at them return 409. No automatic record changes occur.
Referenced configuration deletion remains restrictive (409); no cascade deletes.
After configuration writes, refresh the list/detail endpoint for derived counts.

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
`isLowStock` is derived per location using <=; false means not low or no reorder level configured.

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

## Adjustments and Stock Status

`POST /stock-adjustments` accepts itemId, locationId, type (INCREASE or DECREASE),
positive quantity, required reason, date, and optional reference/notes. Reasons:
DAMAGE, LOSS, THEFT, PHYSICAL_COUNT_DIFFERENCE, DATA_CORRECTION, EXPIRED_GOODS, OTHER.
The item's configured UOM remains authoritative; tenant/creator/UOM/cost overrides
are rejected. An ACTIVE tenant-owned item and tenant-owned location are required.

One transaction locks the item, records ADJUSTMENT_INCREASE/ADJUSTMENT_DECREASE,
and updates the balance. Increase creates/increments the location balance. Decrease
reuses source balance locking and returns 409 for missing/insufficient availability.
Any failure rolls back movement and balance. Costs remain null; no valuation.

`GET /stock-balances` returns existing balance IDs/timestamps/quantity plus item
(id/name/sku/reorderLevel/unitOfMeasureId/unitOfMeasure), location (id/name/type),
top-level unitOfMeasure (id/name), reorderLevel, isLowStock and isOutOfStock.
Decimal values serialize as strings. Low stock means a configured reorder level
and quantity <= reorderLevel; out of stock means quantity == 0. Both may be true.
Null reorderLevel gives isLowStock=false (previously null). Flags are not persisted.

Optional `?status=LOW_STOCK` or `?status=OUT_OF_STOCK` filters the same deterministic
tenant-scoped balance list. Unconfigured item/location pairs are not generated or
reported as zero. All stock POSTs complete atomically: no draft lifecycle exists,
and balances reflect only committed mutations. No reporting jobs/alerts are added.

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
Accounting posting, valuation methods (FIFO/LIFO/average), alerts,
scheduled jobs and frontend work remain deferred. Transfers never post to Accounting.
