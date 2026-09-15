-- CreateTable
CREATE TABLE "accounting"."TaxType" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "rate" DECIMAL(6,3) NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TaxType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting"."TransactionTypeRule" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "transactionTypeId" TEXT NOT NULL,
  "description" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TransactionTypeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting"."TransactionTypeRuleLine" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "direction" "accounting"."PostingDirection" NOT NULL,
  "accountId" TEXT NOT NULL,
  "taxTypeId" TEXT,
  "subledgerType" "accounting"."SubledgerType",
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TransactionTypeRuleLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TaxType_id_tenantId_key" ON "accounting"."TaxType"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TaxType_tenantId_name_key" ON "accounting"."TaxType"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionTypeRule_id_tenantId_key" ON "accounting"."TransactionTypeRule"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionTypeRule_tenantId_transactionTypeId_key" ON "accounting"."TransactionTypeRule"("tenantId", "transactionTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionTypeRuleLine_id_tenantId_key" ON "accounting"."TransactionTypeRuleLine"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionTypeRuleLine_tenantId_ruleId_sequence_key" ON "accounting"."TransactionTypeRuleLine"("tenantId", "ruleId", "sequence");

-- CreateIndex
CREATE INDEX "TransactionTypeRuleLine_tenantId_accountId_idx" ON "accounting"."TransactionTypeRuleLine"("tenantId", "accountId");

-- AddForeignKey
ALTER TABLE "accounting"."TransactionTypeRule" ADD CONSTRAINT "TransactionTypeRule_transactionTypeId_tenantId_fkey" FOREIGN KEY ("transactionTypeId", "tenantId") REFERENCES "accounting"."TransactionType"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting"."TransactionTypeRuleLine" ADD CONSTRAINT "TransactionTypeRuleLine_ruleId_tenantId_fkey" FOREIGN KEY ("ruleId", "tenantId") REFERENCES "accounting"."TransactionTypeRule"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting"."TransactionTypeRuleLine" ADD CONSTRAINT "TransactionTypeRuleLine_accountId_tenantId_fkey" FOREIGN KEY ("accountId", "tenantId") REFERENCES "accounting"."GLAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting"."TransactionTypeRuleLine" ADD CONSTRAINT "TransactionTypeRuleLine_taxTypeId_tenantId_fkey" FOREIGN KEY ("taxTypeId", "tenantId") REFERENCES "accounting"."TaxType"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
