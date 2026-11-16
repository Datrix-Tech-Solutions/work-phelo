BEGIN;
ALTER TABLE "w_auth"."User" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "accessSuspendedAt" TIMESTAMP(3), ADD COLUMN "accessSuspensionReason" TEXT;
CREATE TABLE "w_auth"."EmployeeAccessLifecycleCommand" (
  "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL, "targetUserId" TEXT NOT NULL, "action" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL, "payloadHash" TEXT NOT NULL,
  "reason" TEXT NOT NULL, "status" TEXT NOT NULL DEFAULT 'READY', "lastErrorCode" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0, "nextAttemptAt" TIMESTAMP(3),
  "leaseUntil" TIMESTAMP(3), "leaseToken" TEXT, "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeAccessLifecycleCommand_action_check" CHECK ("action" IN ('SUSPEND','RESTORE','RESEND')),
  CONSTRAINT "EmployeeAccessLifecycleCommand_status_check" CHECK ("status" IN ('READY','COMPLETED','FAILED','PAUSED'))
);
CREATE UNIQUE INDEX "EmployeeAccessLifecycleCommand_tenantId_idempotencyKey_key" ON "w_auth"."EmployeeAccessLifecycleCommand" ("tenantId", "idempotencyKey");
CREATE INDEX "EmployeeAccessLifecycleCommand_status_nextAttemptAt_idx" ON "w_auth"."EmployeeAccessLifecycleCommand" ("status", "nextAttemptAt");
CREATE INDEX "EmployeeAccessLifecycleCommand_employee_history_idx" ON "w_auth"."EmployeeAccessLifecycleCommand" ("tenantId", "employeeId", "createdAt");
COMMIT;
