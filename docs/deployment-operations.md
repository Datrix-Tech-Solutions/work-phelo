# WorkPhelo Deployment Operations

Last reviewed: 2026-06-23

This runbook explains the current deploy model and the safe operational checks
for dev and production. The environment source of truth is
[`docs/platform/current-environments.md`](platform/current-environments.md).

## Current Deployment Model

WorkPhelo uses GitHub Actions, GHCR, Docker Compose and a server-side Nginx
reverse proxy.

| Environment | Branch | Workflow | Compose project | App URL | API URL |
|---|---|---|---|---|---|
| Development | `dev` | `.github/workflows/deploy-dev.yml` | `workphelo-dev` | `https://dev-app.workphelo.com` | `https://dev-api.workphelo.com/api/v1` |
| Production | `prod` | `.github/workflows/deploy-prod.yml` | `workphelo-prod` | `https://app.workphelo.com` | `https://api.workphelo.com/api/v1` |

The public landing page is hosted separately on Vercel at `https://workphelo.com`
and `https://www.workphelo.com`.

## Deployment Assets

| Purpose | Dev | Prod |
|---|---|---|
| Workflow | `.github/workflows/deploy-dev.yml` | `.github/workflows/deploy-prod.yml` |
| Remote script | `.github/scripts/deploy-dev.sh` | `.github/scripts/deploy-prod.sh` |
| Compose file | `infrastructure/docker-compose.dev.yml` | `infrastructure/docker-compose.prod.yml` |
| Shared helper | `.github/scripts/deploy-common.sh` | `.github/scripts/deploy-common.sh` |
| Compose env file | `.compose.dev.env` | `.compose.prod.env` |
| Remote path | `/var/www/apps/dev.workphelo.datrixtechsolutions.com/work-phelo` | `/var/www/apps/workphelo.com/work-phelo` |

Remote paths retain legacy directory names. They are not public domains.

## Trigger Model

### Development

The dev workflow runs on:

- push to `dev`
- merged PR targeting `dev`

### Production

The prod workflow runs on:

- push to `prod`
- merged PR targeting `prod`
- manual `workflow_dispatch`

## Pipeline Stages

Both workflows use the same high-level stages:

1. Checkout target SHA.
2. Install dependencies.
3. Run quality gates.
4. Detect changed services.
5. Build and push changed images to GHCR.
6. Validate deployment inputs.
7. Upload compose/deploy assets to the server.
8. Run the environment-specific SSH deploy script.
9. Render-check compose.
10. Start containers.
11. Run migrations/seeds.
12. Wait for health checks.

## Quality Gates

Current deploy workflows run:

```bash
npm ci
npm run check-types
npm run test:unit
npm run build
```

CI also runs lint and RBAC checks through `.github/workflows/ci.yml`.

## Image Tags

| Environment | Stable tag | Immutable tag |
|---|---|---|
| Dev | `:dev` | `:<commit-sha>` |
| Prod | `:prod` | `:<commit-sha>` |

Image prefix:

```text
ghcr.io/datrix-tech-solutions/work-phelo/<service>
```

## Service Inventory

| Service | Dev deployed | Prod deployed |
|---|---|---|
| Web app | Yes | Yes |
| API Gateway | Yes | Yes |
| Auth Service | Yes | Yes |
| HR Service | Yes | Yes |
| Notification Service | Yes | Yes |
| Subscription Service | Yes | No |
| Marketing Service | Yes | No |
| Reinsurance Service | Yes | No |

Before promoting a feature to production, verify the required service exists in
`infrastructure/docker-compose.prod.yml`.

## Runtime Health Checks

Expected local-on-server health checks:

### Dev

```bash
curl -fsSL http://127.0.0.1:3000/health
curl -fsSL http://127.0.0.1:4010/health
curl -fsSL http://127.0.0.1:4001/health
curl -fsSL http://127.0.0.1:4002/health
curl -fsSL http://127.0.0.1:4004/api/health
curl -fsSL http://127.0.0.1:4005/api/health
curl -fsSL http://127.0.0.1:4006/api/health
curl -fsSL http://127.0.0.1:4007/api/health
```

