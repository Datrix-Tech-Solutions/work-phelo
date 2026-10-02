-- Generalizes the RCPT/PMNT-only direct-cashbook special case: any Receivable/Payable
-- transaction type can now be flagged to post a single-line entry straight to Cashbook
-- instead of creating an Invoice/Bill.

-- AlterTable
ALTER TABLE "accounting"."TransactionType" ADD COLUMN "postsToCashbook" BOOLEAN NOT NULL DEFAULT false;

-- Backfill the two system-seeded types that already behave this way.
UPDATE "accounting"."TransactionType" SET "postsToCashbook" = true WHERE "code" IN ('RCPT', 'PMNT');
