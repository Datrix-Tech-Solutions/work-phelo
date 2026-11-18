# WorkPhelo API Gateway

The API Gateway is the public HTTP entry point for WorkPhelo backend services.
Current environment URLs are listed in the root repository README.

## Responsibilities

- Route `/api/v1/*` requests to downstream services.
- Validate JWT cookies or bearer tokens for protected routes.
- Forward tenant/user context headers to downstream services.
- Fetch and sign dynamic permission headers for non-auth services.
- Stream multipart uploads, including HR employee import CSV uploads.
- Expose gateway Swagger when Swagger is enabled.

## Route Prefixes

| Prefix                             | Downstream service   |
| ---------------------------------- | -------------------- |
| `/api/v1/auth/*`                   | Auth Service         |
| `/api/v1/hr/*`                     | HR Service           |
| `/api/v1/notification/*`           | Notification Service |
| `/api/v1/subscription/*`           | Subscription Service |
| `/api/v1/marketing/*`              | Marketing Service    |
| `/api/v1/operations/reinsurance/*` | Reinsurance Service  |
| `/api/v1/accounting/*`             | Accounting Service   |

Downstreams must be configured for the target environment. A route can exist in
dev but return `503 Service is not configured` in prod if that service is not in
the prod deployment.

## Local Development

```bash
npm run dev --workspace=apps/api-gateway
```

Default local port: `4000`

Local Swagger: `http://localhost:4000/docs`

## Deployed URLs

| Environment | API Gateway                            |
| ----------- | -------------------------------------- |
| Dev         | `https://dev-api.workphelo.com/api/v1` |
| Prod        | `https://api.workphelo.com/api/v1`     |

Browser code should still call same-origin `/api/v1/...` from the app host.

## Key Environment Variables

- `JWT_SECRET`
- `AUTH_SERVICE_URL`
- `HR_SERVICE_URL`
- `NOTIFICATION_SERVICE_URL`
- `SUBSCRIPTION_SERVICE_URL`
- `MARKETING_SERVICE_URL`
- `REINSURANCE_SERVICE_URL`
- `ACCOUNTING_SERVICE_URL`
- `ALLOWED_ORIGINS`
- `ENABLE_SWAGGER`

Do not commit secret values.

## Optional AI Routing Foundation

`AI_SERVICE_URL` is an optional, operator-controlled HTTP(S) origin (no credentials,
path, query, or fragment). Missing or invalid configuration disables AI routing
with a 503 response without preventing ERP startup. AI is an optional health
dependency; an unreachable or unhealthy AI service does not fail Gateway health.
The health aggregator may inspect the internal `/api/health` probe, but the
business namespace does not forward `/api/v1/ai/health` or `/api/v1/ai/ready`.

The reserved `/api/v1/ai/...` namespace maps to `/api/...` using the existing
JWT verification and live Auth `/me` lookup. Forwarded assertions have audience
`ai`, expire after 30 seconds, and retain the existing token/permission hash
binding. Caller identity headers are replaced with current Auth state. Careers
and other explicitly scoped sessions cannot access AI. Existing assertion
signatures do not bind request bodies or queries; this slice does not change
that protocol or authorize any business operation.

Registration itself grants no authenticated AI operation. Phase 2A.3 adds only
`GET /api/v1/ai/eligibility`, verified by the AI service's exact handler policy
and trusted-context guard when authentication routes are enabled. Internal
probes remain excluded from this namespace, and undeclared AI handlers remain
denied. Mock downstream tests prove routing only, not live Auth/DB validation or
an available chat/inference API. `AI_ENABLED` is not consulted by Gateway and
cannot grant inference access.

A later, separately reviewed rollout must supply `AI_SERVICE_URL` through the
Gateway runtime environment. This change adds no deployment/Compose forwarding,
provider credentials, or tenant configuration. Downstream trusted-context
verification is a prerequisite before any authenticated AI handler is added.
