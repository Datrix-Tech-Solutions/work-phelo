-- Generic open-item tracking for module integrations: a SourceLedgerEntry is created
-- alongside a journal a module already posted (e.g. payroll's accrual) and never generates
-- its own journal. Settling it (SourceLedgerAllocation) reuses an ordinary cashbook
-- Payment/Receipt, mirroring how AccountingPayableAllocation/AccountingReceivableAllocation
-- already work for AP/AR trade documents.

-- CreateTable
CREATE TABLE "accounting"."SourceLedgerEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceTypeId" TEXT NOT NULL,
    "glAccountId" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "sourceRecordId" TEXT,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting"."SourceLedgerAllocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceLedgerEntryId" TEXT NOT NULL,
    "cashbookTransactionId" TEXT NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "allocatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "allocatedByUserId" TEXT NOT NULL,
    "reversedAt" TIMESTAMP(3),
    "reversedByUserId" TEXT,
    "reversalReason" TEXT,

    CONSTRAINT "SourceLedgerAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceLedgerEntry_id_tenantId_key" ON "accounting"."SourceLedgerEntry"("id", "tenantId");

-- CreateIndex
CREATE INDEX "SourceLedgerEntry_tenantId_sourceTypeId_idx" ON "accounting"."SourceLedgerEntry"("tenantId", "sourceTypeId");

-- CreateIndex
CREATE INDEX "SourceLedgerEntry_tenantId_journalEntryId_idx" ON "accounting"."SourceLedgerEntry"("tenantId", "journalEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceLedgerAllocation_id_tenantId_key" ON "accounting"."SourceLedgerAllocation"("id", "tenantId");

-- CreateIndex
CREATE INDEX "SourceLedgerAllocation_tenantId_sourceLedgerEntryId_idx" ON "accounting"."SourceLedgerAllocation"("tenantId", "sourceLedgerEntryId");

-- CreateIndex
CREATE INDEX "SourceLedgerAllocation_tenantId_cashbookTransactionId_idx" ON "accounting"."SourceLedgerAllocation"("tenantId", "cashbookTransactionId");

-- AddForeignKey
ALTER TABLE "accounting"."SourceLedgerEntry" ADD CONSTRAINT "SourceLedgerEntry_sourceTypeId_tenantId_fkey" FOREIGN KEY ("sourceTypeId", "tenantId") REFERENCES "accounting"."SourceType"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting"."SourceLedgerEntry" ADD CONSTRAINT "SourceLedgerEntry_glAccountId_tenantId_fkey" FOREIGN KEY ("glAccountId", "tenantId") REFERENCES "accounting"."GLAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting"."SourceLedgerEntry" ADD CONSTRAINT "SourceLedgerEntry_journalEntryId_tenantId_fkey" FOREIGN KEY ("journalEntryId", "tenantId") REFERENCES "accounting"."JournalEntry"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting"."SourceLedgerAllocation" ADD CONSTRAINT "SourceLedgerAllocation_sourceLedgerEntryId_tenantId_fkey" FOREIGN KEY ("sourceLedgerEntryId", "tenantId") REFERENCES "accounting"."SourceLedgerEntry"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting"."SourceLedgerAllocation" ADD CONSTRAINT "SourceLedgerAllocation_cashbookTransactionId_tenantId_fkey" FOREIGN KEY ("cashbookTransactionId", "tenantId") REFERENCES "accounting"."CashbookTransaction"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
