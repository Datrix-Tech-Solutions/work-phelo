-- CreateEnum
CREATE TYPE "accounting"."TransactionTypeCategory" AS ENUM (
  'NEUTRAL',
  'RECEIVABLE',
  'PAYABLE',
  'NONE'
);

-- CreateTable
CREATE TABLE "accounting"."TransactionType" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" "accounting"."TransactionTypeCategory" NOT NULL,
  "businessRoles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "allowedDocument" TEXT,
  "source" TEXT,
  "description" TEXT,
  "isSystemDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TransactionType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TransactionType_id_tenantId_key"
  ON "accounting"."TransactionType"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionType_tenantId_code_key"
  ON "accounting"."TransactionType"("tenantId", "code");

-- CreateIndex
CREATE INDEX "TransactionType_tenantId_category_idx"
  ON "accounting"."TransactionType"("tenantId", "category");
