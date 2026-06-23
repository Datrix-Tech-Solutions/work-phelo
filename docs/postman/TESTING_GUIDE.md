# WorkPhelo API Testing Guide

Use the Postman collection primarily against development:

```text
https://dev-api.workphelo.com/api/v1
```

Production smoke checks should be read-only unless a release runbook explicitly
approves a write operation.

## Basic Setup

1. Import `WorkPhelo-Dev.postman_collection.json`.
2. Import `WorkPhelo-Dev.postman_environment.json`.
3. Select the dev environment.
4. Set `email`, `password`, `tenantSlug` and any IDs needed by the flow.
5. Run `Authentication / Login`.
6. Run `Authentication / Profile` to verify the session.

## Happy Path Checklist

- Login succeeds.
- Profile returns user and tenant context.
- HR employee list loads for a tenant user.
- Notification list loads.
- Reinsurance health/docs load in dev.
- Logout clears session.

## Tenant Invite Flow

1. Login as Super Admin.
2. Create tenant.
3. Invite tenant admin.
4. Resend invite if needed.
5. Accept invite using the emailed token.
6. Confirm accepted users cannot be resent.

Expected behavior:

- Resend generates a new token/expiry for pending invites.
- Invite token is not returned in API responses.
- Invite links use `https://dev-app.workphelo.com` in dev and
  `https://app.workphelo.com` in prod.

## HR Import Flow

1. Login as a tenant admin or user with employee create/import permission.
2. Download the CSV template.
3. Fill tenant-specific department and branch names.
4. Run employee import dry-run with multipart form-data key `file`.
5. Review `totalRows`, `validRows`, `invalidRows` and row-level errors.

Expected behavior:

- Dry-run accepts `multipart/form-data`.
- Dry-run validates CSV rows.
- Dry-run does not create employees, auth users, leave balances or events.
- Placeholder department/branch values may fail until matching tenant records exist.

## Reinsurance Placement Lifecycle

Development only unless Reinsurance is intentionally deployed to production.

1. Create placement.
2. Add participant.
3. Accept participant.
4. Create placement closing.
5. Issue and confirm closing.
6. Record payment.
7. Verify lock status.
8. Reverse payment if testing reversal.
9. Confirm placement remains financially locked after reversal.

Expected behavior:

- Payment requires at least one confirmed closing.
- First payment creates a hard financial lock.
- Reversal records do not unlock placement.

## Claims Workflow

Development only unless Reinsurance is intentionally deployed to production.

1. Create claim as a loss event.
2. Generate claim allocations.
3. Create cash call from one allocation.
4. Issue cash call.
5. Void cash call if testing lifecycle.

Expected behavior:

- Claims do not create `CLAIM_SETTLEMENT` placement payments.
- Allocations use immutable closing snapshots.
- Cash-call `PAID` transition is deferred.

## Document/PDF/S3 Workflow

Development only unless Reinsurance document storage is intentionally deployed
to production.

1. Generate a `CLOSING_SLIP` document registry row.
2. Render PDF.
3. Render and store if S3 env is configured.
4. Request signed download URL.

Expected behavior:

- Direct render streams PDF without storing.
- Render-and-store updates private storage metadata.
- Download URL requires stored object metadata.

## Known Gaps

- Production Swagger is normally disabled.
- Subscription, Marketing and Reinsurance are not deployed in the current prod compose file.
- Some workflows require provider configuration, for example S3, mailbox sync or SMS.
- Some older Swagger examples need richer request/response examples.
