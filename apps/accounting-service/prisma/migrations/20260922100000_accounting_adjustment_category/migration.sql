-- Adjusting journals can now record why they were needed.

-- CreateEnum
CREATE TYPE "accounting"."AdjustmentCategory" AS ENUM ('ACCRUAL', 'DEPRECIATION', 'BAD_DEBT', 'DEFERRAL', 'PREPAID_RECOGNITION');

-- AlterTable
ALTER TABLE "accounting"."JournalEntry" ADD COLUMN "adjustmentCategory" "accounting"."AdjustmentCategory";
