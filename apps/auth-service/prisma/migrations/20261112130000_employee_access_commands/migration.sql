BEGIN;
CREATE TYPE "w_auth"."EmployeeAccessCommandStatus" AS ENUM ('PROVISIONED', 'READY', 'PROVIDER_ACCEPTED', 'FAILED', 'PAUSED', 'EXPIRED');
CREATE TABLE "w_auth"."EmployeeAccessCommand" (
  "id" TEXT NOT NULL PRIMARY KEY, "tenantId" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL, "action" TEXT NOT NULL DEFAULT 'GRANT',
  "idempotencyKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL, "payloadHash" TEXT NOT NULL,
  "employeePermission" TEXT NOT NULL, "email" TEXT NOT NULL, "firstName" TEXT NOT NULL,
  "tenantName" TEXT NOT NULL, "tenantSlug" TEXT NOT NULL, "targetUserId" TEXT, "expectedUserId" TEXT,
  "status" "w_auth"."EmployeeAccessCommandStatus" NOT NULL DEFAULT 'PROVISIONED',
  "attemptCount" INTEGER NOT NULL DEFAULT 0, "nextAttemptAt" TIMESTAMP(3),
  "leaseUntil" TIMESTAMP(3), "leaseToken" TEXT, "lastErrorCode" TEXT, "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeAccessCommand_action_check" CHECK ("action" = 'GRANT'),
  CONSTRAINT "EmployeeAccessCommand_permission_check" CHECK ("employeePermission" IN ('CREATE', 'EDIT'))
);
CREATE UNIQUE INDEX "EmployeeAccessCommand_tenantId_idempotencyKey_key" ON "w_auth"."EmployeeAccessCommand" ("tenantId", "idempotencyKey");
CREATE UNIQUE INDEX "EmployeeAccessCommand_targetUserId_key" ON "w_auth"."EmployeeAccessCommand" ("targetUserId");
CREATE UNIQUE INDEX "EmployeeAccessCommand_one_identity" ON "w_auth"."EmployeeAccessCommand" ("tenantId", "employeeId") WHERE "targetUserId" IS NOT NULL;
CREATE INDEX "EmployeeAccessCommand_status_nextAttemptAt_idx" ON "w_auth"."EmployeeAccessCommand" ("status", "nextAttemptAt");
CREATE INDEX "EmployeeAccessCommand_tenantId_employeeId_idx" ON "w_auth"."EmployeeAccessCommand" ("tenantId", "employeeId");
COMMIT;
