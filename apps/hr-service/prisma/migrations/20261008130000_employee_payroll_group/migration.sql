-- An employee's payroll group, set from the group's own page. Deleting a group leaves its
-- employees without one.

-- AlterTable
ALTER TABLE "hr"."Employee" ADD COLUMN     "payrollGroupId" TEXT;
-- CreateIndex
CREATE INDEX "Employee_tenantId_payrollGroupId_idx" ON "hr"."Employee"("tenantId", "payrollGroupId");
-- AddForeignKey
ALTER TABLE "hr"."Employee" ADD CONSTRAINT "Employee_payrollGroupId_fkey" FOREIGN KEY ("payrollGroupId") REFERENCES "hr"."PayrollGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
