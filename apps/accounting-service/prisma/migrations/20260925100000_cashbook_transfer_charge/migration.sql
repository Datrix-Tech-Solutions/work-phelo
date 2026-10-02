-- Lets a cash/bank transfer carry an optional bank charge in the same transaction,
-- instead of requiring a separate standalone charge entry. The existing
-- offsetGlAccountId column (unused by TRANSFER until now) is reused as the charges
-- expense account when chargeAmount is set.

-- AlterTable
ALTER TABLE "accounting"."CashbookTransaction" ADD COLUMN "chargeAmount" DECIMAL(20,4);