### Prod

```bash
curl -fsSL http://127.0.0.1:3001/health
curl -fsSL http://127.0.0.1:4110/health
curl -fsSL http://127.0.0.1:4101/health
curl -fsSL http://127.0.0.1:4102/health
curl -fsSL http://127.0.0.1:4104/api/health
```

Public checks:

```bash
curl -fsSL https://dev-app.workphelo.com/health
curl -fsSL https://dev-api.workphelo.com/api/v1/auth/docs
curl -fsSL https://app.workphelo.com/health
curl -fsSL https://api.workphelo.com/api/v1/auth/me
```

The last command requires auth for a useful application response; unauthenticated
`401` can still confirm gateway reachability.

## Migration Behavior

Deploy scripts run migrations for deployed services. Production seeds must remain
production-safe and must not load demo data.

Use container `sh`, not `bash`, for Prisma commands:

```bash
docker exec <container> sh -c "npx prisma@5.22.0 migrate deploy --schema /app/apps/<service>/prisma/schema.prisma"
```

## Environment Guardrails

Deploy scripts validate required runtime variables before replacing containers.

Important domain values:

```bash
# Dev
WEB_PUBLIC_API_URL=https://dev-api.workphelo.com/api/v1
WEB_PUBLIC_APP_BASE_URL=https://dev-app.workphelo.com
AUTH_FRONTEND_BASE_URL=https://dev-app.workphelo.com

# Prod
WEB_PUBLIC_API_URL=https://api.workphelo.com/api/v1
WEB_PUBLIC_APP_BASE_URL=https://app.workphelo.com
AUTH_FRONTEND_BASE_URL=https://app.workphelo.com
```

Do not document or print secret values.

## Incident Checklist

1. Identify target environment and commit SHA.
2. Check GitHub Actions run for failed quality gates, image build failures or SSH deploy failures.
3. Check server container status:

   ```bash
   docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
   ```

4. Confirm the correct compose project:

   ```bash
   docker compose --project-name workphelo-dev ps
   docker compose --project-name workphelo-prod ps
   ```

5. Check logs for affected services only:

   ```bash
   docker logs --tail=200 <container>
   ```

6. Confirm Nginx is routing to the expected local port.
7. Confirm `.compose.<env>.env` pins the intended image SHAs.
8. Avoid stopping the other environment. Dev and prod share a host but use
   separate projects, networks and volumes.

## Rollback

Rollback is manual and image-based. Pin the previous SHA for the affected
service and restart only that service:

```bash
export AUTH_SERVICE_IMAGE=ghcr.io/datrix-tech-solutions/work-phelo/auth-service:<old-sha>
docker compose --project-name workphelo-prod --env-file .compose.prod.env -f infrastructure/docker-compose.prod.yml up -d auth-service
```

If a release branch was used for production, keep it until the rollback window
has passed.

## Common Failure Modes

| Symptom | Likely cause | First check |
|---|---|---|
| Browser cannot call API | Nginx `/api/v1` route, gateway health, cookie/CORS env | `curl` app `/api/v1/auth/me` |
| OAuth callback loops | Callback URL does not use app host | Provider dashboard and auth env |
| Swagger unavailable in prod | Expected by default | Enable only for controlled support window |
| Service missing in prod | Not in prod compose | `docker-compose.prod.yml` |
| 502 from gateway | Service unhealthy or Nginx buffer too small | Gateway logs and Nginx config |
| Multipart upload loses file | Gateway body streaming/proxy issue | HR import dry-run through gateway |

## Related Docs

- Current environments: `docs/platform/current-environments.md`
- Deployment overview: `docs/deployment.md`
- Domain routing: `docs/domain-routing.md`
- Documentation process: `docs/processes/documentation-maintenance.md`
