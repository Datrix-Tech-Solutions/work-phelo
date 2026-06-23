# WorkPhelo — API Contract

## API Gateway Contract

**Base URL (production):** `https://api.workphelo.com/api/v1`
**Base URL (dev):** `https://dev-api.workphelo.com/api/v1`
**Base URL (local):** `http://localhost:4000/api/v1`

See [`docs/platform/current-environments.md`](platform/current-environments.md)
for the current frontend, API and Swagger URL matrix.

**Route forwarding pattern:**
```
/api/v1/<service>/<path> → <SERVICE_URL>/<path>
```
The gateway strips `/api`, `/v1`, and the service segment. Query strings are preserved.

**Auth:** JWT access token in `access_token` httpOnly cookie, or `Authorization: Bearer <token>` header.

**Auth context headers injected by gateway (downstream services read these):**
| Header | Value |
|---|---|
| `x-user-id` | User UUID from JWT `sub` |
| `x-user-email` | User email from JWT |
| `x-user-role` | `SUPER_ADMIN`, `TENANT_ADMIN`, or `EMPLOYEE` |
| `x-tenant-id` | Tenant UUID |
| `x-tenant-slug` | Tenant slug (e.g. `acme-ghana`) |
| `x-tenant-name` | Tenant display name |
| `x-user-first-name` | User first name |
| `x-company-role-id` | User company role ID when present |
| `x-user-permissions` | JSON-stringified array of `"resource:action"` strings |

**Public routes (no JWT required):**
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/admin/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/verify-email`
- `POST /api/v1/auth/resend-verification`
- `POST /api/v1/auth/forgot-password`
- `POST /api/v1/auth/reset-password`
- `POST /api/v1/auth/force-reset-password`
- `GET /api/v1/auth/google` + `/callback`
- `GET /api/v1/auth/microsoft` + `/callback`
- `POST /api/v1/auth/tenants/register`
- `POST /api/v1/auth/users/accept-invite`
- `POST /api/v1/auth/mfa/send-sms`

**Service unavailable:** If a service is not configured (env var missing), gateway returns `503 { message, availableServices }`.

---

## Auth Service APIs

Swagger: `http://localhost:4001/docs`

### Authentication

#### POST `/api/v1/auth/login`
Login with email and password.

**Auth required:** No
**Body:**
```json
{ "tenantSlug": "acme-ghana", "email": "admin@acmeghana.com", "password": "Admin123!" }
```
**Response 200:** Tokens set as httpOnly cookies. Body: `{ user: { id, email, role, tenantId, tenantSlug, tenantName, firstName, moduleConfig, featureConfig } }`
**Response 200 (MFA required):** `{ requiresMfa: true, userId: "...", mfaMethod: "TOTP|SMS" }`
**Response 200 (force reset):** `{ requiresPasswordReset: true, userId: "..." }`
**Response 401:** Invalid credentials
**Response 403:** Tenant suspended or user inactive

---

#### POST `/api/v1/auth/admin/login`
SuperAdmin login (platform owner only).

**Auth required:** No
**Body:** `{ "email": "...", "password": "..." }`
**Response 200:** Tokens set as cookies
**Response 401:** Not a SuperAdmin

---

#### POST `/api/v1/auth/refresh`
Rotate access and refresh tokens using `refresh_token` cookie.

**Auth required:** No (reads cookie)
**Response 200:** New tokens set as cookies
**Response 401:** Invalid refresh token

---

#### POST `/api/v1/auth/logout`
Logout current device. Revokes refresh token, clears cookies.

**Auth required:** No (reads cookie)
**Response 200:** `{ message: "Logged out successfully" }`

---

#### POST `/api/v1/auth/logout-all`
Logout all devices. Revokes all refresh tokens.

**Auth required:** Yes
**Response 200:** `{ message: "Logged out from all devices" }`

---

#### GET `/api/v1/auth/me`
Get current authenticated user with permissions.

**Auth required:** Yes
**Response 200:**
```json
{
  "user": { "id", "email", "role", "tenantId", "tenantSlug", "tenantName", "firstName", "moduleConfig", "featureConfig" },
  "permissions": ["read:employees", "approve:leave", ...]
}
```

---

#### POST `/api/v1/auth/verify-email`
Verify email with OTP code sent on registration.

**Auth required:** No
**Body:** `{ "tenantSlug": "...", "email": "...", "code": "123456" }`
**Response 200:** Email verified
**Response 401:** Invalid or expired OTP

---

#### POST `/api/v1/auth/resend-verification`
Resend email verification OTP.

**Auth required:** No
**Body:** `{ "tenantSlug": "...", "email": "..." }`

---

#### POST `/api/v1/auth/forgot-password`
Request password reset (email link + SMS OTP).

