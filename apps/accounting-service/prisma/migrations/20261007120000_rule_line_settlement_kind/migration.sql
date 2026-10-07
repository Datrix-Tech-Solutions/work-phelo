-- A rule line can apply when a bill/invoice is settled instead of when it is raised: a deduction
-- (discount, withholding tax) or a charge (bank charge). Existing lines are document lines.

-- CreateEnum
CREATE TYPE "accounting"."RuleLineSettlementKind" AS ENUM ('DEDUCTION', 'CHARGE');

-- AlterTable
ALTER TABLE "accounting"."TransactionTypeRuleLine" ADD COLUMN "settlementKind" "accounting"."RuleLineSettlementKind";
