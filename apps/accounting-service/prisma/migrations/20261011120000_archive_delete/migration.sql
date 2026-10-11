-- Deleting an archived (voided) entry hides it from the archive for good. The row, its journals and
-- the audit trail stay, so numbering gaps and history remain explainable.
ALTER TABLE "accounting"."JournalEntry"
  ADD COLUMN "archiveDeletedAt" TIMESTAMP(3),
  ADD COLUMN "archiveDeletedByUserId" TEXT;

ALTER TABLE "accounting"."CashbookTransaction"
  ADD COLUMN "archiveDeletedAt" TIMESTAMP(3),
  ADD COLUMN "archiveDeletedByUserId" TEXT;

ALTER TABLE "accounting"."AccountingReceivableDocument"
  ADD COLUMN "archiveDeletedAt" TIMESTAMP(3),
  ADD COLUMN "archiveDeletedByUserId" TEXT;

ALTER TABLE "accounting"."AccountingReceivableReceipt"
  ADD COLUMN "archiveDeletedAt" TIMESTAMP(3),
  ADD COLUMN "archiveDeletedByUserId" TEXT;

ALTER TABLE "accounting"."AccountingPayableDocument"
  ADD COLUMN "archiveDeletedAt" TIMESTAMP(3),
  ADD COLUMN "archiveDeletedByUserId" TEXT;

ALTER TABLE "accounting"."AccountingPayablePayment"
  ADD COLUMN "archiveDeletedAt" TIMESTAMP(3),
  ADD COLUMN "archiveDeletedByUserId" TEXT;
