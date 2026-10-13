-- A bill or invoice can carry several items, each posting to its own account (all within the
-- rule's scope). The document's subtotal is their sum. Documents made before this have no lines and
-- are read as one line from the document's own account, amount and cost centre.

-- CreateTable
CREATE TABLE "accounting"."AccountingPayableDocumentLine" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "glAccountId" TEXT NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "quantity" DECIMAL(20,4),
    "unitPrice" DECIMAL(20,4),
    "description" TEXT,
    "costCentreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingPayableDocumentLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPayableDocumentLine_id_tenantId_key" ON "accounting"."AccountingPayableDocumentLine"("id", "tenantId");
CREATE UNIQUE INDEX "AccountingPayableDocumentLine_tenantId_documentId_sequence_key" ON "accounting"."AccountingPayableDocumentLine"("tenantId", "documentId", "sequence");
CREATE INDEX "AccountingPayableDocumentLine_tenantId_glAccountId_idx" ON "accounting"."AccountingPayableDocumentLine"("tenantId", "glAccountId");

-- AddForeignKey
ALTER TABLE "accounting"."AccountingPayableDocumentLine" ADD CONSTRAINT "AccountingPayableDocumentLine_documentId_tenantId_fkey" FOREIGN KEY ("documentId", "tenantId") REFERENCES "accounting"."AccountingPayableDocument"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accounting"."AccountingPayableDocumentLine" ADD CONSTRAINT "AccountingPayableDocumentLine_glAccountId_tenantId_fkey" FOREIGN KEY ("glAccountId", "tenantId") REFERENCES "accounting"."GLAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounting"."AccountingPayableDocumentLine" ADD CONSTRAINT "AccountingPayableDocumentLine_costCentreId_tenantId_fkey" FOREIGN KEY ("costCentreId", "tenantId") REFERENCES "accounting"."CostCentre"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "accounting"."AccountingReceivableDocumentLine" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "tenantId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "glAccountId" TEXT NOT NULL,
    "amount" DECIMAL(20,4) NOT NULL,
    "quantity" DECIMAL(20,4),
    "unitPrice" DECIMAL(20,4),
    "description" TEXT,
    "costCentreId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountingReceivableDocumentLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountingReceivableDocumentLine_id_tenantId_key" ON "accounting"."AccountingReceivableDocumentLine"("id", "tenantId");
CREATE UNIQUE INDEX "AccountingReceivableDocumentLine_tenantId_documentId_sequence_key" ON "accounting"."AccountingReceivableDocumentLine"("tenantId", "documentId", "sequence");
CREATE INDEX "AccountingReceivableDocumentLine_tenantId_glAccountId_idx" ON "accounting"."AccountingReceivableDocumentLine"("tenantId", "glAccountId");

-- AddForeignKey
ALTER TABLE "accounting"."AccountingReceivableDocumentLine" ADD CONSTRAINT "AccountingReceivableDocumentLine_documentId_tenantId_fkey" FOREIGN KEY ("documentId", "tenantId") REFERENCES "accounting"."AccountingReceivableDocument"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accounting"."AccountingReceivableDocumentLine" ADD CONSTRAINT "AccountingReceivableDocumentLine_glAccountId_tenantId_fkey" FOREIGN KEY ("glAccountId", "tenantId") REFERENCES "accounting"."GLAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounting"."AccountingReceivableDocumentLine" ADD CONSTRAINT "AccountingReceivableDocumentLine_costCentreId_tenantId_fkey" FOREIGN KEY ("costCentreId", "tenantId") REFERENCES "accounting"."CostCentre"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
