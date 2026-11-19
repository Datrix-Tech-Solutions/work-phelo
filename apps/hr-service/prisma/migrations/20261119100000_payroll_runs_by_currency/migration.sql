-- A payslip type can be paid in more than one currency in the same month, so each currency gets
-- its own run: the unique key now includes the run's currency. Existing runs are unaffected.

-- DropIndex
DROP INDEX "hr"."PayrollRun_tenantId_month_year_payslipKey_key";

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_tenantId_month_year_payslipKey_payrollCurrency_key" ON "hr"."PayrollRun"("tenantId", "month", "year", "payslipKey", "payrollCurrency");
