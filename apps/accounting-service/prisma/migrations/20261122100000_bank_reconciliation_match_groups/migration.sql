-- Reconciling is done in groups: the user ticks rows on both sides and removes them together.
-- The group number is kept on both sides so a reconciliation can show what was paired.

-- AlterTable
ALTER TABLE "accounting"."BankStatementLine" ADD COLUMN "matchGroup" INTEGER;

-- AlterTable
ALTER TABLE "accounting"."BankReconciledEntry" ADD COLUMN "matchGroup" INTEGER NOT NULL DEFAULT 0;
