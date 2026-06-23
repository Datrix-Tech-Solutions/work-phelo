# WorkPhelo Current Environments

Last reviewed: 2026-06-23

This document is the repository source of truth for WorkPhelo runtime
environments, domains, Swagger URLs and deployed service inventory. Update this
file first when domains, deployment targets or service exposure changes.

## Public Domains

| Purpose | URL | Status | Notes |
|---|---|---|---|
| Public landing page | `https://workphelo.com` | Active | Hosted outside this monorepo on Vercel. |
| Public landing page alias | `https://www.workphelo.com` | Active | Vercel alias for the public site. |
| Production SaaS app | `https://app.workphelo.com` | Active | Current WorkPhelo application host. |
| Production API gateway | `https://api.workphelo.com/api/v1` | Active | Direct API host for tooling and external clients. |
| Development SaaS app | `https://dev-app.workphelo.com` | Active | Dev/staging application host. |
| Development API gateway | `https://dev-api.workphelo.com/api/v1` | Active | Dev/staging API host. |

The old `https://dev.workphelo.datrixtechsolutions.com` route is legacy
compatibility only. Do not add new links or documentation that depends on it.

There is no separate repository-managed staging environment at this time. The
development deployment functions as the staging/UAT environment.

## Frontend URLs

| Environment | Frontend URL | Platform Admin | Tenant route example |
|---|---|---|---|
| Local | `http://localhost:3000` | `http://localhost:3000/platform/login` | `http://localhost:3000/acme-ghana/login` |
| Development | `https://dev-app.workphelo.com` | `https://dev-app.workphelo.com/platform/login` | `https://dev-app.workphelo.com/acme-ghana/login` |
| Production | `https://app.workphelo.com` | `https://app.workphelo.com/platform/login` | `https://app.workphelo.com/acme-ghana/login` |

Browser code should call same-origin `/api/v1/...` routes. The Next.js rewrite
and Nginx route those calls to the API gateway. Do not introduce browser
credentialed calls directly to `api.workphelo.com` or `dev-api.workphelo.com`
unless cookie/CORS behavior is intentionally redesigned.

## API Gateway URLs

| Environment | Gateway base URL | Notes |
|---|---|---|
| Local | `http://localhost:4000/api/v1` | Local gateway process. Some local QA setups use `http://localhost:5010/api/v1` when services are run with alternate ports. |
| Development | `https://dev-api.workphelo.com/api/v1` | Dev/staging API gateway. |
| Production | `https://api.workphelo.com/api/v1` | Production API gateway. |

## Swagger/OpenAPI URLs

Swagger is controlled by `ENABLE_SWAGGER` and `DEPLOY_ENV`.

- Development deploys set `ENABLE_SWAGGER=true`; gateway Swagger paths should be reachable.
- Production deploys do not enable Swagger by default. Treat production Swagger URLs as disabled unless explicitly enabled for a controlled support window.

| Service | Local Swagger | Development Swagger | Production Swagger |
|---|---|---|---|
| API Gateway | `http://localhost:4000/docs` | `https://dev-api.workphelo.com/docs` or gateway-host-specific docs route if enabled | Normally disabled |
| Auth Service | `http://localhost:4001/docs` | `https://dev-api.workphelo.com/api/v1/auth/docs` | Normally disabled: `https://api.workphelo.com/api/v1/auth/docs` |
| HR Service | `http://localhost:4002/docs` | `https://dev-api.workphelo.com/api/v1/hr/docs` | Normally disabled: `https://api.workphelo.com/api/v1/hr/docs` |
| Notification Service | `http://localhost:4004/api/docs` | `https://dev-api.workphelo.com/api/v1/notification/docs` | Normally disabled: `https://api.workphelo.com/api/v1/notification/docs` |
| Subscription Service | `http://localhost:4005/api/docs` | `https://dev-api.workphelo.com/api/v1/subscription/docs` | Not deployed in current prod compose |
| Marketing Service | `http://localhost:4006/api/docs` | `https://dev-api.workphelo.com/api/v1/marketing/docs` | Not deployed in current prod compose |
| Reinsurance Service | `http://localhost:4007/api/docs` | `https://dev-api.workphelo.com/api/v1/operations/reinsurance/docs` | Not deployed in current prod compose |

## Service Inventory