**Auth required:** No
**Body:** `{ "tenantSlug": "...", "email": "..." }`
**Notes:** Rate limited to 3 OTP codes per hour per user.

---

#### POST `/api/v1/auth/reset-password`
Reset password using email link token or SMS OTP.

**Auth required:** No
**Body (via email link):** `{ "token": "123456", "newPassword": "..." }`
**Body (via OTP):** `{ "otpCode": "123456", "email": "...", "newPassword": "..." }`

---

#### POST `/api/v1/auth/change-password`
Change password (requires current password).

**Auth required:** Yes
**Body:** `{ "currentPassword": "...", "newPassword": "..." }`

---

#### POST `/api/v1/auth/force-reset-password`
Complete forced password reset from login flow.

**Auth required:** No
**Body:** `{ "userId": "...", "newPassword": "..." }`
**Response 200:** Tokens set as cookies

---

### MFA

#### POST `/api/v1/auth/mfa/setup-totp`
Setup TOTP MFA. Returns QR code and secret.

**Auth required:** Yes
**Response 200:** `{ qrCodeUrl: "...", secret: "..." }`

---

#### POST `/api/v1/auth/mfa/verify-totp`
Verify TOTP code and enable MFA.

**Auth required:** No
**Body:** `{ "userId": "...", "totpCode": "123456" }`

---

#### POST `/api/v1/auth/mfa/send-sms`
Send SMS OTP to registered phone number.

**Auth required:** No
**Body:** `{ "userId": "..." }`

---

#### POST `/api/v1/auth/mfa/verify-sms`
Verify SMS OTP and enable SMS MFA.

**Auth required:** Yes
**Body:** `{ "otpCode": "123456" }`

---

#### POST `/api/v1/auth/mfa/disable`
Disable MFA (requires TOTP code).

**Auth required:** Yes
**Body:** `{ "totpCode": "123456" }`

---

### Tenant Management

#### POST `/api/v1/auth/tenants/register`
Register a new company (SuperAdmin only).

**Auth required:** Yes (SUPER_ADMIN role)
**Body:** `{ name, slug, email, password, firstName, lastName, phone, country, industry, size }`
**Response 201:** `{ message, tenantId, tenantName, tenantSlug, workspaceUrl, userId }`
**Response 409:** Email or slug already exists

---

#### GET `/api/v1/auth/tenants`
List tenants. SuperAdmin sees all; Tenant Admin sees own only.

**Auth required:** Yes
**Query:** `?status=ACTIVE&search=acme`

---

#### GET `/api/v1/auth/tenants/:id`
Get tenant by ID.

**Auth required:** Yes

---

#### PATCH `/api/v1/auth/tenants/:id`
Update tenant details (SuperAdmin only).

**Auth required:** Yes (SUPER_ADMIN)

---

#### PATCH `/api/v1/auth/tenants/:id/approve`
Approve pending tenant (SuperAdmin only).

**Auth required:** Yes (SUPER_ADMIN)

---

#### PATCH `/api/v1/auth/tenants/:id/suspend`
Suspend active tenant (SuperAdmin only).

**Auth required:** Yes (SUPER_ADMIN)

---

#### PATCH `/api/v1/auth/tenants/:id/deactivate`
Deactivate active tenant (SuperAdmin only).

**Auth required:** Yes (SUPER_ADMIN)

---

#### DELETE `/api/v1/auth/tenants/:id`
Permanently delete a company (SuperAdmin only).

**Auth required:** Yes (SUPER_ADMIN)

---

#### PATCH `/api/v1/auth/tenants/:id/modules`
Update module configuration (SuperAdmin only).

**Auth required:** Yes (SUPER_ADMIN)
**Body:** `{ "hr": true, "accounting": false }`

---

#### PATCH `/api/v1/auth/tenants/:id/features`
Update feature config (SuperAdmin or Tenant Admin for own tenant).

**Auth required:** Yes
**Body:** `{ "module": "hr", "features": { "leave": true, "payroll": false } }`

---

#### GET `/api/v1/auth/tenants/:id/feature-history`
Get feature config change history (SuperAdmin only).

---

#### GET `/api/v1/auth/tenants/:id/users`
Get all users for a tenant (SuperAdmin only).

---

#### GET `/api/v1/auth/tenants/:id/audit`
Get audit logs for a tenant (SuperAdmin only).

**Query:** `?page=1&limit=20`

---

#### POST `/api/v1/auth/tenants/:id/admin/resend-invite`
Resend invite to Company Admin (SuperAdmin only).

---

### Users

#### GET `/api/v1/auth/users`
List users in tenant.

**Auth required:** Yes (requires `read:users`)

---

#### GET `/api/v1/auth/users/:id`
Get user by ID.

**Auth required:** Yes

---

