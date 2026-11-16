BEGIN;
CREATE INDEX "Employee_access_candidates_idx" ON "hr"."Employee" ("tenantId", "createdAt", "id");
CREATE INDEX "EmployeeAccessOperation_admin_history_idx" ON "hr"."EmployeeAccessOperation" ("tenantId", "createdAt", "id");
CREATE INDEX "EmployeeAccessOperation_admin_status_idx" ON "hr"."EmployeeAccessOperation" ("tenantId", "status", "createdAt", "id");
COMMIT;
