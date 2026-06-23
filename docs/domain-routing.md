# WorkPhelo Domain Routing Runbook

This runbook describes the production split between the public marketing site,
the SaaS application, and the API gateway.

For the canonical environment table, see
[`docs/platform/current-environments.md`](platform/current-environments.md).

## Target Domains

| Host | Owner | Purpose |
|---|---|---|
| `workphelo.com` | Vercel | Public landing page |
| `www.workphelo.com` | Vercel | Public landing page |
| `app.workphelo.com` | WorkPhelo VPS | SaaS application |
| `api.workphelo.com` | WorkPhelo VPS | API gateway |
| `dev-app.workphelo.com` | WorkPhelo VPS | Development SaaS application |
| `dev-api.workphelo.com` | WorkPhelo VPS | Development API gateway |

Platform admin remains under `https://app.workphelo.com/platform/login` for
this phase.

## DNS Records

Set a low TTL, such as `300`, before cutover.

| Name | Type | Value |
|---|---|---|
| `workphelo.com` | `A`/`ALIAS` | Vercel apex target from the Vercel dashboard |
| `www.workphelo.com` | `CNAME` | `cname.vercel-dns.com` |
| `app.workphelo.com` | `A` | Current WorkPhelo VPS public IP |
| `api.workphelo.com` | `A` | Current WorkPhelo VPS public IP |
| `dev-app.workphelo.com` | `A` | Current WorkPhelo VPS public IP |
| `dev-api.workphelo.com` | `A` | Current WorkPhelo VPS public IP |

Verify the VPS IP before applying DNS changes. Older repo notes reference
`157.245.220.205`, but DNS should use the live server IP.

## Application Routing

The WorkPhelo web app should be served from `app.workphelo.com`.

- `https://app.workphelo.com/` redirects to `/login`.
- `https://app.workphelo.com/platform/login` remains the Super Admin login.
- Tenant workspaces remain path-based, for example:
  `https://app.workphelo.com/acme-ghana/login`.
- Browser API requests should continue to use same-origin `/api/v1`.

The frontend Docker image and production Compose config should receive:

```bash
NEXT_PUBLIC_API_URL=https://api.workphelo.com/api/v1
NEXT_PUBLIC_APP_BASE_URL=https://app.workphelo.com
```

`NEXT_PUBLIC_API_URL` is used by the Next.js rewrite/proxy path. Browser code
should continue to call `/api/v1` rather than making credentialed cross-domain
requests directly to `api.workphelo.com`.

## Backend Environment

Production GitHub environment variables should be updated to:

```bash
PROD_AUTH_FRONTEND_BASE_URL=https://app.workphelo.com
PROD_ALLOWED_ORIGINS=https://app.workphelo.com,https://workphelo.com
PROD_AUTH_COOKIE_SECURE=true
PROD_AUTH_COOKIE_SAME_SITE=lax
PROD_AUTH_GOOGLE_CALLBACK_URL=https://app.workphelo.com/api/v1/auth/google/callback
PROD_AUTH_MICROSOFT_CALLBACK_URL=https://app.workphelo.com/api/v1/auth/microsoft/callback
```

`https://workphelo.com` may remain in `PROD_ALLOWED_ORIGINS` for landing page
handoffs, but application login and tenant links should use `app.workphelo.com`.

## Cookie and OAuth Notes

The auth service currently issues host-only cookies. Keep OAuth callbacks on
`app.workphelo.com` so cookies are set for the app host:

- Google: `https://app.workphelo.com/api/v1/auth/google/callback`
- Microsoft: `https://app.workphelo.com/api/v1/auth/microsoft/callback`

Do not move browser login callbacks to `api.workphelo.com` unless cookie domain,
CORS, and CSRF behavior are redesigned together.

## Nginx Server Blocks

Nginx config lives on the server. The application host should proxy both the app
and same-origin API requests:

```nginx
server {
    listen 443 ssl;
    server_name app.workphelo.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /api/v1/ {
        proxy_pass http://127.0.0.1:4110/api/v1/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffer_size 128k;
        proxy_buffers 8 128k;
        proxy_busy_buffers_size 256k;
    }
}
```

The API host should expose the gateway directly:

```nginx
server {
    listen 443 ssl;
    server_name api.workphelo.com;

    location /api/v1/ {
        proxy_pass http://127.0.0.1:4110/api/v1/;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_buffer_size 128k;
        proxy_buffers 8 128k;
        proxy_busy_buffers_size 256k;
    }
}
```

Issue certificates before production cutover:

```bash
sudo certbot --nginx -d app.workphelo.com -d api.workphelo.com
sudo nginx -t
sudo systemctl reload nginx
```

## Rollout Plan

1. Create `app.workphelo.com` and `api.workphelo.com` DNS records pointing to
   the VPS.
2. Add Nginx server blocks and SSL certificates for both subdomains.
3. Update GitHub production environment values for app URL, allowed origins, and
   OAuth callback URLs.
4. Deploy the app/API domain config.
5. Smoke test:
   - `https://app.workphelo.com/login`
   - `https://app.workphelo.com/platform/login`
   - tenant login and tenant dashboard
   - token refresh and logout
   - invite/reset/deep links
   - Google/Microsoft OAuth callbacks
   - `https://app.workphelo.com/api/v1/auth/me`
   - `https://api.workphelo.com/api/v1/health` if exposed by the gateway
6. Point `workphelo.com` and `www.workphelo.com` to Vercel.
7. Update landing page CTAs to link to `https://app.workphelo.com/login`.

## Rollback Plan

1. Repoint `workphelo.com` and `www.workphelo.com` DNS back to the VPS.
2. Redeploy production from the previous known-good image/SHA if needed.
3. Keep `app.workphelo.com` and `api.workphelo.com` DNS records in place; they
   are additive and do not require database rollback.

## Risks

- OAuth callbacks on `api.workphelo.com` will not set host-only cookies for
  `app.workphelo.com`.
- Hardcoded `workphelo.com/{tenantSlug}` links can send users to the landing
  page instead of the app.
- Nginx buffer settings must remain on `/api/v1/` because permission headers can
  exceed default proxy buffers.
- During cutover, stale DNS can send some users to the old root while others see
  Vercel. Keep TTL low and communicate the window.
