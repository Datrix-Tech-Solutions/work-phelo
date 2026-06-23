# WorkPhelo — Security Architecture

## AI Agent Context Summary

WorkPhelo's security model has five main layers: (1) network — Nginx SSL termination, loopback-only service bindings; (2) authentication — JWT in httpOnly cookies, 15-minute access tokens, 8-hour refresh tokens; (3) gateway enforcement — public route bypass list, per-user permission cache (5 min), header injection; (4) RBAC — three system roles, 35+ resources, 8 actions, semantic→resource:action mapping; (5) data protection — AES-256-GCM field-level encryption for 10 employee PII fields. The JWT payload contains no permissions — the gateway fetches them live from auth-service. Permissions are never embedded in the token. TENANT_ADMIN and SUPER_ADMIN bypass all permission checks. Account lockout fires after 5 failed login attempts for 30 minutes.

---

## Authentication

### JWT tokens

| Token | Location | TTL | Signing secret |
|---|---|---|---|
| `access_token` | httpOnly cookie | 15 minutes | `JWT_ACCESS_SECRET` |
| `refresh_token` | httpOnly cookie | 8 hours | `JWT_REFRESH_SECRET` |

**Cookie options (from `apps/auth-service/src/common/cookie.helper.ts`):**

```typescript
res.cookie('access_token', accessToken, {
  httpOnly: true,
  secure: COOKIE_SECURE,          // env var — true in prod
  sameSite: COOKIE_SAME_SITE,     // env var — 'none' cross-origin, 'lax' same-site
  maxAge: 15 * 60 * 1000,         // 15 minutes
  path: '/',
});
res.cookie('refresh_token', refreshToken, {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: COOKIE_SAME_SITE,
  maxAge: 8 * 60 * 60 * 1000,     // 8 hours
  path: '/',
});
```

Cookies are httpOnly — inaccessible to JavaScript. `secure: true` in production prevents transmission over plaintext HTTP. `sameSite` is controlled by environment. The current app/API split uses app-host same-origin browser calls through `/api/v1`, so dev and prod use `lax`; do not switch to cross-site cookie behavior without reviewing CORS, OAuth callbacks and CSRF together.

### JWT payload

```typescript
// What's IN the JWT (from auth.service.ts signAccessToken):
{
  sub: userId,
  email,
  role,           // SUPER_ADMIN | TENANT_ADMIN | EMPLOYEE
  tenantId,
  tenantSlug,
  tenantName,
  firstName,
  moduleConfig,   // { hr: boolean, accounting: boolean, marketing: boolean }
  featureConfig,  // { leave: boolean, payroll: boolean, ... }
}

// What's NOT in the JWT:
// permissions — fetched live by the gateway from auth-service /me
```

Permissions were removed from the JWT because accumulating permission sets grew the serialised payload large enough to exceed browser cookie limits and cause Nginx `502 Bad Gateway` on `upstream sent too big header`. See ADR-001.

### Token refresh

`POST /api/v1/auth/refresh` — gateway public route (bypasses JWT check). Auth service validates the `refresh_token` cookie, issues a new access token, and rotates the refresh token.

### Logout

- `POST /auth/logout` — clears both cookies for the current device; invalidates the refresh token.
- `POST /auth/logout-all` — invalidates all refresh tokens for the user across all devices.

---

## API Gateway Enforcement

The gateway (`apps/api-gateway/src/proxy/proxy.controller.ts`) is the single entry point for all frontend HTTP traffic. It enforces authentication before forwarding to any downstream service.

### Public routes (no JWT required)

These 13 patterns bypass JWT validation entirely:

```typescript
const PUBLIC_PATTERNS = [
  /^\/api\/v1\/auth\/login$/,
  /^\/api\/v1\/auth\/admin\/login$/,
  /^\/api\/v1\/auth\/refresh$/,
  /^\/api\/v1\/auth\/verify-email$/,
  /^\/api\/v1\/auth\/resend-verification$/,
  /^\/api\/v1\/auth\/forgot-password$/,
  /^\/api\/v1\/auth\/reset-password$/,
  /^\/api\/v1\/auth\/force-reset-password$/,
  /^\/api\/v1\/auth\/google(?:\/callback)?$/,
  /^\/api\/v1\/auth\/microsoft(?:\/callback)?$/,
  /^\/api\/v1\/auth\/tenants\/register$/,
  /^\/api\/v1\/auth\/users\/accept-invite$/,
  /^\/api\/v1\/auth\/mfa\/send-sms$/,
];
```

