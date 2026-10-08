-- Payroll groups: sets of employees paid the same way, each with a pay frequency, a payday, the
-- payroll configuration it is calculated with and a payday reminder. Employees join groups later.

-- CreateEnum
CREATE TYPE "hr"."PayrollPayFrequency" AS ENUM ('MONTHLY', 'BIWEEKLY', 'WEEKLY');
-- CreateEnum
CREATE TYPE "hr"."PayrollPaydayKind" AS ENUM ('DAY_OF_MONTH', 'LAST_DAY');
-- CreateTable
CREATE TABLE "hr"."PayrollGroup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "frequency" "hr"."PayrollPayFrequency" NOT NULL DEFAULT 'MONTHLY',
    "paydayKind" "hr"."PayrollPaydayKind" NOT NULL,
    "paydayDay" INTEGER,
    "configurationId" TEXT NOT NULL,
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderDaysBefore" INTEGER NOT NULL DEFAULT 3,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PayrollGroup_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "PayrollGroup_tenantId_idx" ON "hr"."PayrollGroup"("tenantId");
-- CreateIndex
CREATE INDEX "PayrollGroup_configurationId_idx" ON "hr"."PayrollGroup"("configurationId");
-- CreateIndex
CREATE UNIQUE INDEX "PayrollGroup_tenantId_name_key" ON "hr"."PayrollGroup"("tenantId", "name");
-- AddForeignKey
ALTER TABLE "hr"."PayrollGroup" ADD CONSTRAINT "PayrollGroup_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "hr"."PayrollConfiguration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
