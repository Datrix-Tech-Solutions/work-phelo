-- A cashbook line can name the tax type it was picked from, so a tax taken on a receipt or
-- payment can be traced and reported on. Existing lines have none.
ALTER TABLE "accounting"."CashbookTransactionLine" ADD COLUMN "taxTypeId" TEXT;

CREATE INDEX "CashbookTransactionLine_tenantId_taxTypeId_idx" ON "accounting"."CashbookTransactionLine"("tenantId", "taxTypeId");

ALTER TABLE "accounting"."CashbookTransactionLine" ADD CONSTRAINT "CashbookTransactionLine_taxTypeId_tenantId_fkey" FOREIGN KEY ("taxTypeId", "tenantId") REFERENCES "accounting"."TaxType"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
