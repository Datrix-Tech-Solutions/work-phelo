# WorkPhelo Deployment

Last reviewed: 2026-06-23

For canonical URLs and service inventory, start with
[`docs/platform/current-environments.md`](platform/current-environments.md).

## Environments

| Environment | Frontend | API Gateway | Branch | Status |
|---|---|---|---|---|
| Local | `http://localhost:3000` | `http://localhost:4000/api/v1` | any | Developer machine |
| Development | `https://dev-app.workphelo.com` | `https://dev-api.workphelo.com/api/v1` | `dev` | Active |
| Production app | `https://app.workphelo.com` | `https://api.workphelo.com/api/v1` | `prod` | Active |
| Public landing | `https://workphelo.com` / `https://www.workphelo.com` | n/a | Vercel | Active |

`https://dev.workphelo.datrixtechsolutions.com` is legacy compatibility only.
Do not use it for new links or docs.

## Infrastructure

WorkPhelo deploys Docker images from GHCR onto a DigitalOcean Ubuntu host. Nginx
on the host terminates SSL and proxies traffic to environment-specific Docker
Compose projects.

| Area | Current implementation |
|---|---|
| Image registry | `ghcr.io/datrix-tech-solutions/work-phelo/<service>` |
| Dev compose | `infrastructure/docker-compose.dev.yml` |
| Prod compose | `infrastructure/docker-compose.prod.yml` |
| Dev project | `workphelo-dev` |
| Prod project | `workphelo-prod` |
| Dev deploy path | `/var/www/apps/dev.workphelo.datrixtechsolutions.com/work-phelo` |
| Prod deploy path | `/var/www/apps/workphelo.com/work-phelo` |
| Reverse proxy | Server-managed Nginx config, not stored in repo |
| SSL | Let's Encrypt/Certbot on server |

Deploy paths keep legacy directory names for compatibility. Public traffic uses
the active domains above.

## Service Deployment Matrix

| Service | Dev | Prod | Local service port | Dev host port | Prod host port |
|---|---|---|---:|---:|---:|
| Next.js web | Yes | Yes | 3000 | 3000 | 3001 |
| API Gateway | Yes | Yes | 4000 | 4010 | 4110 |
| Auth Service | Yes | Yes | 4001 | 4001 | 4101 |
| HR Service | Yes | Yes | 4002 | 4002 | 4102 |
| Notification Service | Yes | Yes | 4004 | 4004 | 4104 |
| Subscription Service | Yes | No | 4005 | 4005 | n/a |
| Marketing Service | Yes | No | 4006 | 4006 | n/a |
| Reinsurance Service | Yes | No | 4007 | 4007 | n/a |

Do not assume a service is production-deployed because it exists in the repo.
Check `docker-compose.prod.yml` before planning production usage.

## Routing

### Browser Requests

Browser code should call same-origin `/api/v1/...`.

The runtime path is:

```text
Browser -> app host /api/v1 -> Nginx -> API Gateway -> downstream service
```

`NEXT_PUBLIC_API_URL` is used by the Next.js rewrite/proxy path and build-time
configuration. It should be:

- Dev: `https://dev-api.workphelo.com/api/v1`
- Prod: `https://api.workphelo.com/api/v1`

Do not introduce browser credentialed calls directly to the API subdomain unless
cookie/CORS/CSRF behavior is redesigned.

### Direct API Tooling

Use:

- Dev: `https://dev-api.workphelo.com/api/v1`
- Prod: `https://api.workphelo.com/api/v1`

## CI/CD Flow

### CI

`.github/workflows/ci.yml` runs on pushes and PRs to `dev` and `prod`.

Primary checks:

- `npm ci`
- `npm run check-types`
- `npm run check-rbac`
- `npm run test:unit`
- `npm run build`
- `npm run lint`

### Deploy Dev

Workflow: `.github/workflows/deploy-dev.yml`

Triggers:

- Push to `dev`
- Merged PR targeting `dev`

The dev workflow:

1. Runs quality gates.
2. Detects changed services with `dorny/paths-filter`.
3. Builds changed images with `:dev` and SHA tags.
4. Uploads `docker-compose.dev.yml` and deploy helper scripts.
5. Runs `.github/scripts/deploy-dev.sh` over SSH.
6. Writes `.compose.dev.env` and per-service `.env.dev` files.
7. Starts containers with project `workphelo-dev`.
8. Runs migrations and dev seed.
9. Performs health checks.

