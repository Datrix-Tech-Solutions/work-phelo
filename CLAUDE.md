# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**WorkPhelo** is a NestJS microservices ERP monorepo managed with **Turborepo** and npm workspaces. It serves multi-tenant organizations with HR, auth, notifications, billing, and marketing features.

## Running the Project

### Start infrastructure first (Postgres, RabbitMQ, Redis)

```bash
docker compose -f infrastructure/docker-compose.dev.yml up -d postgres rabbitmq redis
```

### Start all services (watch mode)

```bash
npm run dev
```

### Start individual services

```bash
npm run dev:gateway    # API Gateway — port 4010
npm run dev:auth       # Auth Service — port 4001
npm run dev:hr         # HR Service — port 4002
npm run dev:notify     # Notification Service — port 4004
npm run dev:billing    # Subscription Service — port 4005
npm run dev:marketing  # Marketing Service — port 4006
# Frontend (Next.js) — port 3000
cd apps/web/work-phelo-web && npm run dev
```

## Build, Lint, Test

```bash
npm run build           # Build all apps
npm run lint            # Lint all apps
npm run check-types     # Type check all apps
npm run format          # Prettier format all files
npm run test            # Run all tests (Jest)

# Single service (from service directory)
npm run test:watch      # Jest watch mode
npm run test:cov        # Coverage report
```

## Database

```bash
npm run db:generate:all   # Generate all Prisma clients
npm run db:migrate:all    # Run migrations across all services

# Per-service (from service directory)
npm run db:migrate        # prisma migrate dev
npm run db:generate       # prisma generate
```

Each service owns an isolated PostgreSQL schema:

- `auth-service` → `auth` schema
- `hr-service` → `hr` schema

## Commits

Conventional commits are enforced via commitlint. Branch strategy:

- `main` — production
- `dev` — active development
- `feature/*`, `fix/*`, `docs/*` — PRs only; never push directly to `main` or `dev`

## Architecture

### Service Topology

```
Frontend (Next.js :3000)
  └── HTTP/REST (via next.config.ts rewrites)
        └── API Gateway (:4010)  ← JWT validation, routing
              ├── Auth Service (:4001)  — Prisma → auth schema
              └── HR Service (:4002)   — Prisma → hr schema
                                        — BullMQ job queues
                                        — Cloudinary (images)

  RabbitMQ (async events)
    ├── Notification Service (:4004)  — Resend (email), Twilio (SMS)
    ├── Subscription Service (:4005)  — billing
    └── Marketing Service (:4006)

  Redis — caching, sessions (all services)
  PostgreSQL 16 — multi-schema (all services)
```

### Communication Patterns

- **Frontend → API Gateway**: HTTP REST via Next.js rewrites (`/api/v1/*`)
- **Gateway → Services**: GraphQL (Apollo) and/or HTTP RPC calls
- **Services ↔ Services**: RabbitMQ for async/event-driven messaging
- **Auth**: JWT in httpOnly cookies; Passport strategies (local, JWT, Google OAuth2, Microsoft, TOTP/SMS MFA)

### Frontend Structure (Atomic Design)

```
apps/web/work-phelo-web/src/
├── app/          # Next.js App Router routes
├── components/
│   ├── atoms/    # Button, Input, Badge, etc.
│   ├── molecules/# FormField, StatusBadge, FilterSelect, StatPill
│   │   ├── leave/      # BalanceCard, etc.
│   │   └── appraisal/  # RatingBadge, etc.
│   ├── organisms/# Tables, Sidebar, complex forms
│   │   ├── employee/   # EditEmployeePanel, OffboardEmployeePanel, etc.
│   │   ├── leave/      # CreatePublicHolidayPanel, etc.
│   │   └── appraisal/  # CreateCyclePanel, CreateKpiPanel, etc.
│   └── templates/# Layout templates
├── hooks/        # Custom hooks (data fetching via React Query)
├── lib/          # api.ts (Axios), utils.ts (cn()), formatters.ts (formatDate, getGreeting)
├── store/        # Zustand global state
├── types/        # TypeScript interfaces by domain
└── providers/    # React context/providers
```

Data fetching uses **React Query** (TanStack) hooks. State is **Zustand**. Conditional class names use `cn()` from `lib/utils.ts`.

### Frontend Type Organisation

Types live in `src/types/` grouped by domain:

- `auth.ts` — `User`, `AuthState`, `LoginPayload`
- `hr.ts` — `Employee`, `Department`, `LeaveType`, `LeaveRequest` (and HR-specific types)
- `tenant.ts` — `Company`, `TenantUser`, `AuditLog`, `TenantStatus`
- `asset.ts` — `Asset`, `EmployeeAsset`, `AssetStatus`, `AssetCondition`
- `leave.ts` — `LeaveBalance`, `LeaveRequest` (leave-specific; **do not re-export from index**)
- `appraisal.ts` — `AppraisalCycle`, `AppraisalKpi`, `FinalRating` (**do not re-export from index**)
- `index.ts` — barrel for `auth`, `hr`, `tenant`, `asset` only

> **Important:** `leave.ts` and `appraisal.ts` are intentionally excluded from `types/index.ts` because they contain names (`LeaveType`, `LeaveRequest`) that conflict with `hr.ts`. Import them directly: `import { ... } from '@/types/leave'`.

### JWT / Auth Context

`JwtStrategy.validate()` returns the full user context including `moduleConfig` and `featureConfig` from the tenant. The `GET /auth/me` endpoint propagates these to the frontend Zustand store. Use `user.moduleConfig` (not hardcoded keys) to determine which modules are enabled for a tenant.

### Shared Packages

```
packages/
├── types/   → @work-phelo/types
├── schemas/ → @work-phelo/schemas
├── utils/   → @work-phelo/utils
└── config/  → @work-phelo/config
```

Import shared packages with their workspace aliases (e.g., `import { ... } from '@work-phelo/types'`).

## Environment Setup

Each service needs a `.env` from its `.env.example`. Key variables:

- All services: `DATABASE_URL`, `RABBITMQ_URL`
- `auth-service`: `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `RESEND_API_KEY`, `FRONTEND_BASE_URL`
- `web`: `NEXT_PUBLIC_API_URL`

First-time DB setup after infra is running:

```bash
cd apps/auth-service && npx prisma migrate dev && npx prisma db seed
cd apps/hr-service && npx prisma migrate dev
```

## Swagger / API Docs (dev)

- Auth: `http://localhost:4001/docs`
- HR: `http://localhost:4002/docs`

## CI/CD

GitHub Actions on push to `dev`/`main`:

1. Type checks & build validation
2. Detect changed services (only rebuilds changed ones)
3. Build & push Docker images → GitHub Container Registry (GHCR)
4. SSH deploy to DigitalOcean; run migrations & seed (idempotent)
