-- A transaction type can now say whether its form asks for quantity x unit price or just an
-- amount. Existing types keep asking for quantity and price.

-- AlterTable
ALTER TABLE "accounting"."TransactionType" ADD COLUMN "usesQuantityPrice" BOOLEAN NOT NULL DEFAULT true;