#### PATCH `/api/v1/auth/users/:id`
Update a user.

**Auth required:** Yes (requires `update:user`)

---

#### POST `/api/v1/auth/users/accept-invite`
Accept employee invite and set password.

**Auth required:** No
**Body:** `{ "token": "...", "password": "...", "firstName": "...", "lastName": "..." }`

---

### Permissions

#### GET `/api/v1/auth/permissions/resources`
List all platform resources.

**Auth required:** Yes (requires `view:permission_sets`)

---

#### GET `/api/v1/auth/permissions/users/:userId`
Get effective permissions for a user (direct + from sets).

**Auth required:** Yes (requires `view:permission_sets`)

---

#### GET `/api/v1/auth/permissions/recipients`
List users holding a specific resource-action permission.

**Auth required:** Yes (requires `view:permission_sets`)
**Query:** `?resource=leave&action=APPROVE&includeTenantAdmins=false&activeOnly=true`

---

#### GET `/api/v1/auth/permissions/users/:userId/history`
Full permission history including revoked (for audit).

**Auth required:** Yes (requires `view:permission_sets`)

---

#### POST `/api/v1/auth/permissions/grant`
Grant a direct permission to a user.

**Auth required:** Yes (requires `grant:permission`)
**Body:** `{ "userId": "...", "resourceId": "...", "action": "VIEW", "reason": "..." }`

---

#### PATCH `/api/v1/auth/permissions/revoke`
Revoke a permission (soft update).

**Auth required:** Yes (requires `grant:permission`)
**Body:** `{ "userId": "...", "resourceId": "...", "action": "VIEW", "reason": "..." }`

---

#### GET `/api/v1/auth/permissions/sets`
List permission sets in tenant.

**Auth required:** Yes (requires `view:permission_sets`)

---

#### POST `/api/v1/auth/permissions/sets`
Create a permission set.

**Auth required:** Yes (requires `grant:permission`)
**Body:** `{ "name": "Leave Manager Set", "description": "...", "resources": [{ "resourceId": "...", "action": "VIEW" }] }`

---

#### PATCH `/api/v1/auth/permissions/sets/:id`
Replace all resource-action pairs on a permission set.

**Auth required:** Yes (requires `grant:permission`)
**Body:** `{ "resources": [{ "resourceId": "...", "action": "APPROVE" }] }`

---

#### DELETE `/api/v1/auth/permissions/sets/:id`
Delete a custom permission set. System sets cannot be deleted.

**Auth required:** Yes (requires `grant:permission`)

---

#### POST `/api/v1/auth/permissions/sets/assign`
Assign a permission set to a user.

**Auth required:** Yes (requires `grant:permission`)
**Body:** `{ "userId": "...", "permissionSetId": "..." }`

---

#### PATCH `/api/v1/auth/permissions/sets/remove/:userId/:permissionSetId`
Remove a permission set from a user.

**Auth required:** Yes (requires `grant:permission`)

---

#### GET `/api/v1/auth/permissions/sets/:id/members`
List users assigned to a permission set.

**Auth required:** Yes (requires `view:permission_sets`)

---

## HR Service APIs

Swagger: `http://localhost:4002/docs`

All HR routes require the `hr` module to be enabled in `moduleConfig`. Feature-specific routes also require the corresponding feature flag in `featureConfig.hr`.

### Employees

**Module guard:** `hr`

#### POST `/api/v1/hr/employees`
Create a new employee profile. Provisions auth user and sends invite email.

**Permission:** `create:employee`
**Body:** `{ firstName, lastName, email, phone, gender, dateOfBirth, jobTitle, employmentType, hireDate, basicSalary, departmentId, bankName, bankAccountNumber, ssnit, tinNumber, ... }`
**Response 201:** Employee created

---

#### GET `/api/v1/hr/employees`
List all employees with filtering and search.

**Permission:** `read:employees`
**Query:** `?search=kofi&departmentId=...&status=ACTIVE&page=1&limit=20`

---

#### GET `/api/v1/hr/employees/options`
Lightweight employee list for selectors (id, name). Accessible to any user with relevant HR permissions.

**Auth required:** Yes (implicit broad permission check)

---

#### GET `/api/v1/hr/employees/me`
Get own employee profile.

**Permission:** `read:own_profile`

---

#### PATCH `/api/v1/hr/employees/me`
Update own employee profile.

**Permission:** `update:own_profile`

---

#### GET `/api/v1/hr/employees/:id`
Get employee by ID.

**Permission:** `read:employees`

---

#### PATCH `/api/v1/hr/employees/:id`
Update employee profile.

**Permission:** `update:employee`

---

#### POST `/api/v1/hr/employees/:id/resignation`
Submit a resignation.