### JWT validation (all other routes)

1. Gateway reads `access_token` cookie or `Authorization: Bearer <token>` header.
2. Verifies signature and expiry using `JWT_SECRET`.
3. If invalid or expired: returns `401`.
4. If valid: extracts claims from the payload.

### Permission resolution

After JWT validation, for non-auth service routes:

1. Gateway calls `auth-service GET /me` using the user's access token cookie.
2. Auth service returns `{ user, permissions[] }` — the merged list of active `UserPermission` grants and `PermissionSetResource` entries from all assigned active permission sets.
3. Gateway caches the result in an in-process `Map` keyed by `userId` for 5 minutes (`PERM_CACHE_TTL = 5 * 60 * 1000`).
4. On cache hit within TTL: uses cached permissions without calling auth-service.
5. On cache miss: re-fetches from auth-service.

**Consequence:** permission changes (grants, revocations, set modifications) take effect within at most 5 minutes.

### Auth context headers

After validation and permission resolution, the gateway injects these headers before proxying to downstream services:

| Header | Value |
|---|---|
| `x-user-id` | `payload.sub` |
| `x-user-email` | `payload.email` |
| `x-user-role` | `payload.role` |
| `x-tenant-id` | `payload.tenantId` |
| `x-tenant-slug` | `payload.tenantSlug` |
| `x-tenant-name` | `payload.tenantName` |
| `x-user-first-name` | `payload.firstName` |
| `x-user-permissions` | `JSON.stringify([...permissions])` |

Downstream services trust these headers completely — they do not re-validate the JWT. This is safe only because all traffic must pass through the gateway.

---

## RBAC Model

WorkPhelo uses a 5-layer access control model:

```
Layer 1: System actor (user.role)
  └─ SUPER_ADMIN | TENANT_ADMIN | EMPLOYEE

Layer 2: Company role (tenant-scoped business role)
  └─ Company Admin | Manager | Employee

Layer 3: Semantic permission (Permission enum)
  └─ REQUEST_LEAVE | MANAGE_LEAVE_TYPES | APPROVE_LEAVE | ...

Layer 4: Resource:Action (stored runtime permission)
  └─ leave:APPROVE | leave-self:CREATE | employees:VIEW | ...

Layer 5: Scope (enforced in service logic)
  └─ own only | team only | company-wide
```

### System roles

| Role | Scope | Permission checks |
|---|---|---|
| `SUPER_ADMIN` | Platform-wide | Bypasses all permission checks — implicit access to everything |
| `TENANT_ADMIN` | Own tenant | Bypasses all permission checks — implicit access within tenant |
| `EMPLOYEE` | Own tenant | Governed entirely by permission sets and direct grants |

`TENANT_ADMIN` is the system-level role flag, not a company role. A user with `EMPLOYEE` system role can be assigned broad permissions that make them a functional "Company Admin" — this is done via the `Company Admin` permission set.

### Resources (35 platform-defined, seeded into `w_auth.Resource`)

Auth module:
`users`, `user-security`, `tenants`, `permission-sets`, `audit-logs`

HR module:
`employees`, `employee-profile`, `offboarding`, `resignations`, `departments`, `branches`, `hr-settings`, `leave`, `leave-self`, `leave-settings`, `attendance`, `timesheets`, `time-corrections`, `schedules`, `payroll`, `payslip-self`, `appraisals`, `appraisal-settings`, `self-appraisals`, `appraisal-reviews`, `assets`, `projects`, `project-tasks`, `announcements`, `documents`, `allowances`, `payroll-reports`, `expense-reports`

Platform:
`platform-settings`, `subscriptions`

Source of truth: `apps/auth-service/prisma/seed-resources.ts`

### Actions

`VIEW` | `CREATE` | `EDIT` | `DELETE` | `APPROVE` | `RUN` | `EXPORT` | `ASSIGN`

### Semantic permission mapping

