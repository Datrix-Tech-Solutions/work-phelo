# WorkPhelo Auth Service

The Auth Service owns platform authentication, tenants, users, roles,
permissions, invite flows, OAuth callbacks and tenant branding metadata.

Current environment URLs are listed in the root repository README.

## Responsibilities

- Login, refresh, logout and profile/session APIs.
- Platform and tenant user management.
- Tenant creation and tenant admin invitation flows.
- Invite resend and accept-invite flows.
- Password reset and account activation links.
- RBAC/permission resources and user permission sets.
- Tenant branding foundation.
- OAuth callback handling for Google and Microsoft.

## Gateway Prefix

```text
/api/v1/auth/*
```

## Local Development

```bash
npm run dev --workspace=apps/auth-service
```

Default local port: `4001`

Local Swagger: `http://localhost:4001/docs`

## Deployed Swagger

| Environment | Swagger                                          |
| ----------- | ------------------------------------------------ |
| Dev         | `https://dev-api.workphelo.com/api/v1/auth/docs` |
| Prod        | Normally disabled                                |

## Key Environment Variables

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_SECRET`
- `RABBITMQ_URL`
- `REDIS_URL`
- `FRONTEND_BASE_URL`
- `APP_URL`
- `FRONTEND_URL`
- `COOKIE_SECURE`
- `COOKIE_SAME_SITE`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_CALLBACK_URL`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD` for local seed scripts
- `INTERNAL_SERVICE_AUTH_SECRET`
- `INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES`
- `INTERNAL_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS`
- `AUTH_TENANT_ASSET_STORAGE_PROVIDER`
- `AUTH_TENANT_ASSET_S3_BUCKET`
- `AUTH_TENANT_ASSET_S3_REGION`
- `AUTH_TENANT_ASSET_S3_PREFIX`
- `AUTH_TENANT_ASSET_SIGNED_URL_TTL_SECONDS`

Production app links should use `https://app.workphelo.com`. Development app
links should use `https://dev-app.workphelo.com`.

Tenant document profile and branding APIs store private tenant identity assets,
signatories and bank details for downstream document rendering. Asset storage
uses the configured tenant asset provider; API responses and docs must not
expose private object keys or credentials.