**Permission:** `submit:resignation`
**Body:** `{ lastWorkingDate, reason, additionalNotes }`

---

#### GET `/api/v1/hr/employees/:id/resignation`
Get resignation record.

**Auth required:** Yes

---

#### DELETE `/api/v1/hr/employees/:id/resignation`
Withdraw a pending resignation.

**Permission:** `withdraw:resignation`

---

#### PATCH `/api/v1/hr/employees/:id/resignation/dismiss`
Dismiss resignation without offboarding.

**Permission:** `offboard:employee`

---

#### POST `/api/v1/hr/employees/:id/resignation/initiate-offboarding`
Initiate offboarding from a pending resignation.

**Permission:** `offboard:employee`

---

#### POST `/api/v1/hr/employees/:id/offboard`
Initiate offboarding (creates draft record).

**Permission:** `offboard:employee`
**Body:** `{ reason, lastWorkingDate, exitNotes }`

---

#### GET `/api/v1/hr/employees/:id/offboard`
Get offboarding record.

**Permission:** `offboard:employee`

---

#### PATCH `/api/v1/hr/employees/:id/offboard/checklist`
Tick or untick a clearance checklist item.

**Permission:** `offboard:employee`
**Body:** `{ item: "assetReturn|hrClearance|financeClearance|managerApproval", done: true }`

---

#### POST `/api/v1/hr/employees/:id/offboard/complete`
Complete offboarding — sets status to Offboarded and revokes auth access.

**Permission:** `offboard:employee`

---

#### POST `/api/v1/hr/employees/:id/resend-invite`
Resend invite email. Invalidates previous link.

**Permission:** `create:employee`

---

#### GET|POST|PATCH|DELETE `/api/v1/hr/employees/:id/allowances[/:allowanceId]`
Manage recurring allowances.

**Permission:** `write:employee_payroll`

---

#### GET|POST|PATCH|DELETE `/api/v1/hr/employees/:id/deductions[/:deductionId]`
Manage payroll deductions.

**Permission:** `write:employee_payroll`

---

#### POST `/api/v1/hr/employees/:id/documents`
Upload a document for an employee.

**Permission:** `manage:documents`
**Body:** `{ type: "CONTRACT|NDA|...", url: "...", name: "..." }`

---

### Departments

#### GET `/api/v1/hr/departments` — list
#### POST `/api/v1/hr/departments` — create
#### GET `/api/v1/hr/departments/:id` — get
#### PATCH `/api/v1/hr/departments/:id` — update
#### DELETE `/api/v1/hr/departments/:id` — delete

**Permissions:** `read:departments`, `create:department`, `update:department`, `delete:department`

---

### Branches

#### GET `/api/v1/hr/branches` — list
#### POST `/api/v1/hr/branches` — create
#### GET `/api/v1/hr/branches/:id` — get
#### PATCH `/api/v1/hr/branches/:id` — update
#### DELETE `/api/v1/hr/branches/:id` — delete

**Permissions:** `read:branches`, `create:branch`, `update:branch`, `delete:branch`

---

### Leave

**Module guard:** `hr`
**Feature guard:** `hr.leave`

#### POST `/api/v1/hr/leave/types` — create leave type
#### GET `/api/v1/hr/leave/types` — list leave types
#### PATCH `/api/v1/hr/leave/types/:id` — update leave type
#### DELETE `/api/v1/hr/leave/types/:id` — delete custom leave type

**Permission:** `manage:leave_types`

---

#### POST `/api/v1/hr/leave/public-holidays` — add public holiday
#### GET `/api/v1/hr/leave/public-holidays` — list
#### PATCH `/api/v1/hr/leave/public-holidays/:id` — update
#### DELETE `/api/v1/hr/leave/public-holidays/:id` — delete

**Permission:** `manage:leave_types`

---

#### GET `/api/v1/hr/leave/balances/me` — own balances
**Permission:** `read:own_leave`

#### GET `/api/v1/hr/leave/balances/:employeeId` — employee balances
#### POST `/api/v1/hr/leave/balances/backfill` — backfill all employee balances
#### POST `/api/v1/hr/leave/balances/:employeeId/initialize` — initialize balances

---

#### POST `/api/v1/hr/leave/requests`
Submit a leave request.

**Permission:** `request:leave`
**Body:** `{ leaveTypeId, startDate, endDate, reason, coverageEmployeeId, coverageNote, supportingDocumentName, supportingDocumentUrl }`

---

#### GET `/api/v1/hr/leave/requests` — get requests (scoped by role)
#### GET `/api/v1/hr/leave/requests/all` — all requests (admin)
**Permission:** `read:all_leaves`

#### GET `/api/v1/hr/leave/requests/pending-count` — pending count
**Permission:** `approve:leave`

