-- Stored runs for payroll configurations: a run belongs to a payslip type, so each type has its
-- own run each month; old runs keep the key "legacy" and stay exactly as they were. Payslips gain
-- role totals and a line per component.

-- DropIndex
DROP INDEX "hr"."PayrollRun_tenantId_month_year_key";
-- AlterTable
ALTER TABLE "hr"."PayrollRun" ADD COLUMN     "payslipKey" TEXT NOT NULL DEFAULT 'legacy',
ADD COLUMN     "totalEmployeeSocialSecurity" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalEmployerSocialSecurity" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalIncomeTax" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalOtherDeductions" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "totalPension" DECIMAL(15,2) NOT NULL DEFAULT 0;
-- AlterTable
ALTER TABLE "hr"."PayrollItem" ADD COLUMN     "commissionFigure" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "configurationId" TEXT,
ADD COLUMN     "configurationVersion" INTEGER,
ADD COLUMN     "employeeSocialSecurity" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "employerSocialSecurity" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "incomeTax" DECIMAL(15,2) NOT NULL DEFAULT 0,
ADD COLUMN     "payrollGroupId" TEXT,
ADD COLUMN     "pension" DECIMAL(15,2) NOT NULL DEFAULT 0;
-- CreateTable
CREATE TABLE "hr"."PayrollItemLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "payrollItemId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "componentId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "role" TEXT,
    "amount" DECIMAL(15,2) NOT NULL,
    "relief" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "takenFromPay" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollItemLine_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "PayrollItemLine_tenantId_payrollItemId_idx" ON "hr"."PayrollItemLine"("tenantId", "payrollItemId");
-- CreateIndex
CREATE INDEX "PayrollItemLine_tenantId_role_idx" ON "hr"."PayrollItemLine"("tenantId", "role");
-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_tenantId_month_year_payslipKey_key" ON "hr"."PayrollRun"("tenantId", "month", "year", "payslipKey");
-- AddForeignKey
ALTER TABLE "hr"."PayrollItemLine" ADD CONSTRAINT "PayrollItemLine_payrollItemId_fkey" FOREIGN KEY ("payrollItemId") REFERENCES "hr"."PayrollItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
