# Inventory Persistence Scaffold

The reserved domain schema is inventory, following hr/marketing/accounting/reinsurance.
The w_auth prefix is an Auth exception, not the general naming convention.

There are no models, generated client, database connection or migrations.
AppModule deliberately does not import a PrismaModule. Prisma cannot generate
a useful client without models; db:generate and db:migrate explicitly do nothing.

DATABASE_URL is only needed for Prisma tooling, not Inventory startup/health.
To validate the empty schema without connecting to a database:

```bash
DATABASE_URL='postgresql://unused:unused@127.0.0.1:5432/unused?schema=inventory' npm run db:validate --workspace=apps/inventory-service
```

When approved models arrive, add the normal service-owned PrismaModule,
PrismaService, client generation and reviewed migrations, then add migration
deployment/runtime database configuration. Do not create placeholder tables.
