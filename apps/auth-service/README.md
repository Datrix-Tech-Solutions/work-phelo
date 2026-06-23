# WorkPhelo Auth Service

The Auth Service owns platform authentication, tenants, users, roles,
permissions, invite flows, OAuth callbacks and tenant branding metadata.

Current environment URLs are maintained in
[`../../docs/platform/current-environments.md`](../../docs/platform/current-environments.md).

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

Production app links should use `https://app.workphelo.com`. Development app
links should use `https://dev-app.workphelo.com`.
