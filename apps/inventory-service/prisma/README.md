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

`npm run db:generate --workspace=apps/inventory-service` generates the ignored
service-owned client. `DATABASE_URL` is required at runtime. The DEV deployment
script now supplies it and runs the normal migration deploy command after review.
No shared database migration is authorized by this implementation task.

Optional database tests only run when `INVENTORY_TEST_DATABASE_URL` explicitly
targets a disposable `inventory_test` database on localhost. They never fall back
to `DATABASE_URL`.
