BEGIN;
CREATE INDEX "EmployeeAccessLifecycleCommand_target_history_idx" ON "w_auth"."EmployeeAccessLifecycleCommand" ("tenantId", "targetUserId", "createdAt", "id");
CREATE TABLE "w_auth"."EmployeeAccessRecoveryReceipt" (
  "id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "operationId" TEXT NOT NULL,
  "operatorUserId" TEXT NOT NULL, "payloadHash" TEXT NOT NULL, "outcome" TEXT NOT NULL,
  "lastErrorCode" TEXT, "reason" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeAccessRecoveryReceipt_outcome_check" CHECK ("outcome" IN ('REQUEUE','FAILED','BLOCKED'))
);
CREATE INDEX "EmployeeAccessRecoveryReceipt_tenantId_operationId_idx" ON "w_auth"."EmployeeAccessRecoveryReceipt" ("tenantId", "operationId");
COMMIT;
