# WorkPhelo Inventory Operations

Scaffold only. Business APIs and domain models will be implemented from approved
Jira user stories. There are no Inventory permission resources, tenant flags,
tables, migrations, RabbitMQ queues/events or Redis jobs.

## HTTP and Configuration

- Service port: INVENTORY_SERVICE_PORT (default 4009; integer 1..65535).
- Public process health: GET /api/health.
- Gateway: GET /api/v1/operations/inventory/health.
- Optional Swagger: /api/docs; controlled by ENABLE_SWAGGER/DEPLOY_ENV/NODE_ENV.
- Required JWT_SECRET: same verification secret as Auth/Gateway; never put it in Git.
- Optional HTTP_BODY_LIMIT defaults to 1mb for ordinary JSON/urlencoded bodies.
- DATABASE_URL is not used at runtime until approved models enable Prisma persistence.

Health returns only status, service and timestamp. It proves process readiness,
not database/broker readiness. No CORS policy is added for direct browser access:
use the API Gateway, matching the Accounting service boundary.

## Local Commands

Build shared packages first, then start using your normal local environment loader:

```bash
npm ci
npm run build --workspace=packages/types
npm run build --workspace=packages/config
npm run build --workspace=packages/internal-auth
npm run dev:inventory

npm run check-types --workspace=apps/inventory-service
npm run lint --workspace=apps/inventory-service
npm test --workspace=apps/inventory-service -- --runInBand
npm run build --workspace=apps/inventory-service
docker build -f apps/inventory-service/Dockerfile -t workphelo-inventory-scaffold:local .
```

.env.example lists names only. Do not copy shared DEV/PROD credentials into a local
smoke test. The Prisma README explains why empty persistence has no generated client
or migrations; the future domain schema is inventory, not a new shared schema.

## Security Contract

AuthModule exports current Gateway-context JWT verification, strict module/feature
guards, fail-closed permission declarations and the shared internal HMAC guard.
Health is intentionally public, following current per-controller guard conventions.
There are no production protected endpoints yet. Future controllers must explicitly
use JwtAuthGuard, applicable ModuleGuard/FeatureGuard, and PermissionsGuard with
approved permissions or a justified service policy. Direct token-only user requests
must not pass the inventory-audience Gateway assertion check.

Current Auth state is resolved by Gateway /me lookup, not a stale JWT snapshot or
direct Auth database access. Tenant identity comes from verified request.user.
Internal callers use @work-phelo/internal-auth; credentials/allowlists are only
needed when an approved internal route is introduced.

## Deployment Scope

DEV image/build/Compose/env/preflight/health wiring is configured. No Inventory
migration command runs, because there are no models. Gateway INVENTORY_SERVICE_URL
is optional; no company moduleConfig change is needed to boot.

PROD is intentionally not enabled, matching Accounting/Marketing rollout staging.
A separate promotion must add PROD image/Compose/env/verification wiring when
approved. This scaffold does not deploy, expose a direct public Nginx upstream or
enable Inventory business functionality.
