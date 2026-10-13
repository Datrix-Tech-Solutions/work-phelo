-- A draft can now be turned down: it keeps its record, never posts, and the reason is stored.
ALTER TYPE "accounting"."AccountingReceivableStatus" ADD VALUE 'REJECTED';
ALTER TYPE "accounting"."CashbookTransactionStatus" ADD VALUE 'REJECTED';

ALTER TABLE "accounting"."AccountingReceivableDocument"
  ADD COLUMN "rejectedByUserId" TEXT,
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "rejectedAt" TIMESTAMP(3);

ALTER TABLE "accounting"."CashbookTransaction"
  ADD COLUMN "rejectedByUserId" TEXT,
  ADD COLUMN "rejectionReason" TEXT,
  ADD COLUMN "rejectedAt" TIMESTAMP(3);

-- Transactions another module asked Accounting to raise, kept idempotent by the caller's key.
CREATE TYPE "accounting"."AccountingSourceTransactionKind" AS ENUM ('INVOICE', 'RECEIPT');

CREATE TABLE "accounting"."AccountingSourceTransaction" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "sourceModule" "accounting"."SourceModule" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "sourceRecordId" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "transactionTypeId" TEXT NOT NULL,
  "kind" "accounting"."AccountingSourceTransactionKind" NOT NULL,
  "documentId" TEXT,
  "amount" DECIMAL(20, 4) NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AccountingSourceTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountingSourceTransaction_tenantId_sourceModule_idempotencyKey_key"
  ON "accounting"."AccountingSourceTransaction"("tenantId", "sourceModule", "idempotencyKey");

CREATE INDEX "AccountingSourceTransaction_tenantId_sourceModule_sourceRecordId_idx"
  ON "accounting"."AccountingSourceTransaction"("tenantId", "sourceModule", "sourceRecordId");

CREATE INDEX "AccountingSourceTransaction_tenantId_documentId_idx"
  ON "accounting"."AccountingSourceTransaction"("tenantId", "documentId");
