# Inventory Persistence

Inventory owns the PostgreSQL `inventory` schema. The first domain migration is
`20261102000000_add_inventory_core_stock_in`; it creates six tenant-scoped tables,
three enums, composite tenant foreign keys, unique names/SKUs/balances, indexes and
non-negative receipt/value checks. Referenced settings/locations use RESTRICT.

`npm run db:generate --workspace=apps/inventory-service` generates the ignored
service-owned client. `DATABASE_URL` is required at runtime. The DEV deployment
script now supplies it and runs the normal migration deploy command after review.
No shared database migration is authorized by this implementation task.

Optional database tests only run when `INVENTORY_TEST_DATABASE_URL` explicitly
targets a disposable `inventory_test` database on localhost. They never fall back
to `DATABASE_URL`.