| Service | Dev deployment | Prod deployment | Gateway prefix | Local service port | Dev host port | Prod host port |
|---|---|---|---|---:|---:|---:|
| Web app (`nextjs`) | Deployed | Deployed | n/a | 3000 | 3000 | 3001 |
| API Gateway | Deployed | Deployed | `/api/v1/*` | 4000 | 4010 | 4110 |
| Auth Service | Deployed | Deployed | `/api/v1/auth/*` | 4001 | 4001 | 4101 |
| HR Service | Deployed | Deployed | `/api/v1/hr/*` | 4002 | 4002 | 4102 |
| Notification Service | Deployed | Deployed | `/api/v1/notification/*` | 4004 | 4004 | 4104 |
| Subscription Service | Deployed in dev | Not deployed in prod compose | `/api/v1/subscription/*` | 4005 | 4005 | n/a |
| Marketing Service | Deployed in dev | Not deployed in prod compose | `/api/v1/marketing/*` | 4006 | 4006 | n/a |
| Reinsurance Service | Deployed in dev | Not deployed in prod compose | `/api/v1/operations/reinsurance/*` | 4007 | 4007 | n/a |

## Infrastructure Targets

| Environment | Branch | Workflow | Compose file | Compose project | Remote deploy path |
|---|---|---|---|---|---|
| Development | `dev` | `.github/workflows/deploy-dev.yml` | `infrastructure/docker-compose.dev.yml` | `workphelo-dev` | `/var/www/apps/dev.workphelo.datrixtechsolutions.com/work-phelo` |
| Production | `prod` | `.github/workflows/deploy-prod.yml` | `infrastructure/docker-compose.prod.yml` | `workphelo-prod` | `/var/www/apps/workphelo.com/work-phelo` |

The deployment paths retain legacy directory names for compatibility with the
server layout. Public URLs are the domains listed above, not the path names.

## Runtime Dependencies

| Dependency | Development | Production |
|---|---|---|
| PostgreSQL | Shared Postgres deployment with environment-specific schemas/URLs | Shared Postgres deployment with prod schemas/URLs |
| Redis | Dev Redis container and volume | Prod Redis container and volume |
| RabbitMQ | Dev RabbitMQ container | Managed RabbitMQ/CloudAMQP via `PROD_RABBITMQ_URL` |
| GHCR | `ghcr.io/datrix-tech-solutions/work-phelo/<service>:dev` and SHA tags | `ghcr.io/datrix-tech-solutions/work-phelo/<service>:prod` and SHA tags |
| Nginx | Server-managed reverse proxy, config not stored in repo | Server-managed reverse proxy, config not stored in repo |
| SSL | Let's Encrypt/Certbot on server | Let's Encrypt/Certbot on server |

## Environment Values

### Development

```bash
WEB_PUBLIC_API_URL=https://dev-api.workphelo.com/api/v1
NEXT_PUBLIC_API_URL=https://dev-api.workphelo.com/api/v1
WEB_PUBLIC_APP_BASE_URL=https://dev-app.workphelo.com
NEXT_PUBLIC_APP_BASE_URL=https://dev-app.workphelo.com
AUTH_FRONTEND_BASE_URL=https://dev-app.workphelo.com
ALLOWED_ORIGINS=https://dev-app.workphelo.com,https://dev.workphelo.datrixtechsolutions.com
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAME_SITE=lax
AUTH_GOOGLE_CALLBACK_URL=https://dev-app.workphelo.com/api/v1/auth/google/callback
AUTH_MICROSOFT_CALLBACK_URL=https://dev-app.workphelo.com/api/v1/auth/microsoft/callback
```

### Production

```bash
WEB_PUBLIC_API_URL=https://api.workphelo.com/api/v1
NEXT_PUBLIC_API_URL=https://api.workphelo.com/api/v1
WEB_PUBLIC_APP_BASE_URL=https://app.workphelo.com
NEXT_PUBLIC_APP_BASE_URL=https://app.workphelo.com
AUTH_FRONTEND_BASE_URL=https://app.workphelo.com
ALLOWED_ORIGINS=https://app.workphelo.com,https://workphelo.com
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAME_SITE=lax
AUTH_GOOGLE_CALLBACK_URL=https://app.workphelo.com/api/v1/auth/google/callback
AUTH_MICROSOFT_CALLBACK_URL=https://app.workphelo.com/api/v1/auth/microsoft/callback
```

## Retired or Legacy References

Do not use these in new documentation, examples or generated links:

- `http://157.245.220.205`
- `http://157.245.220.205/api/v1`
- `http://157.245.220.205/auth-docs/docs`
- `http://157.245.220.205/hr-docs/docs`
- `https://workphelo.com/api/v1`
- `https://dev.workphelo.datrixtechsolutions.com/api/v1`
- `https://workphelo.com/{tenantSlug}` for application links

Use `https://app.workphelo.com` for production app links,
`https://dev-app.workphelo.com` for development app links, and the API gateway
hosts listed above for direct API tooling.