#### GET `/api/v1/hr/leave/requests/my` — own requests
**Permission:** `read:own_leave`

#### PATCH `/api/v1/hr/leave/requests/:id/review` — approve or reject
**Permission:** `approve:leave`
**Body:** `{ decision: "APPROVED|REJECTED", rejectionNote: "..." }`

#### PATCH `/api/v1/hr/leave/requests/:id/supporting-document` — update document
**Permission:** `request:leave`

#### PATCH `/api/v1/hr/leave/requests/:id/cancel` — cancel request
**Permission:** `request:leave`

---

### Payroll

**Module guard:** `hr`
**Feature guard:** `hr.payroll`

#### POST `/api/v1/hr/payroll/run`
Run payroll for a period. Applies Ghana/Nigeria/Kenya tax calculations.

**Permission:** `run:payroll`
**Body:** `{ month: 4, year: 2026, notes: "..." }`
**Response 201:** Payroll draft created

---

#### GET `/api/v1/hr/payroll` — list all payroll runs
**Permission:** `read:payroll`

#### GET `/api/v1/hr/payroll/my-payslips` — own payslips
**Permission:** `read:own_payslip`

#### GET `/api/v1/hr/payroll/:id` — get specific run with all payslips
**Permission:** `read:payroll`

#### PATCH `/api/v1/hr/payroll/:id/items/:itemId` — edit payroll item
**Permission:** `run:payroll`

#### PATCH `/api/v1/hr/payroll/:id/submit` — submit for approval
**Permission:** `run:payroll`

#### PATCH `/api/v1/hr/payroll/:id/approve` — approve
**Permission:** `approve:payroll`

#### PATCH `/api/v1/hr/payroll/:id/return-to-draft` — return to draft
**Permission:** `approve:payroll`

#### PATCH `/api/v1/hr/payroll/:id/mark-paid` — mark as paid
**Permission:** `approve:payroll`

---

### Appraisals

**Module guard:** `hr`
**Feature guard:** `hr.appraisals`

#### POST `/api/v1/hr/appraisals/cycles` — create cycle
#### GET `/api/v1/hr/appraisals/cycles` — list cycles
#### GET `/api/v1/hr/appraisals/cycles/:cycleId` — get cycle
#### PATCH `/api/v1/hr/appraisals/cycles/:cycleId` — update cycle
#### DELETE `/api/v1/hr/appraisals/cycles/:cycleId` — delete cycle
**Permission:** `configure:appraisal`

#### POST `/api/v1/hr/appraisals/cycles/:cycleId/start` — start cycle (creates appraisals)
#### POST `/api/v1/hr/appraisals/cycles/:cycleId/seed-from-template` — copy KPIs from template
#### PATCH `/api/v1/hr/appraisals/cycles/:cycleId/cancel` — cancel cycle
#### GET `/api/v1/hr/appraisals/cycles/:cycleId/appraisals` — get all appraisals in cycle
#### GET `/api/v1/hr/appraisals/cycles/:cycleId/results` — cycle results summary
#### GET `/api/v1/hr/appraisals/cycles/:cycleId/kpis` — KPIs for cycle
#### POST `/api/v1/hr/appraisals/cycles/:cycleId/kpis` — add KPI
#### PUT `/api/v1/hr/appraisals/cycles/:cycleId/kpis/:kpiId` — update KPI

#### GET `/api/v1/hr/appraisals/templates` — list templates
#### POST `/api/v1/hr/appraisals/templates` — create template
#### PUT `/api/v1/hr/appraisals/templates/:templateId` — update template
#### DELETE `/api/v1/hr/appraisals/templates/:templateId` — delete template

#### GET `/api/v1/hr/appraisals/my` — own appraisals
**Permission:** `read:own_review`

#### GET `/api/v1/hr/appraisals/team` — team appraisals for manager
**Permission:** `submit:manager_review`

#### GET `/api/v1/hr/appraisals/:id` — get single appraisal

#### PATCH `/api/v1/hr/appraisals/:id/self-assessment`
Submit self-assessment.
**Permission:** `submit:self_assessment`
**Body:** `{ kpiScores: [{ kpiId, score, comment }], comment }`

#### PATCH `/api/v1/hr/appraisals/:id/manager-review`
Submit manager review.
**Permission:** `submit:manager_review`
**Body:** `{ kpiScores: [{ kpiId, score, comment }], comment }`

#### PATCH `/api/v1/hr/appraisals/:id/finalize`
Finalize an appraisal.
**Permission:** `finalize:appraisal`

#### PATCH `/api/v1/hr/appraisals/:id/reopen`
Reopen appraisal for redo.

---

### Time & Attendance

**Module guard:** `hr`
**Feature guard:** `hr.time`

#### POST `/api/v1/hr/time/clock-in` — clock in
**Permission:** `clock:in_out`

