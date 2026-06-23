# WorkPhelo Postman Testing Package

This folder contains repository-owned Postman assets for API smoke testing
through the API Gateway.

Current environment URLs are maintained in
[`../platform/current-environments.md`](../platform/current-environments.md).

## Files

| File | Purpose |
|---|---|
| `WorkPhelo-Dev.postman_collection.json` | Request collection for development API testing. |
| `WorkPhelo-Dev.postman_environment.json` | Development environment variables. |
| `WorkPhelo-Prod.postman_environment.json` | Production environment variables. Use carefully. |
| `TESTING_GUIDE.md` | Manual API testing flows. |

## Import

1. Open Postman.
2. Import the collection and the environment files.
3. Select `WorkPhelo Dev` for normal testing.
4. Set `tenantSlug`, `email`, `password` and any IDs needed by the flow.
5. Run `Authentication / Login`.

## Base URLs

| Environment | `baseUrl` |
|---|---|
| Dev | `https://dev-api.workphelo.com/api/v1` |
| Prod | `https://api.workphelo.com/api/v1` |

Production testing should be limited to approved smoke checks. Do not run create,
import, payment or destructive flows against production unless a release runbook
explicitly says to.

## Auth Notes

WorkPhelo auth is cookie-first. Login sets HTTP-only cookies. The collection
stores `accessToken` and `refreshToken` when a response body includes them, but
Postman's cookie jar may be enough for most authenticated requests.

## HR Import

Use:

- `HR / Employee Import / Download Template`
- `HR / Employee Import / Dry Run Import`

For dry-run, attach a CSV in multipart form-data field `file`.

Dry-run validates rows and records import job/row metadata. It does not create
employees, auth users, leave balances or notification events.

## Swagger URLs

Swagger is expected to be enabled in dev and normally disabled in prod.

### Development

- API Gateway: `https://dev-api.workphelo.com/docs`
- Auth: `https://dev-api.workphelo.com/api/v1/auth/docs`
- HR: `https://dev-api.workphelo.com/api/v1/hr/docs`
- Notification: `https://dev-api.workphelo.com/api/v1/notification/docs`
- Subscription: `https://dev-api.workphelo.com/api/v1/subscription/docs`
- Marketing: `https://dev-api.workphelo.com/api/v1/marketing/docs`
- Reinsurance: `https://dev-api.workphelo.com/api/v1/operations/reinsurance/docs`

### Production

Production Swagger is normally disabled. If it is temporarily enabled for
support, use the same service paths under `https://api.workphelo.com/api/v1`.

## Service Availability

| Service | Dev | Prod |
|---|---|---|
| Auth | Available | Available |
| HR | Available | Available |
| Notification | Available | Available |
| Subscription | Available | Not deployed in current prod compose |
| Marketing | Available | Not deployed in current prod compose |
| Reinsurance | Available | Not deployed in current prod compose |

## Troubleshooting

- `401 Unauthorized`: login again, check cookie jar and selected environment.
- `503 Service is not configured`: the gateway does not have that downstream in the target environment.
- Multipart file missing: ensure form-data key is exactly `file`.
- Swagger 404/503 in prod: expected unless production Swagger has been explicitly enabled.
