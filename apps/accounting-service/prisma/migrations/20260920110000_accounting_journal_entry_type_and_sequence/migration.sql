-- Journals get an entry type, and journal numbers come from gapless per-tenant sequences
-- (JE-<type code><yymm>-<n>, e.g. JE-STN2609-0000) instead of a random suffix.

-- CreateEnum
CREATE TYPE "accounting"."JournalEntryType" AS ENUM ('STANDARD', 'ADJUSTING', 'REVERSING', 'CLOSING', 'OPENING', 'RECURRING');

-- AlterTable
ALTER TABLE "accounting"."JournalEntry" ADD COLUMN "entryType" "accounting"."JournalEntryType" NOT NULL DEFAULT 'STANDARD';

-- Existing reversal journals are REVERSING entries
UPDATE "accounting"."JournalEntry" SET "entryType" = 'REVERSING' WHERE "reversalOfJournalId" IS NOT NULL;

-- CreateTable
CREATE TABLE "accounting"."JournalNumberSequence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalNumberSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalNumberSequence_tenantId_key_key" ON "accounting"."JournalNumberSequence"("tenantId", "key");