#### POST `/api/v1/hr/time/clock-out` — clock out
#### GET `/api/v1/hr/time/today` — today's status
#### GET `/api/v1/hr/time/my-history` — own attendance history
#### GET `/api/v1/hr/time/attendance` — attendance records (with filters)
**Permission:** `read:attendance`
**Query:** `?employeeId=...&from=2026-01-01&to=2026-01-31&departmentId=...&status=CLOCKED_IN&page=1`

#### POST `/api/v1/hr/time/corrections` — submit time correction
**Permission:** `submit:time_correction`

#### GET `/api/v1/hr/time/corrections` — list corrections
**Permission:** `read:attendance`

#### PATCH `/api/v1/hr/time/corrections/:id/review` — approve/reject correction
**Permission:** `approve:time_correction`

#### GET `/api/v1/hr/time/live` — live attendance (currently clocked in)
#### GET `/api/v1/hr/time/stats/today` — today's attendance stats

**Schedules:**
#### POST `/api/v1/hr/time/schedules` — create schedule
**Permission:** `manage:schedules`

#### GET `/api/v1/hr/time/schedules` — list schedules
#### PATCH `/api/v1/hr/time/schedules/:id` — update
#### DELETE `/api/v1/hr/time/schedules/:id` — delete

**Shift swaps:**
#### GET `/api/v1/hr/time/shift-swaps/eligible-colleagues`
#### POST `/api/v1/hr/time/shift-swaps` — create swap request
#### GET `/api/v1/hr/time/shift-swaps/my` — own swap requests
#### GET `/api/v1/hr/time/shift-swaps/pending-manager` — manager's pending swaps
#### GET `/api/v1/hr/time/shift-swaps/:id` — get single swap
#### POST `/api/v1/hr/time/shift-swaps/:id/respond` — colleague accept/decline
#### POST `/api/v1/hr/time/shift-swaps/:id/manager-decision` — manager approve/reject
**Permission:** `manage:schedules`

#### GET `/api/v1/hr/time/my-schedule` — own schedule with leave blocks
**Permission:** `clock:in_out`

---

### Assets

#### GET `/api/v1/hr/assets` — list assets
**Permission:** `read:assets`

#### POST `/api/v1/hr/assets` — create asset
**Permission:** `manage:assets`

#### GET `/api/v1/hr/assets/:id` — get asset
#### PATCH `/api/v1/hr/assets/:id` — update asset
#### DELETE `/api/v1/hr/assets/:id` — delete
#### POST `/api/v1/hr/assets/:id/assign` — assign to employee
**Permission:** `assign:asset`

#### POST `/api/v1/hr/assets/:id/unassign` — unassign

---

### Projects

#### GET `/api/v1/hr/projects` — list
**Permission:** `read:projects`

#### POST `/api/v1/hr/projects` — create
**Permission:** `create:project`

#### GET `/api/v1/hr/projects/:id` — get
#### PATCH `/api/v1/hr/projects/:id` — update
**Permission:** `update:project`

#### DELETE `/api/v1/hr/projects/:id` — delete
**Permission:** `delete:project`

#### GET `/api/v1/hr/projects/:id/tasks` — list tasks
#### POST `/api/v1/hr/projects/:id/tasks` — create task
#### PATCH `/api/v1/hr/projects/:id/tasks/:taskId` — update task
#### DELETE `/api/v1/hr/projects/:id/tasks/:taskId` — delete task
#### GET `/api/v1/hr/projects/:id/members` — list members
#### POST `/api/v1/hr/projects/:id/members` — add member
#### DELETE `/api/v1/hr/projects/:id/members/:memberId` — remove member
#### GET `/api/v1/hr/projects/:id/activity` — activity log

---

### Announcements

#### GET `/api/v1/hr/announcements` — list
**Permission:** `read:announcements`

#### POST `/api/v1/hr/announcements` — create + publish
**Permission:** `manage:announcements`
**Body:** `{ title, body, audienceType: "ALL|DEPARTMENTS|BRANCHES|EMPLOYEES", targetDepartmentIds, sendEmail }`

#### PATCH `/api/v1/hr/announcements/:id` — update
#### DELETE `/api/v1/hr/announcements/:id` — delete

---

### Company Agreements (Policies)

#### GET `/api/v1/hr/company-agreements` — list
**Auth required:** Yes
**Permission:** `READ_HR_SETTINGS` / `hr-settings:VIEW`
**Response:** Tenant-scoped agreement working copies with latest version metadata.

#### POST `/api/v1/hr/company-agreements` — create
**Auth required:** Yes
**Permission:** `MANAGE_HR_SETTINGS` / `hr-settings:EDIT`
**Body:** `{ type: "NDA|EMPLOYMENT_CONTRACT|CODE_OF_CONDUCT|...", title, details, documentUrl?, isRequired? }`
**Notes:** Creates a draft agreement working copy. It is not signable until published.

