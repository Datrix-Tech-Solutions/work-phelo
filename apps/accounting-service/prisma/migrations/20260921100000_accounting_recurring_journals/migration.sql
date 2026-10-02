-- Recurring journal templates and the link from the journals they generate.

-- CreateEnum
CREATE TYPE "accounting"."RecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY');
CREATE TYPE "accounting"."RecurringOnGeneration" AS ENUM ('AUTO_POST', 'CREATE_DRAFT');
CREATE TYPE "accounting"."RecurringJournalStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "accounting"."RecurringJournal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "frequency" "accounting"."RecurrenceFrequency" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "nextRunDate" DATE NOT NULL,
    "onGeneration" "accounting"."RecurringOnGeneration" NOT NULL,
    "status" "accounting"."RecurringJournalStatus" NOT NULL DEFAULT 'ACTIVE',
    "transactionCurrency" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "updatedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringJournal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "accounting"."RecurringJournalLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "recurringJournalId" TEXT NOT NULL,
    "lineNumber" INTEGER NOT NULL,
    "glAccountId" TEXT NOT NULL,
    "description" TEXT,
    "debit" DECIMAL(20,4) NOT NULL DEFAULT 0,
    "credit" DECIMAL(20,4) NOT NULL DEFAULT 0,

    CONSTRAINT "RecurringJournalLine_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "accounting"."JournalEntry" ADD COLUMN "recurringJournalId" TEXT;
ALTER TABLE "accounting"."JournalEntry" ADD COLUMN "recurringRunDate" DATE;

-- CreateIndex
CREATE UNIQUE INDEX "RecurringJournal_id_tenantId_key" ON "accounting"."RecurringJournal"("id", "tenantId");
CREATE UNIQUE INDEX "RecurringJournal_tenantId_name_key" ON "accounting"."RecurringJournal"("tenantId", "name");
CREATE INDEX "RecurringJournal_status_nextRunDate_idx" ON "accounting"."RecurringJournal"("status", "nextRunDate");
CREATE INDEX "RecurringJournal_tenantId_status_idx" ON "accounting"."RecurringJournal"("tenantId", "status");
CREATE UNIQUE INDEX "RecurringJournalLine_recurringJournalId_lineNumber_key" ON "accounting"."RecurringJournalLine"("recurringJournalId", "lineNumber");
CREATE INDEX "RecurringJournalLine_tenantId_glAccountId_idx" ON "accounting"."RecurringJournalLine"("tenantId", "glAccountId");
-- One journal per template per run date, so a date can never be generated twice
CREATE UNIQUE INDEX "JournalEntry_recurringJournalId_recurringRunDate_key" ON "accounting"."JournalEntry"("recurringJournalId", "recurringRunDate");

-- AddForeignKey
ALTER TABLE "accounting"."RecurringJournalLine"
  ADD CONSTRAINT "RecurringJournalLine_recurringJournalId_tenantId_fkey"
  FOREIGN KEY ("recurringJournalId", "tenantId")
  REFERENCES "accounting"."RecurringJournal"("id", "tenantId")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accounting"."RecurringJournalLine"
  ADD CONSTRAINT "RecurringJournalLine_glAccountId_tenantId_fkey"
  FOREIGN KEY ("glAccountId", "tenantId")
  REFERENCES "accounting"."GLAccount"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounting"."JournalEntry"
  ADD CONSTRAINT "JournalEntry_recurringJournalId_tenantId_fkey"
  FOREIGN KEY ("recurringJournalId", "tenantId")
  REFERENCES "accounting"."RecurringJournal"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
