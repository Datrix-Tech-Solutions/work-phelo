-- A posted journal can be voided while its period is open. Voided journals count nowhere.
ALTER TYPE "accounting"."JournalStatus" ADD VALUE IF NOT EXISTS 'VOIDED';

ALTER TABLE "accounting"."JournalEntry"
  ADD COLUMN "voidedAt" TIMESTAMP(3),
  ADD COLUMN "voidedByUserId" TEXT,
  ADD COLUMN "voidReason" TEXT,
  ADD COLUMN "voidedReversalOfJournalId" TEXT;

-- Cashbook transactions can be voided the same way.
ALTER TYPE "accounting"."CashbookTransactionStatus" ADD VALUE IF NOT EXISTS 'VOIDED';

ALTER TABLE "accounting"."CashbookTransaction"
  ADD COLUMN "voidedAt" TIMESTAMP(3),
  ADD COLUMN "voidedByUserId" TEXT,
  ADD COLUMN "voidReason" TEXT,
  ADD COLUMN "voidedReversalOfTransactionId" TEXT;

-- Invoices, bills, credit and debit notes, receipts and payments too.
ALTER TYPE "accounting"."AccountingReceivableStatus" ADD VALUE IF NOT EXISTS 'VOIDED';
ALTER TYPE "accounting"."AccountingPayableStatus" ADD VALUE IF NOT EXISTS 'VOIDED';

ALTER TABLE "accounting"."AccountingReceivableDocument"
  ADD COLUMN "voidedAt" TIMESTAMP(3),
  ADD COLUMN "voidedByUserId" TEXT,
  ADD COLUMN "voidReason" TEXT;
ALTER TABLE "accounting"."AccountingReceivableReceipt"
  ADD COLUMN "voidedAt" TIMESTAMP(3),
  ADD COLUMN "voidedByUserId" TEXT,
  ADD COLUMN "voidReason" TEXT;
ALTER TABLE "accounting"."AccountingPayableDocument"
  ADD COLUMN "voidedAt" TIMESTAMP(3),
  ADD COLUMN "voidedByUserId" TEXT,
  ADD COLUMN "voidReason" TEXT;
ALTER TABLE "accounting"."AccountingPayablePayment"
  ADD COLUMN "voidedAt" TIMESTAMP(3),
  ADD COLUMN "voidedByUserId" TEXT,
  ADD COLUMN "voidReason" TEXT;
