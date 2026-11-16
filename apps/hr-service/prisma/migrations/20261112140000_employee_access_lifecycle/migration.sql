BEGIN;
CREATE INDEX "Employee_tenantId_userId_idx" ON "hr"."Employee" ("tenantId", "userId");
ALTER TABLE "hr"."EmployeeAccessOperation" ADD COLUMN "reason" TEXT;
ALTER TABLE "hr"."EmployeeAccessOperation" DROP CONSTRAINT "EmployeeAccessOperation_action_check";
ALTER TABLE "hr"."EmployeeAccessOperation" ADD CONSTRAINT "EmployeeAccessOperation_action_check"
CHECK ("action" IN ('GRANT', 'SUSPEND', 'RESTORE', 'RESEND'));
CREATE INDEX "EmployeeAccessOperation_tenantId_employeeId_status_idx" ON "hr"."EmployeeAccessOperation" ("tenantId", "employeeId", "status");
COMMIT;
