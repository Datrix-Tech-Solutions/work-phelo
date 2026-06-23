# WorkPhelo ERP

WorkPhelo is a multi-tenant ERP platform for HR, payroll, notifications,
subscriptions, marketing workflows and broker-focused Reinsurance Operations.

The repository is a NestJS + Next.js monorepo managed with Turborepo.

## Current Environments

The canonical environment reference is
[`docs/platform/current-environments.md`](docs/platform/current-environments.md).

| Environment    | Frontend                                              | API Gateway                            | Status                           |
| -------------- | ----------------------------------------------------- | -------------------------------------- | -------------------------------- |
| Local          | `http://localhost:3000`                               | `http://localhost:4000/api/v1`         | Developer machine                |
| Development    | `https://dev-app.workphelo.com`                       | `https://dev-api.workphelo.com/api/v1` | Auto-deployed from `dev`         |
| Production app | `https://app.workphelo.com`                           | `https://api.workphelo.com/api/v1`     | Auto/manual deployed from `prod` |
| Public landing | `https://workphelo.com` / `https://www.workphelo.com` | n/a                                    | Vercel-managed public site       |

Legacy IP-based URLs and `workphelo.com/api/v1` are retired. Do not use them in
new docs, examples or generated links.

## Architecture

```
work-phelo/
├── apps/
│   ├── api-gateway/
│   ├── auth-service/
│   ├── hr-service/
│   ├── notification-service/
│   ├── subscription-service/
│   ├── marketing-service/
│   ├── reinsurance-service/
│   └── web/
│       └── work-phelo-web/
├── packages/
│   ├── config/
│   ├── schemas/
│   ├── types/
│   └── utils/
├── docs/
└── infrastructure/
```

### Backend

- NestJS microservices
- API Gateway route prefix: `/api/v1`
- PostgreSQL 16 with service-owned schemas
- Prisma ORM
- RabbitMQ for async events
- Redis for cache/session-related infrastructure
- JWT auth with HTTP-only cookies
- Resend email provider
- Configurable SMS providers in notification-service

### Frontend

- Next.js App Router
- TypeScript
- Tailwind CSS
- React Query
- Zustand
- Atomic/component-driven UI structure

### Infrastructure

- Docker and Docker Compose
- GitHub Actions CI/CD
- GHCR images
- DigitalOcean Ubuntu host
- Nginx reverse proxy
- Vercel for the public landing page

## Deployed Service Inventory

| Service              | Dev | Prod | Gateway prefix                     |
| -------------------- | --- | ---- | ---------------------------------- |
| Web app              | Yes | Yes  | n/a                                |
| API Gateway          | Yes | Yes  | `/api/v1/*`                        |
| Auth Service         | Yes | Yes  | `/api/v1/auth/*`                   |
| HR Service           | Yes | Yes  | `/api/v1/hr/*`                     |
| Notification Service | Yes | Yes  | `/api/v1/notification/*`           |
| Subscription Service | Yes | No   | `/api/v1/subscription/*`           |
| Marketing Service    | Yes | No   | `/api/v1/marketing/*`              |
| Reinsurance Service  | Yes | No   | `/api/v1/operations/reinsurance/*` |

Prod service exposure should be checked against
[`infrastructure/docker-compose.prod.yml`](infrastructure/docker-compose.prod.yml)
before planning a production release.

## Swagger/OpenAPI

Swagger is enabled in development deployments and normally disabled in
production unless explicitly enabled for a controlled support window.

| Service      | Dev Swagger                                                        |
| ------------ | ------------------------------------------------------------------ |
| Auth         | `https://dev-api.workphelo.com/api/v1/auth/docs`                   |
| HR           | `https://dev-api.workphelo.com/api/v1/hr/docs`                     |
| Notification | `https://dev-api.workphelo.com/api/v1/notification/docs`           |
| Subscription | `https://dev-api.workphelo.com/api/v1/subscription/docs`           |
| Marketing    | `https://dev-api.workphelo.com/api/v1/marketing/docs`              |
| Reinsurance  | `https://dev-api.workphelo.com/api/v1/operations/reinsurance/docs` |

See [`docs/platform/current-environments.md`](docs/platform/current-environments.md)
for local and production Swagger notes.

## Getting Started

### Prerequisites

- Node.js 20+
- Docker Desktop
- Git

### Install Dependencies

```bash
npm install
```

### Start Local Infrastructure

```bash
docker compose -f infrastructure/docker-compose.dev.yml up -d redis rabbitmq
```

Use your service `.env` files for PostgreSQL, RabbitMQ, Redis and provider
configuration. The deployed dev/prod environments are managed by GitHub Actions
and server-side environment files.

### Run Prisma Commands

Run service Prisma commands from each service directory. Examples:

```bash
cd apps/auth-service
npx prisma migrate dev
npx prisma db seed

cd ../hr-service
npx prisma migrate dev
```

### Start Services

```bash
# All configured dev scripts through Turbo
npm run dev

# Or a single service
npx turbo dev --filter=auth-service
npx turbo dev --filter=hr-service
```

### Start Frontend

```bash
cd apps/web/work-phelo-web
npm run dev
```

Local app URL: `http://localhost:3000`

## API Routing Rules

- Browser code should call same-origin `/api/v1/...`.
- Next.js rewrites and Nginx route those requests to the API Gateway.
- Direct API tooling can use `https://dev-api.workphelo.com/api/v1` or
  `https://api.workphelo.com/api/v1`.
- Application links must use `https://app.workphelo.com` in production and
  `https://dev-app.workphelo.com` in development.

## CI/CD

| Branch | Workflow                            | Target                  |
| ------ | ----------------------------------- | ----------------------- |
| `dev`  | `.github/workflows/deploy-dev.yml`  | Development environment |
| `prod` | `.github/workflows/deploy-prod.yml` | Production environment  |

The `main` branch exists historically but is not the current production deploy
branch. Production releases go through `prod`.

Core validation commands:

```bash
npm run check-types
npm run test:unit
npm run build
npm run lint
```

Deployment details live in:

- [`docs/deployment.md`](docs/deployment.md)
- [`docs/deployment-operations.md`](docs/deployment-operations.md)
- [`docs/domain-routing.md`](docs/domain-routing.md)

## Documentation

- Current environments: [`docs/platform/current-environments.md`](docs/platform/current-environments.md)
- Documentation process: [`docs/processes/documentation-maintenance.md`](docs/processes/documentation-maintenance.md)
- Reinsurance operations: [`docs/reinsurance-operations.md`](docs/reinsurance-operations.md)
- Postman package: [`docs/postman/README.md`](docs/postman/README.md)

When changing domains, deployments, API contracts or service exposure, update
the documentation in the same PR.