Semantic permissions (`Permission` enum in `@work-phelo/config`) map to resource:action strings in `apps/auth-service/src/tenants/tenant-lifecycle.service.ts`. Examples:

| Semantic permission | Resource:action |
|---|---|
| `REQUEST_LEAVE` | `leave-self:CREATE` |
| `READ_OWN_PROFILE` | `employee-profile:VIEW` |
| `READ_OWN_PAYSLIP` | `payslip-self:VIEW` |
| `APPROVE_LEAVE` | `leave:APPROVE` |
| `APPROVE_TEAM_TIME` | `time-corrections:APPROVE` |
| `MANAGE_LEAVE_TYPES` | `leave-settings:EDIT` |
| `CONFIGURE_APPRAISAL` | `appraisals:EDIT` |
| `SUBMIT_SELF_ASSESSMENT` | `self-appraisals:EDIT` |

Controllers use `@RequirePermissions(Permission.REQUEST_LEAVE)`. The guard translates this to the expected resource:action and compares against the injected `x-user-permissions` header.

### Default permission sets

Seeded per tenant for three default company roles in `COMPANY_ROLE_PERMISSIONS` (`packages/config/src/permissions.ts`):

- **Company Admin** — broad access, most write operations
- **Manager** — team-scoped read/approve
- **Employee** — self-service only (own profile, own leave, own payslip)

These default sets cannot be deleted. Tenants can create additional custom permission sets.

### Guard pattern (preferred for new controllers)

```typescript
@Controller('leave')
@UseGuards(JwtAuthGuard, ModuleGuard, FeatureGuard, PermissionsGuard)
@RequireModule('hr')
@RequireFeature('hr', 'leave')
export class LeaveController {
  @Post()
  @RequirePermissions(Permission.REQUEST_LEAVE)
  createLeaveRequest() { ... }
}
```

This gives: authentication → module enabled → feature enabled → permission granted.

---

## Account Security

### Account lockout

Implemented in `apps/auth-service/src/auth/auth.service.ts`:

```typescript
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 30
```

After 5 consecutive failed login attempts, the account is locked for 30 minutes. The lock is stored on the `User` record (`failedLoginAttempts`, `lockedUntil`). A successful login resets the counter.

### MFA

Two MFA methods are supported:

| Method | How it works |
|---|---|
| TOTP | Compatible with Google Authenticator and similar apps. Secret stored on user record. |
| SMS OTP | 6-digit code sent via Termii SMS API. Code stored in `auth.OtpCode`. |

MFA is opt-in per user. On login, if MFA is enabled: auth returns `{ requiresMfa: true, userId }`. Client must call the appropriate MFA verify endpoint before a session cookie is issued.

### Password reset rate limiting

Maximum 3 OTP codes per hour per user, tracked in `auth.OtpCode` (not Redis). Applies to forgot-password flows only.

### Force password reset

If `User.forcePasswordReset = true`, the auth service intercepts login and redirects to the force-reset flow before issuing a session. Used when an admin resets a user's password on their behalf.

### OAuth2

Google OAuth2 and Microsoft OAuth2 are supported as optional login paths. Configured via `GOOGLE_CLIENT_ID/SECRET/CALLBACK_URL` and `MICROSOFT_CLIENT_ID/SECRET/CALLBACK_URL` env vars. OAuth2 routes are in the public patterns list.

---

## Field-Level Encryption (PII)

Employee PII fields are encrypted at rest using AES-256-GCM before storage in the database.

**Status: Phases 1 and 2 implemented.** See `docs/security/field-level-encryption.md` for full implementation reference.

### Encrypted fields (hr schema)

The following employee fields are encrypted:

- `personalEmail`
- `phone`
- `address`
- `emergencyContactName`
- `emergencyContactPhone`
- `emergencyContactRelationship`
- `nationalId`
- `taxId`
- `socialSecurityNumber`
- `bankAccountNumber`

### Implementation

- **Algorithm:** AES-256-GCM
- **Service:** `FieldEncryptionService` in hr-service (Node.js `crypto` module — no third-party library)
- **Encryption key:** `FIELD_ENCRYPTION_KEY` — 64-character hex string (32-byte key), runtime env var
- **HMAC key:** `FIELD_HMAC_KEY` — 64-character hex string for email hashing/indexing, runtime env var
- **GitHub secrets:** `HR_FIELD_ENCRYPTION_KEY` and `HR_FIELD_HMAC_KEY` (deploy scripts map these to runtime names)

