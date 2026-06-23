# Documentation Maintenance Process

Last reviewed: 2026-06-23

Documentation is part of the product. Every feature, deployment change and API
contract change should leave the repository docs in a truthful state.

## Source of Truth

Use `docs/platform/current-environments.md` as the canonical source for:

- active frontend and API domains
- Swagger/OpenAPI URLs
- deployed service inventory
- branch-to-environment mapping
- deployment targets and compose files
- retired domains and URLs

Other documents should link to that file instead of duplicating environment
tables unless the duplication is necessary for a runbook.

## When Documentation Must Be Updated

Update documentation in the same PR when any of these change:

- public or internal URLs
- OAuth callback URLs
- CORS or cookie settings
- GitHub Actions workflows
- deployment scripts or Docker Compose services
- service ports or gateway route prefixes
- Swagger availability or route paths
- API request/response contracts
- permissions or RBAC requirements
- data migrations that affect operators or support teams
- operational runbooks, rollback steps or smoke-test checklists
- Postman collections or testing instructions

## PR Checklist

Every PR author should answer:

- Does this change add, remove or rename an API endpoint?
- Does this change add, remove or rename an environment variable?
- Does this change affect deployment, health checks, migrations or seeding?
- Does this change affect frontend routes, deep links, invite links or email links?
- Does this change affect Swagger examples or Postman testing flows?
- Does this change introduce a new service, queue, provider or storage dependency?

If any answer is yes, update docs before requesting review.

## Release Checklist

Before merging to `dev` or `prod`, confirm:

- `README.md` points to current environment docs.
- `docs/platform/current-environments.md` matches workflow/compose values.
- Swagger URLs are accurate for the target environment.
- Deployment docs match `.github/workflows/*`, `.github/scripts/*` and `infrastructure/docker-compose.*.yml`.
- Any new provider credentials are documented by variable name without secret values.
- Postman docs and testing guides mention new flows or known gaps.
- Rollback notes still match the deployed architecture.

## Deployment Checklist

When deployment configuration changes:

1. Update `docs/platform/current-environments.md`.
2. Update `docs/deployment.md` and `docs/deployment-operations.md` if the workflow or runtime model changed.
3. Update `docs/domain-routing.md` if domains, Nginx assumptions, OAuth callbacks or CORS changed.
4. Update service README files if deployed service inventory changed.
5. Add an audit note under `docs/audits/` for large cross-cutting documentation refreshes.

## Ownership

| Area | Primary owner |
|---|---|
| Platform domains, deployment and CI/CD | Backend/platform implementer for the PR |
| API contracts and Swagger examples | Service owner changing the endpoint |
| Frontend route/deep-link behavior | Frontend implementer changing the route |
| Postman package and testing guide | Implementer adding or changing testable workflows |
| Release notes and runbooks | Person preparing the release branch |

If ownership is unclear, the PR author owns the documentation update until a
reviewer explicitly takes it.

## Documentation Audit Cadence

- Run a lightweight docs drift check before every production release.
- Run a full repository documentation audit at least monthly while WorkPhelo is
  changing quickly.
- Keep dated audit reports in `docs/audits/`.

Suggested commands:

```bash
rg -n "157\\.245\\.220\\.205|workphelo\\.datrixtechsolutions\\.com|workphelo\\.com/api/v1|localhost:[0-9]+/api" README.md docs apps/*/README.md
rg -n "NEXT_PUBLIC_API_URL|AUTH_FRONTEND_BASE_URL|ALLOWED_ORIGINS|ENABLE_SWAGGER" .github infrastructure docs README.md
```

## Rules

- Do not document secret values.
- Do not document unverified production behavior as active.
- Do not add new `workphelo.com/api/v1` references; production API traffic uses `api.workphelo.com/api/v1`.
- Do not add new application links under `workphelo.com/{tenantSlug}`; application links use `app.workphelo.com`.
- If a legacy host must remain for compatibility, label it clearly as legacy.
