# WorkPhelo Documentation Audit — June 2026

Audit date: 2026-06-23

Branch: `docs/audit-and-refresh-2026-06`

## Scope

Reviewed repository-owned documentation and deployment evidence:

- root `README.md`
- `docs/**`
- service `README.md` files
- Postman docs under `docs/postman/`
- `.github/workflows/*.yml`
- `.github/scripts/*.sh`
- `infrastructure/docker-compose.*.yml`
- service Swagger configuration files
- frontend Docker/runtime API URL configuration

No application code, schema, workflow or infrastructure behavior was changed by
this audit branch.

## Current Truth Summary

The canonical environment source is now `docs/platform/current-environments.md`.

Active public domains:

- Production app: `https://app.workphelo.com`
- Production API: `https://api.workphelo.com/api/v1`
- Public landing page: `https://workphelo.com` and `https://www.workphelo.com`
- Development app: `https://dev-app.workphelo.com`
- Development API: `https://dev-api.workphelo.com/api/v1`

Deployment inventory from Compose:

- Dev deploys web, gateway, auth, HR, notification, subscription, marketing and reinsurance.
- Prod deploys web, gateway, auth, HR and notification.
- Prod does not currently deploy subscription, marketing or reinsurance in `docker-compose.prod.yml`.

Swagger:

- Dev sets `ENABLE_SWAGGER=true` and exposes service docs through the gateway.
- Prod does not enable Swagger by default. Production Swagger URLs should be
  treated as disabled unless a controlled support window explicitly enables them.

## Broken References

The audit found these stale references and obsolete instructions:

| Reference | Location before refresh | Status | Resolution |
|---|---|---|---|
| `http://157.245.220.205` | Root README live dev table | Retired IP-based environment | Replaced with current app/API domains. |
| `http://157.245.220.205/api/v1` | Root README | Retired API base | Replaced with `https://dev-api.workphelo.com/api/v1` and `https://api.workphelo.com/api/v1`. |
| `http://157.245.220.205/auth-docs/docs` | Root README | Retired Swagger URL | Replaced with gateway Swagger paths. |
| `http://157.245.220.205/hr-docs/docs` | Root README | Retired Swagger URL | Replaced with gateway Swagger paths. |
| `https://dev.workphelo.datrixtechsolutions.com/api/v1` | Deployment docs | Legacy dev API URL | Replaced with `https://dev-api.workphelo.com/api/v1`. |
| `https://dev.workphelo.datrixtechsolutions.com` as primary dev host | Deployment docs | Legacy compatibility route only | Reframed as legacy; current app host is `https://dev-app.workphelo.com`. |
| `https://workphelo.com/api/v1` | Older domain/deploy notes | Retired production API pattern | Replaced with `https://api.workphelo.com/api/v1`. |
| `https://workphelo.com/{tenantSlug}` app links | Older domain guidance | Wrong after landing page split | Replaced with `https://app.workphelo.com/{tenantSlug}` pattern. |
| NestJS starter README content | Several service READMEs | Not WorkPhelo-specific | Replaced with concise service-specific README files. |

## Missing Documentation

These implemented areas need deeper follow-up documentation beyond this
environment refresh:

- Tenant branding frontend bootstrap and upload lifecycle once asset upload is implemented.
- HR employee import apply/import execution path; current implementation documents template and dry-run only.
- Reinsurance frontend integration status for endorsement notes, documents, email and cash-call flows.
- Production readiness for Reinsurance, Subscription and Marketing services once those services are added to prod compose.
- S3 document storage operational runbook, including bucket policy, IAM role and signed URL support process.
- Mailbox provider setup for outbound placement email and email thread sync.
- Detailed Swagger example coverage gaps for older HR, subscription and marketing endpoints.
- Architecture diagrams should be regenerated as real diagrams; current docs are text-first.
- Screenshot-based onboarding is not present in the repo and should be added only when screenshots can be kept current.

## Documentation Drift

| Area | Implementation truth | Drift found |
|---|---|---|
| Domain model | App uses `app.workphelo.com`; API uses `api.workphelo.com`; dev uses `dev-app` and `dev-api`. | Some docs still used old IP and Datrix dev host as primary. |
| Prod deployed services | Prod compose includes web, gateway, auth, HR, notification and Redis. | Some docs implied all backend services deploy to prod. |
| Dev deployed services | Dev compose includes subscription, marketing and reinsurance. | Some docs did not distinguish dev-only services. |
| Swagger availability | `ENABLE_SWAGGER`/`DEPLOY_ENV` gate docs; dev enables Swagger. | Some docs listed production Swagger as always available. |
| API routing | Browser calls should be same-origin `/api/v1`; direct API clients use API subdomains. | Some docs overemphasized direct API host usage for browser flows. |
| Deployment branch model | `dev` auto-deploys dev; `prod` auto/manual deploys prod. | Root README mentioned `main` as production. |
| Postman package | Collection exists under `docs/postman/` in this repository snapshot. | README still called it local-only ignored material. |

## Recommended Updates

Completed in this branch:

- Created `docs/platform/current-environments.md` as the source of truth.
- Created `docs/processes/documentation-maintenance.md`.
- Refreshed root README environment and branch strategy.
- Refreshed deployment and domain-routing docs.
- Refreshed deployment operations docs for current dev/prod domains.
- Refreshed Postman docs to point at current active URLs.
- Replaced boilerplate service READMEs with WorkPhelo service summaries.

Recommended next documentation PRs:

1. Add a service-by-service Swagger coverage report after reviewing generated OpenAPI JSON from a running dev environment.
2. Add a Reinsurance frontend integration runbook after the remaining endorsement/notes/document UI work settles.
3. Add an HR import operator guide when apply/import is implemented.
4. Add a tenant branding guide after frontend branding bootstrap and S3 upload are implemented.
5. Add a production Reinsurance enablement runbook before adding reinsurance-service to prod compose.
6. Add diagram assets for deployment topology, request routing and microservice boundaries.

## Broken Links Not Automatically Resolved

- Live DNS, Vercel, OAuth provider dashboards, Nginx server blocks and GitHub
  environment values were inferred from repository configuration and prior
  deployment context. They were not modified or externally verified by this
  docs-only branch.
- Service Swagger reachability was documented from gateway routes and workflow
  flags, but this branch did not start remote services or call live Swagger URLs.
- Any screenshots outside the repository were not audited.

## Maintenance Notes

- Keep `docs/platform/current-environments.md` updated before changing domain
  references elsewhere.
- Avoid duplicating environment tables in module docs. Link to the source of
  truth instead.
- Treat `workphelo.com` as the public landing page only; app links belong on
  `app.workphelo.com`.