Each encrypted value stores `iv:authTag:ciphertext` in a single string field. The IV is randomised per encryption.

### Key management

Keys are injected from environment variables at runtime. They are stored as GitHub Actions secrets and never committed to the repository. Rotation requires re-encryption of all affected records (a planned future phase).

---

## Tenant Isolation

All database queries filter by `tenantId` as a leading condition. This is enforced by convention, not framework.

Key rules:
- All auth-service queries scope to `tenantId` from the JWT `payload.tenantId`.
- All hr-service queries scope to `tenantId` from the `x-tenant-id` header (set by gateway from JWT).
- Client-supplied FK IDs (e.g. `branchId`, `departmentId`) are validated with a `findFirst({ where: { id, tenantId } })` before use — prevents cross-tenant ID injection.
- `tenantId` and `userId` sourced from JWT headers are trusted directly (no second lookup needed).

Cross-tenant data leakage is the highest-risk misconfiguration. Any new query that touches tenant-scoped data must include `tenantId` in its `where` clause.

---

## Network Security

### Nginx as the only public listener

All services bind to `127.0.0.1` (loopback). Only Nginx binds to `0.0.0.0:443`. The topology is:

```
Internet
  └─ Nginx :443 (SSL termination, public)
       ├─ Next.js :3001 (loopback only)
       └─ API Gateway :4110 (loopback only)
            ├─ Auth Service :4101 (loopback only)
            ├─ HR Service :4102 (loopback only)
            └─ Notification Service :4104 (loopback only)
```

Services are not directly reachable from the internet — all traffic must pass through Nginx → Gateway.

### SSL

Let's Encrypt via Certbot. Certificates auto-renewed. TLS termination at Nginx.

### Nginx proxy buffer sizes

The `x-user-permissions` header can be several KB for users with many permission sets. Without large buffer config, Nginx will return `502 Bad Gateway` with `upstream sent too big header`. Required Nginx config:

```nginx
location /api/v1/ {
  proxy_pass http://127.0.0.1:4110/api/v1/;
  proxy_buffer_size 128k;
  proxy_buffers 8 128k;
  proxy_busy_buffers_size 256k;
}
```

---

## Threat Model (Summary)

| Threat | Mitigation |
|---|---|
| Session hijacking | httpOnly cookies (inaccessible to JS), `secure: true` in prod |
| CSRF | `sameSite` cookie attribute; short 15-minute access token window |
| Brute force login | Account lockout after 5 attempts, 30-minute lockout |
| Cross-tenant data access | `tenantId` scoping on all DB queries; FK validation on client-supplied IDs |
| Horizontal privilege escalation | Permission sets per tenant; RBAC guard on every endpoint |
| Stale permissions post-revoke | Gateway cache expires within 5 minutes |
| PII exposure at rest | AES-256-GCM field encryption on 10 employee PII fields |
| Internal service spoofing | Services only accessible via loopback; gateway injects auth context headers |
| Large header injection | Nginx buffer sizing prevents 502 on large permission payloads |
| JWT secret mismatch | `JWT_SECRET` must match between gateway and auth-service — env validated at startup |
| Missing env vars | All services throw at startup if required env vars are absent — no silent fallbacks |

---

## Security Checklist for New Features

1. Does the endpoint require authentication? Add `JwtAuthGuard`.
2. Is it module/feature-gated? Add `ModuleGuard`/`FeatureGuard` with `@RequireModule`/`@RequireFeature`.
3. What permission is required? Add `PermissionsGuard` and `@RequirePermissions(Permission.X)`.
4. What is the data scope? Enforce own/team/company in service logic — not just guards.
5. Are client-supplied FK IDs validated against `tenantId`? Add `findFirst({ where: { id, tenantId } })`.
6. Does the feature expose PII? Consider whether it needs field-level encryption.
7. Have you tested with Company Admin, Manager, and Employee accounts?
8. Have you verified direct API access (not just UI) returns `403` for unauthorized roles?
