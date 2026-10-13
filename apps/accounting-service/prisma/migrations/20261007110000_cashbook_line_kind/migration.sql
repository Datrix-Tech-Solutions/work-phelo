-- A line on a direct receipt/payment is an item, or an adjustment: a deduction (discount,
-- withholding tax) that takes away from the cash that moves, or a charge (input VAT, bank charge)
-- that adds to it. Existing lines are items.

-- CreateEnum
CREATE TYPE "accounting"."CashbookLineKind" AS ENUM ('ITEM', 'DEDUCTION', 'CHARGE');

-- AlterTable
ALTER TABLE "accounting"."CashbookTransactionLine" ADD COLUMN "kind" "accounting"."CashbookLineKind" NOT NULL DEFAULT 'ITEM';