#### PATCH `/api/v1/hr/company-agreements/:id` — update
**Auth required:** Yes
**Permission:** `MANAGE_HR_SETTINGS` / `hr-settings:EDIT`
**Body:** `{ type?, title?, details?, documentUrl?, isRequired? }`
**Notes:** Updates the agreement working copy only. Existing published versions and signatures are immutable.

#### POST `/api/v1/hr/company-agreements/:id/publish` — publish immutable version
**Auth required:** Yes
**Permission:** `MANAGE_HR_SETTINGS` / `hr-settings:EDIT`
**Body:** `{ documentUrl? }`
**Response:** Published `CompanyAgreementVersion` with `version`, `agreementHash`, and `publishedAt`.
**Notes:** Publishing snapshots the current title/details/document URL into an immutable active version. Employees sign the active version only.

#### POST `/api/v1/hr/company-agreements/:id/archive` — archive
**Auth required:** Yes
**Permission:** `MANAGE_HR_SETTINGS` / `hr-settings:EDIT`
**Notes:** Stops new employee signing. Existing signatures remain for audit/history.

#### GET `/api/v1/hr/company-agreements/:id/signatures` — signature tracking
**Auth required:** Yes
**Permission:** `MANAGE_HR_SETTINGS` / `hr-settings:EDIT`
**Query:** `?status=SIGNED|DECLINED|REVOKED`
**Response:** `{ agreement, version, summary: { signed, declined, pending, total }, rows[] }`

#### DELETE `/api/v1/hr/company-agreements/:id` — delete draft
**Auth required:** Yes
**Permission:** `MANAGE_HR_SETTINGS` / `hr-settings:EDIT`
**Notes:** Only untouched drafts can be deleted. Published or signed agreements must be archived.

#### GET `/api/v1/hr/company-agreements/me` — employee agreement inbox
**Auth required:** Yes
**Permission:** `READ_OWN_PROFILE` / `employee-profile:VIEW`
**Response:** Active published agreement versions for the authenticated employee with `status: "PENDING" | "SIGNED" | "DECLINED" | "REVOKED"`.

#### GET `/api/v1/hr/company-agreements/me/:versionId` — employee agreement detail
**Auth required:** Yes
**Permission:** `READ_OWN_PROFILE` / `employee-profile:VIEW`
**Notes:** Returns the immutable published version snapshot. Employees cannot fetch archived/inactive versions through this endpoint.

#### POST `/api/v1/hr/company-agreements/me/:versionId/sign` — typed acknowledgement signature
**Auth required:** Yes
**Permission:** `UPDATE_OWN_PROFILE` / `employee-profile:EDIT`
**Body:** `{ "typedName": "Full Legal Name", "consentAccepted": true }`
**Notes:** `employeeId` is resolved from the authenticated user and must not be sent by the client. Duplicate sign/decline attempts for the same employee/version return `409 Conflict`.

#### POST `/api/v1/hr/company-agreements/me/:versionId/decline` — decline agreement
**Auth required:** Yes
**Permission:** `UPDATE_OWN_PROFILE` / `employee-profile:EDIT`
**Body:** `{ "reason": "I need clarification before signing." }`
**Notes:** Declines are tracked against the immutable version and block later signing of that same version unless a future revoke/reopen workflow is added.

---

### Notifications (In-App)

Notification-service owns new in-app notification storage and APIs. Legacy HR routes still exist temporarily for older frontend consumers, but new frontend work should use `/api/v1/notification/in-app/*`.

#### GET `/api/v1/notification/in-app` — 50 most recent
**Auth required:** Yes
**Scope:** Current `tenantId` and current authenticated user only.

#### GET `/api/v1/notification/in-app/unread-count`
**Response:** `{ "count": 3 }`

#### GET `/api/v1/notification/in-app/all` — paginated
**Query:** `?filter=unread&page=1&limit=20`

#### PATCH `/api/v1/notification/in-app/mark-all-read`
Marks unread notifications for the current tenant/user only.

#### PATCH `/api/v1/notification/in-app/:id/read`
Marks one current-user notification as read.

#### DELETE `/api/v1/notification/in-app/:id`
Archives one current-user notification. It does not hard-delete the row.

#### Legacy HR routes
`/api/v1/hr/notifications/*` remains available during frontend migration but reads legacy `hr.Notification` records only.

---

### Settings

#### GET `/api/v1/hr/settings` — get tenant HR config
#### PATCH `/api/v1/hr/settings` — update tenant HR config
**Permission:** `manage:hr_settings`
**Fields:** `payrollCountry`, `payrollCurrency`, `resignationNoticePeriodDays`, `lateArrivalThresholdMinutes`, `appraisalCycleRecipients`, etc.

