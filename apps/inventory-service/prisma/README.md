# Inventory Persistence

Inventory owns the PostgreSQL `inventory` schema. The first domain migration is
`20261102000000_add_inventory_core_stock_in`; it creates six tenant-scoped tables,
three enums, composite tenant foreign keys, unique names/SKUs/balances, indexes and
non-negative receipt/value checks. Referenced settings/locations use RESTRICT.

`20261102010000_add_inventory_stock_out_transfers` extends movement types, adds
the purpose enum and nullable recipient/purpose/transferId fields with a tenant/link
index and issue/transfer checks. It leaves existing STOCK_IN rows and the historical
migration unchanged. No new transfer table is introduced.

`20261103010000_add_inventory_adjustments` adds two adjustment movement types,
the adjustment reason enum and nullable adjustmentReason column. A DB check requires
a reason on adjustment movements; the existing non-receipt null-cost check applies.
No historical migration or movement is changed and no new table is introduced.

`20261103020000_add_inventory_settings_contract` adds the ACTIVE/INACTIVE
configuration enum and category description/icon/status, unit symbol/description/status,
and location code/address/status with tenant/code uniqueness. Existing rows default
to ACTIVE; existing symbols use the first 10 ID characters and location codes use a
deterministic per-tenant LEGACY-<ordinal> sequence before making columns NOT NULL.
No empty duplicate codes, name changes or FK/history rewrites. Counts stay derived;
stockValue and valuation are not implemented. Apply migration before the new binary.

`npm run db:generate --workspace=apps/inventory-service` generates the ignored
service-owned client. `DATABASE_URL` is required at runtime. The DEV deployment
script now supplies it and runs the normal migration deploy command after review.
No shared database migration is authorized by this implementation task.

Optional database tests only run when `INVENTORY_TEST_DATABASE_URL` explicitly
targets a disposable `inventory_test` database on localhost. They never fall back
to `DATABASE_URL`.
