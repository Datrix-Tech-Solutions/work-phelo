-- Payroll configuration: the pay components that decide how each payslip type is calculated,
-- with a version history (each version has an effective date) and a library of saved components.

-- CreateEnum
CREATE TYPE "hr"."PayrollPayslipType" AS ENUM ('MONTHLY', 'COMMISSION', 'MONTHLY_COMMISSION');

-- CreateTable
CREATE TABLE "hr"."PayrollConfiguration" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "payslipType" "hr"."PayrollPayslipType",
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."PayrollConfigurationVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "components" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollConfigurationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."PayrollSavedComponent" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "component" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollSavedComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollConfiguration_tenantId_idx" ON "hr"."PayrollConfiguration"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollConfiguration_tenantId_payslipType_key" ON "hr"."PayrollConfiguration"("tenantId", "payslipType");

-- CreateIndex
CREATE INDEX "PayrollConfigurationVersion_tenantId_configurationId_effect_idx" ON "hr"."PayrollConfigurationVersion"("tenantId", "configurationId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollConfigurationVersion_configurationId_version_key" ON "hr"."PayrollConfigurationVersion"("configurationId", "version");

-- CreateIndex
CREATE INDEX "PayrollSavedComponent_tenantId_idx" ON "hr"."PayrollSavedComponent"("tenantId");

-- AddForeignKey
ALTER TABLE "hr"."PayrollConfigurationVersion" ADD CONSTRAINT "PayrollConfigurationVersion_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "hr"."PayrollConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