---

### Dashboard

#### GET `/api/v1/hr/dashboard` — tenant admin dashboard stats
#### GET `/api/v1/hr/dashboard/employee` — employee self-service dashboard

---

## Notification Service APIs

The notification service exposes authenticated in-app notification HTTP APIs through the API gateway under `/api/v1/notification/in-app/*`. Email/SMS delivery remains event-driven over RabbitMQ.

**Health endpoint (internal only):** `GET /api/health`
**Swagger:** `http://localhost:4004/api/docs` (if enabled in dev)

All notification delivery is event-driven. See [Event-Driven Architecture](architecture.md#event-driven-architecture) for event patterns.

---

## Reinsurance Operations APIs

Public gateway prefix: `/api/v1/operations/reinsurance`

All Counterparties routes require authenticated tenant context, the
`operations` module entitlement, the `operations.reinsurance` feature
entitlement and the listed resource action.

| Method | Path | Permission | Description |
|---|---|---|---|
| GET | `/counterparties?search=&type=&page=1&limit=20` | `operations.reinsurance.counterparties:VIEW` | List active tenant counterparties |
| POST | `/counterparties` | `operations.reinsurance.counterparties:CREATE` | Create a cedant, reinsurer or broker with optional contacts/addresses |
| GET | `/counterparties/:id` | `operations.reinsurance.counterparties:VIEW` | Get one active tenant counterparty |
| PATCH | `/counterparties/:id` | `operations.reinsurance.counterparties:EDIT` | Update a tenant counterparty; supplied child collections replace existing collections |
| DELETE | `/counterparties/:id` | `operations.reinsurance.counterparties:DELETE` | Archive a tenant counterparty |

Counterparty types: `CEDANT`, `REINSURER`, `BROKER`.

List response:

```json
{
  "items": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0
  }
}
```

---

## Subscription Service APIs (Scaffolded — Not Implemented)

**Health endpoint:** `GET /health`
No business routes exist yet.

---

## AI APIs (Proposed — Not Implemented)

The following API contract is proposed for a future `ai-service`:

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/ai/chat` | Send a message to the AI assistant (tenant-scoped) |
| GET | `/api/v1/ai/conversations` | List conversation history |
| GET | `/api/v1/ai/conversations/:id` | Get conversation with messages |
| DELETE | `/api/v1/ai/conversations/:id` | Delete conversation |
| GET | `/api/v1/ai/tools` | List available AI tools for the current user's permissions |
| POST | `/api/v1/ai/approvals` | Submit an approval for a pending AI action |
| GET | `/api/v1/ai/approvals` | List pending AI approvals |
| GET | `/api/v1/ai/settings` | Get AI settings for tenant |
| PATCH | `/api/v1/ai/settings` | Update AI settings |
| GET | `/api/v1/ai/audit-logs` | AI action audit log (read-only) |

**Status: Proposed — not built.**

---

## Error Contract

All services return errors in this format:

```json
{
  "statusCode": 400,
  "message": "Human-readable error message",
  "error": "Bad Request"
}
```

**Validation errors** (from class-validator DTOs):
```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password should not be empty"],
  "error": "Bad Request"
}
```

**Common status codes:**
| Code | Meaning |
|---|---|
| 200 | Success |
| 201 | Created |
| 204 | No Content (delete operations) |
| 400 | Bad request / validation error |
| 401 | Missing or invalid JWT |
| 403 | Forbidden (insufficient permissions or wrong role) |
| 404 | Resource not found |
| 409 | Conflict (duplicate email, slug, etc.) |
| 500 | Internal server error |
| 503 | Service temporarily unavailable (proxy error or misconfigured service) |

---

## Pagination / Filtering

Most list endpoints support:
```
?page=1&limit=20&search=keyword
```

Default page size varies by endpoint (typically 20–50). Some endpoints return all records without pagination.

Responses include `{ data: [...], total?, page?, limit? }` or just `[...]` depending on the endpoint.

---

## Auth Context Headers Reference

Downstream services (auth-service, hr-service) read these headers injected by the gateway:

| Header | Type | Notes |
|---|---|---|
| `x-user-id` | UUID string | User's auth ID |
| `x-user-email` | string | User email |
| `x-user-role` | `SUPER_ADMIN \| TENANT_ADMIN \| EMPLOYEE` | System role |
| `x-tenant-id` | UUID string | Tenant UUID |
| `x-tenant-slug` | string | e.g. `acme-ghana` |
| `x-tenant-name` | string | Display name |
| `x-user-first-name` | string | First name |
| `x-user-permissions` | JSON string | `["read:employees","approve:leave",...]` |
