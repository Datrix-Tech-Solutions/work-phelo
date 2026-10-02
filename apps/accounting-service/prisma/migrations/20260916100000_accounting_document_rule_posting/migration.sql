-- AlterTable
ALTER TABLE "accounting"."AccountingReceivableDocument"
  ADD COLUMN "transactionTypeId" TEXT,
  ADD COLUMN "taxBreakdown" JSONB;

-- AlterTable
ALTER TABLE "accounting"."AccountingPayableDocument"
  ADD COLUMN "transactionTypeId" TEXT,
  ADD COLUMN "taxBreakdown" JSONB;
