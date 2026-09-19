-- Budgets: per-period targets by GL account, optionally split by cost centre. Actuals are
-- not stored — they are rolled up from posted journal lines when a budget is read.

-- CreateEnum
CREATE TYPE "accounting"."BudgetPeriod" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "accounting"."BudgetScope" AS ENUM ('EXPENSE', 'INCOME', 'BOTH');

-- CreateEnum
CREATE TYPE "accounting"."BudgetStatus" AS ENUM ('DRAFT', 'ACTIVE', 'CLOSED');

-- CreateTable
CREATE TABLE "accounting"."Budget" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "period" "accounting"."BudgetPeriod" NOT NULL,
    "scope" "accounting"."BudgetScope" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "accounting"."BudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting"."BudgetLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "glAccountId" TEXT NOT NULL,
    "costCentreId" TEXT,
    "amount" DECIMAL(20,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Budget_id_tenantId_key" ON "accounting"."Budget"("id", "tenantId");

-- CreateIndex
CREATE INDEX "Budget_tenantId_status_startDate_idx" ON "accounting"."Budget"("tenantId", "status", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLine_id_tenantId_key" ON "accounting"."BudgetLine"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLine_budgetId_glAccountId_costCentreId_key" ON "accounting"."BudgetLine"("budgetId", "glAccountId", "costCentreId");

-- CreateIndex
CREATE INDEX "BudgetLine_tenantId_budgetId_idx" ON "accounting"."BudgetLine"("tenantId", "budgetId");

-- CreateIndex
CREATE INDEX "BudgetLine_tenantId_glAccountId_idx" ON "accounting"."BudgetLine"("tenantId", "glAccountId");

-- CreateIndex
CREATE INDEX "BudgetLine_tenantId_costCentreId_idx" ON "accounting"."BudgetLine"("tenantId", "costCentreId");

-- AddForeignKey
ALTER TABLE "accounting"."BudgetLine" ADD CONSTRAINT "BudgetLine_budgetId_tenantId_fkey" FOREIGN KEY ("budgetId", "tenantId") REFERENCES "accounting"."Budget"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting"."BudgetLine" ADD CONSTRAINT "BudgetLine_glAccountId_tenantId_fkey" FOREIGN KEY ("glAccountId", "tenantId") REFERENCES "accounting"."GLAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting"."BudgetLine" ADD CONSTRAINT "BudgetLine_costCentreId_tenantId_fkey" FOREIGN KEY ("costCentreId", "tenantId") REFERENCES "accounting"."CostCentre"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
