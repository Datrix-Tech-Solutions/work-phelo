-- A tax type can name the account it posts to by default on each side, so a bill, invoice or
-- payment form can pre-fill it. Taxes are no longer set up one by one on each transaction type's
-- rule.

-- AlterTable
ALTER TABLE "accounting"."TaxType" ADD COLUMN "payableAccountId" TEXT;
ALTER TABLE "accounting"."TaxType" ADD COLUMN "receivableAccountId" TEXT;

-- AddForeignKey
ALTER TABLE "accounting"."TaxType" ADD CONSTRAINT "TaxType_payableAccountId_tenantId_fkey" FOREIGN KEY ("payableAccountId", "tenantId") REFERENCES "accounting"."GLAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounting"."TaxType" ADD CONSTRAINT "TaxType_receivableAccountId_tenantId_fkey" FOREIGN KEY ("receivableAccountId", "tenantId") REFERENCES "accounting"."GLAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
