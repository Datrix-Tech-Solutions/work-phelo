BEGIN;
CREATE TYPE "hr"."EmployeeAccessOperationStatus" AS ENUM ('QUEUED', 'RUNNING', 'RECONCILING', 'LINKED', 'COMPLETED', 'FAILED', 'PAUSED');
CREATE TABLE "hr"."EmployeeAccessOperation" (
  "id" TEXT NOT NULL PRIMARY KEY, "tenantId" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL, "action" TEXT NOT NULL DEFAULT 'GRANT',
  "idempotencyKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL, "employeePermission" TEXT NOT NULL,
  "email" TEXT NOT NULL, "firstName" TEXT NOT NULL, "lastName" TEXT NOT NULL,
  "targetUserId" TEXT, "expectedUserId" TEXT,
  "status" "hr"."EmployeeAccessOperationStatus" NOT NULL DEFAULT 'QUEUED',
  "attemptCount" INTEGER NOT NULL DEFAULT 0, "nextAttemptAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
  "leaseUntil" TIMESTAMP(3), "leaseToken" TEXT, "lastErrorCode" TEXT, "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeAccessOperation_action_check" CHECK ("action" = 'GRANT'),
  CONSTRAINT "EmployeeAccessOperation_permission_check" CHECK ("employeePermission" IN ('CREATE', 'EDIT'))
);
CREATE UNIQUE INDEX "EmployeeAccessOperation_tenantId_idempotencyKey_key" ON "hr"."EmployeeAccessOperation" ("tenantId", "idempotencyKey");
-- Paused operations may have an uncertain remote outcome and must keep their reservation.
CREATE UNIQUE INDEX "EmployeeAccessOperation_one_unresolved" ON "hr"."EmployeeAccessOperation" ("tenantId", "employeeId")
WHERE "status" IN ('QUEUED', 'RUNNING', 'RECONCILING', 'LINKED', 'PAUSED');
CREATE INDEX "EmployeeAccessOperation_status_nextAttemptAt_idx" ON "hr"."EmployeeAccessOperation" ("status", "nextAttemptAt");
CREATE INDEX "EmployeeAccessOperation_tenantId_employeeId_createdAt_idx" ON "hr"."EmployeeAccessOperation" ("tenantId", "employeeId", "createdAt");
CREATE TABLE "hr"."EmployeeCreateRequest" (
  "id" TEXT NOT NULL PRIMARY KEY, "tenantId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL, "employeeId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "EmployeeCreateRequest_tenantId_idempotencyKey_key" ON "hr"."EmployeeCreateRequest" ("tenantId", "idempotencyKey");
CREATE UNIQUE INDEX "EmployeeCreateRequest_employeeId_key" ON "hr"."EmployeeCreateRequest" ("employeeId");
COMMIT;
