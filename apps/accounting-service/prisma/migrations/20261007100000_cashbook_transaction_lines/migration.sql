-- A direct receipt or payment can post to several accounts against one cash line. Each account is
-- a line; the entry's amount is their sum. Entries made before this have no lines and are read as
-- one line from the header's offset account.

-- CreateTable
CREATE TABLE "accounting"."CashbookTransactionLine" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenantId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "glAccountId" TEXT NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "quantity" DECIMAL(20,4),
    "unitPrice" DECIMAL(20,4),
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CashbookTransactionLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CashbookTransactionLine_id_tenantId_key" ON "accounting"."CashbookTransactionLine"("id", "tenantId");
CREATE UNIQUE INDEX "CashbookTransactionLine_tenantId_transactionId_sequence_key" ON "accounting"."CashbookTransactionLine"("tenantId", "transactionId", "sequence");
CREATE INDEX "CashbookTransactionLine_tenantId_glAccountId_idx" ON "accounting"."CashbookTransactionLine"("tenantId", "glAccountId");

-- AddForeignKey
ALTER TABLE "accounting"."CashbookTransactionLine" ADD CONSTRAINT "CashbookTransactionLine_transactionId_tenantId_fkey" FOREIGN KEY ("transactionId", "tenantId") REFERENCES "accounting"."CashbookTransaction"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accounting"."CashbookTransactionLine" ADD CONSTRAINT "CashbookTransactionLine_glAccountId_tenantId_fkey" FOREIGN KEY ("glAccountId", "tenantId") REFERENCES "accounting"."GLAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
