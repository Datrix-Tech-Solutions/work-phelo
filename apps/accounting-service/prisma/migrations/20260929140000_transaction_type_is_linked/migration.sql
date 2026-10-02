-- Linked transaction types (credit / debit notes): reference and reduce an original invoice/bill.
ALTER TABLE "accounting"."TransactionType" ADD COLUMN "isLinked" BOOLEAN NOT NULL DEFAULT false;
