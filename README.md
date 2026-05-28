# WorkPhelo ERP

## Live Dev Environment

| Service      | URL                                   |
| ------------ | ------------------------------------- |
| Web App      | http://157.245.220.205                |
| Auth Swagger | http://157.245.220.205/auth-docs/docs |
| HR Swagger   | http://157.245.220.205/hr-docs/docs   |
| API Base URL | http://157.245.220.205/api/v1         |

## Architecture

WorkPhelo is a **NestJS microservices monorepo** managed with Turborepo.

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
│   ├── types/
│   ├── schemas/
│   ├── utils/
│   └── config/
└── infrastructure/
    └── docker-compose.dev.yml
```

The broker-only Reinsurance Operations module is being introduced as a
domain-specific service inside this monorepo. Detailed Reinsurance planning
documentation is maintained internally/local-only and is intentionally not
tracked in Git.

## Tech Stack

**Backend**

- NestJS microservices
- PostgreSQL 16 (multi-schema)
- RabbitMQ (async messaging)
- Redis (caching, sessions)
- Prisma ORM
- JWT authentication (httpOnly cookies)
- Resend (transactional email)

**Frontend**

- Next.js 16 (App Router)
- TypeScript
- Tailwind CSS
- Zustand (state management)
- React Query (server state)
- Atomic design system

**Infrastructure**

- Docker + Docker Compose
- GitHub Actions CI/CD
- DigitalOcean (Ubuntu 24)
- Nginx (reverse proxy)
- GitHub Container Registry (GHCR)

---

## Getting Started

### Prerequisites

- Node.js 20+
- Docker Desktop
- Git

### 1. Clone the repository

```bash
git clone https://github.com/Datrix-Tech-Solutions/work-phelo.git

cd work-phelo
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Each service has its own `.env` file. Copy the examples:

```bash
cp apps/auth-service/.env.example apps/auth-service/.env

cp apps/hr-service/.env.example apps/hr-service/.env

cp apps/notification-service/.env.example apps/notification-service/.env

cp apps/web/work-phelo-web/.env.example apps/web/work-phelo-web/.env.local
```

### 4. Start infrastructure

```bash
docker compose -f infrastructure/docker-compose.dev.yml up -d postgres rabbitmq redis
```

### 5. Run migrations and seed

```bash
# Auth service
cd apps/auth-service

npx prisma migrate dev

npx prisma db seed
cd ../..

# HR service
cd apps/hr-service

npx prisma migrate dev

cd ../..
```

### 6. Start services

```bash
# Start all backend services
npm run dev

# Or start a specific service
npx turbo dev --filter=auth-service

npx turbo dev --filter=hr-service
```

### 7. Start the frontend

```bash
cd apps/web/work-phelo-web

npm install

npm run dev
# → http://localhost:3000
```

---

## API Overview

All requests go through the API Gateway at `/api/v1/`.

See full API docs at the Swagger URLs above.

In the development deployment, Reinsurance Operations OpenAPI documentation
is exposed through `/api/v1/operations/reinsurance/docs` when enabled by its
deployment flag. The
`apps/reinsurance-service/README.md` contract includes frontend integration
guidance for Counterparties.

---

## CI/CD Pipeline

Every push to `dev` triggers:

1. **Quality Gates** — type checks + build validation for all backend services

2. **Detect Changes** — only changed services are rebuilt

3. **Build & Push** — Docker images pushed to GHCR

4. **Next.js Build** — Docker image for frontend built and pushed

5. **Deploy** — SSH into DigitalOcean, pull images, restart containers, run migrations, seed DB

Branch strategy:

- `dev` → development environment (auto-deploys)

- `main` → production (merge from dev)

---

## Project Structure — Frontend

The frontend follows **atomic design** principles:

```
src/
├── app/
│   ├── (auth)/login/
│   ├── [tenantSlug]/login/
│   └── platform/dashboard/
├── components/
│   ├── atoms/
│   ├── molecules/
│   ├── organisms/
│   └── templates/
├── lib/
│   ├── api.ts
│   └── utils.ts
├── providers/
├── store/
├── hooks/
└── types/
```

---

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) before making any changes.
