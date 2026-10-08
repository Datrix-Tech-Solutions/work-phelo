-- Several payroll configurations can now share a payslip type: the type only says which figures a
-- configuration is calculated from, and payroll groups choose the configuration they use.

-- DropIndex
DROP INDEX "hr"."PayrollConfiguration_tenantId_idx";

-- DropIndex
DROP INDEX "hr"."PayrollConfiguration_tenantId_payslipType_key";

-- CreateIndex
CREATE INDEX "PayrollConfiguration_tenantId_payslipType_idx" ON "hr"."PayrollConfiguration"("tenantId", "payslipType");
