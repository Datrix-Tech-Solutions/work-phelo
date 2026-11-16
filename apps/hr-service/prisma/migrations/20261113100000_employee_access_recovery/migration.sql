BEGIN;
CREATE TABLE "hr"."EmployeeAccessRecoveryRequest" (
  "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "employeeId" TEXT NOT NULL, "operationId" TEXT NOT NULL,
  "operatorUserId" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
  "reason" TEXT NOT NULL, "outcome" TEXT NOT NULL DEFAULT 'PENDING', "lastErrorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EmployeeAccessRecoveryRequest_outcome_check" CHECK ("outcome" IN ('PENDING','REQUEUE','FAILED','BLOCKED'))
);
CREATE UNIQUE INDEX "EmployeeAccessRecoveryRequest_tenantId_idempotencyKey_key" ON "hr"."EmployeeAccessRecoveryRequest" ("tenantId", "idempotencyKey");
CREATE INDEX "EmployeeAccessRecoveryRequest_operation_history_idx" ON "hr"."EmployeeAccessRecoveryRequest" ("tenantId", "operationId", "createdAt");
COMMIT;
