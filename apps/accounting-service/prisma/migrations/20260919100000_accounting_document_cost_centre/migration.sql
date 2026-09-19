-- Optional cost-centre tag on Payable bills / vendor credits and Receivable invoices /
-- customer credits. The tag is copied onto the document's offset (P&L) journal line when it
-- posts, so departmental budgets can read actuals. Existing documents stay untagged.

ALTER TABLE "accounting"."AccountingReceivableDocument" ADD COLUMN "costCentreId" TEXT;
ALTER TABLE "accounting"."AccountingPayableDocument" ADD COLUMN "costCentreId" TEXT;

CREATE INDEX "AccountingReceivableDocument_tenantId_costCentreId_idx" ON "accounting"."AccountingReceivableDocument"("tenantId", "costCentreId");
CREATE INDEX "AccountingPayableDocument_tenantId_costCentreId_idx" ON "accounting"."AccountingPayableDocument"("tenantId", "costCentreId");

ALTER TABLE "accounting"."AccountingReceivableDocument" ADD CONSTRAINT "AccountingReceivableDocument_costCentreId_tenantId_fkey" FOREIGN KEY ("costCentreId", "tenantId") REFERENCES "accounting"."CostCentre"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounting"."AccountingPayableDocument" ADD CONSTRAINT "AccountingPayableDocument_costCentreId_tenantId_fkey" FOREIGN KEY ("costCentreId", "tenantId") REFERENCES "accounting"."CostCentre"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
