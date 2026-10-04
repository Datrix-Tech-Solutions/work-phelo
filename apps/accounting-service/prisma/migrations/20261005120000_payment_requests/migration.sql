CREATE TYPE "accounting"."AccountingPaymentRequestStatus" AS ENUM (
  'PENDING',
  'COMPLETED',
  'REJECTED',
  'CANCELLED'
);

CREATE TABLE "accounting"."AccountingPaymentRequest" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "sourceModule" "accounting"."SourceModule" NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "invoiceId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "amount" DECIMAL(20, 4) NOT NULL,
  "currency" TEXT NOT NULL,
  "paymentDate" DATE NOT NULL,
  "reference" TEXT,
  "note" TEXT,
  "status" "accounting"."AccountingPaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
  "requestedByUserId" TEXT NOT NULL,
  "requestedByName" TEXT,
  "processingStartedAt" TIMESTAMP(3),
  "receiptId" TEXT,
  "completedAt" TIMESTAMP(3),
  "completedByUserId" TEXT,
  "rejectedAt" TIMESTAMP(3),
  "rejectedByUserId" TEXT,
  "rejectionReason" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "cancelledByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AccountingPaymentRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AccountingPaymentRequest_tenantId_sourceModule_idempotencyKey_key"
  ON "accounting"."AccountingPaymentRequest"("tenantId", "sourceModule", "idempotencyKey");

CREATE INDEX "AccountingPaymentRequest_tenantId_invoiceId_status_idx"
  ON "accounting"."AccountingPaymentRequest"("tenantId", "invoiceId", "status");

CREATE INDEX "AccountingPaymentRequest_tenantId_status_createdAt_idx"
  ON "accounting"."AccountingPaymentRequest"("tenantId", "status", "createdAt");

CREATE INDEX "AccountingPaymentRequest_tenantId_customerId_idx"
  ON "accounting"."AccountingPaymentRequest"("tenantId", "customerId");
