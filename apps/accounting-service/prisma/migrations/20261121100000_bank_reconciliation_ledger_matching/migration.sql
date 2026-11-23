-- Statement values are no longer imported and stored as a file: the user brings them to the
-- reconcile page, ticks off what is reconciled on each side, and a completed reconciliation is
-- saved in one go. Reconciled ledger lines (JournalLine) are recorded on their own; the old
-- per-row Cashbook link and the import fingerprint go.

-- DropForeignKey
ALTER TABLE "accounting"."BankStatementLine"
  DROP CONSTRAINT "BankStatementLine_matchedCashbookTransactionId_tenantId_fkey";

-- DropIndex
DROP INDEX "accounting"."BankStatementLine_reconciliationId_matchedCashbookTransactionId_key";
DROP INDEX "accounting"."BankStatementLine_tenantId_reconciliationId_sourceFingerpri_key";

-- AlterTable
ALTER TABLE "accounting"."BankStatementLine"
  DROP COLUMN "matchedCashbookTransactionId",
  DROP COLUMN "sourceFingerprint";

-- CreateTable
CREATE TABLE "accounting"."BankReconciledEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "journalLineId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankReconciledEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankReconciledEntry_id_tenantId_key" ON "accounting"."BankReconciledEntry"("id", "tenantId");
CREATE UNIQUE INDEX "BankReconciledEntry_tenantId_journalLineId_key" ON "accounting"."BankReconciledEntry"("tenantId", "journalLineId");
CREATE INDEX "BankReconciledEntry_tenantId_reconciliationId_idx" ON "accounting"."BankReconciledEntry"("tenantId", "reconciliationId");

-- AddForeignKey
ALTER TABLE "accounting"."BankReconciledEntry"
  ADD CONSTRAINT "BankReconciledEntry_reconciliationId_tenantId_fkey"
  FOREIGN KEY ("reconciliationId", "tenantId")
  REFERENCES "accounting"."BankReconciliation"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounting"."BankReconciledEntry"
  ADD CONSTRAINT "BankReconciledEntry_journalLineId_tenantId_fkey"
  FOREIGN KEY ("journalLineId", "tenantId")
  REFERENCES "accounting"."JournalLine"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