Dev also sets `ENABLE_SWAGGER=true`.

### Deploy Prod

Workflow: `.github/workflows/deploy-prod.yml`

Triggers:

- Push to `prod`
- Merged PR targeting `prod`
- Manual `workflow_dispatch`

The prod workflow mirrors dev with production values:

1. Runs quality gates.
2. Detects changed deployable prod services.
3. Builds changed images with `:prod` and SHA tags.
4. Uploads `docker-compose.prod.yml` and deploy helper scripts.
5. Runs `.github/scripts/deploy-prod.sh` over SSH.
6. Writes `.compose.prod.env` and per-service `.env.prod` files.
7. Starts containers with project `workphelo-prod`.
8. Runs production migrations and production-safe seed.
9. Performs health checks.

Prod does not enable Swagger by default.

## Required Environment Values

### Frontend

| Environment | `WEB_PUBLIC_API_URL` / `NEXT_PUBLIC_API_URL` | `WEB_PUBLIC_APP_BASE_URL` / `NEXT_PUBLIC_APP_BASE_URL` |
|---|---|---|
| Dev | `https://dev-api.workphelo.com/api/v1` | `https://dev-app.workphelo.com` |
| Prod | `https://api.workphelo.com/api/v1` | `https://app.workphelo.com` |

### Auth and CORS

| Environment | Value |
|---|---|
| Dev frontend base | `AUTH_FRONTEND_BASE_URL=https://dev-app.workphelo.com` |
| Prod frontend base | `AUTH_FRONTEND_BASE_URL=https://app.workphelo.com` |
| Dev allowed origins | `https://dev-app.workphelo.com,https://dev.workphelo.datrixtechsolutions.com` |
| Prod allowed origins | `https://app.workphelo.com,https://workphelo.com` |
| Cookie secure | `true` |
| Cookie same site | `lax` |

OAuth callback URLs should use the app host:

- Dev Google: `https://dev-app.workphelo.com/api/v1/auth/google/callback`
- Dev Microsoft: `https://dev-app.workphelo.com/api/v1/auth/microsoft/callback`
- Prod Google: `https://app.workphelo.com/api/v1/auth/google/callback`
- Prod Microsoft: `https://app.workphelo.com/api/v1/auth/microsoft/callback`

Do not print secret values in documentation or logs.

## Swagger/OpenAPI

Development Swagger URLs:

- Auth: `https://dev-api.workphelo.com/api/v1/auth/docs`
- HR: `https://dev-api.workphelo.com/api/v1/hr/docs`
- Notification: `https://dev-api.workphelo.com/api/v1/notification/docs`
- Subscription: `https://dev-api.workphelo.com/api/v1/subscription/docs`
- Marketing: `https://dev-api.workphelo.com/api/v1/marketing/docs`
- Reinsurance: `https://dev-api.workphelo.com/api/v1/operations/reinsurance/docs`

Production Swagger is normally disabled. If temporarily enabled, use the same
gateway paths under `https://api.workphelo.com/api/v1`.

## Database and Migrations

Deploy scripts run migrations for deployed services. Local developers can run
service migrations manually:

```bash
cd apps/auth-service
npx prisma migrate dev
npx prisma db seed

cd ../hr-service
npx prisma migrate dev
```

For containers, use `sh` rather than `bash`:

```bash
docker exec <container> sh -c "npx prisma@5.22.0 migrate deploy --schema /app/apps/<service>/prisma/schema.prisma"
```

## Rollback

Rollback is manual. Pin a previous image SHA and restart the affected service:

```bash
export AUTH_SERVICE_IMAGE=ghcr.io/datrix-tech-solutions/work-phelo/auth-service:<old-sha>
docker compose --project-name workphelo-prod --env-file .compose.prod.env -f infrastructure/docker-compose.prod.yml up -d auth-service
```

Keep production release branches until the team agrees they are no longer
needed for rollback history.

## Nginx Notes

Nginx config lives on the server. The required routing pattern is documented in
[`docs/domain-routing.md`](domain-routing.md).

The `/api/v1/` location must keep larger proxy buffers because permission
headers can exceed default Nginx buffer sizes.
