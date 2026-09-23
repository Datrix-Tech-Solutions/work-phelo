-- Cash Flow Statement categorization: an optional tag on classification, group and account,
-- each level overriding the one above. Cash accounts themselves are excluded automatically
-- from AccountingCashAccount, never tagged here.

-- CreateEnum
CREATE TYPE "accounting"."CashFlowCategory" AS ENUM ('OPERATING', 'INVESTING', 'FINANCING', 'EXCLUDED');

-- AlterTable
ALTER TABLE "accounting"."AccountClassification" ADD COLUMN "cashFlowCategory" "accounting"."CashFlowCategory";
ALTER TABLE "accounting"."AccountGroup" ADD COLUMN "cashFlowCategory" "accounting"."CashFlowCategory";
ALTER TABLE "accounting"."GLAccount" ADD COLUMN "cashFlowCategory" "accounting"."CashFlowCategory";
