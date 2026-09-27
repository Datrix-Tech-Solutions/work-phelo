-- A transaction type linked to a Source is usable on New Transaction without a rule — its
-- offset account/amount come from picking one of that source's open SourceLedgerEntry items
-- instead of a preconfigured rule line.

-- AlterTable
ALTER TABLE "accounting"."TransactionType" ADD COLUMN "sourceTypeId" TEXT;

-- CreateIndex
CREATE INDEX "TransactionType_tenantId_sourceTypeId_idx" ON "accounting"."TransactionType"("tenantId", "sourceTypeId");

-- AddForeignKey
ALTER TABLE "accounting"."TransactionType" ADD CONSTRAINT "TransactionType_sourceTypeId_tenantId_fkey" FOREIGN KEY ("sourceTypeId", "tenantId") REFERENCES "accounting"."SourceType"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
