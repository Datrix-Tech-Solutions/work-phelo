-- Direct Payment/Receipt transaction types (RCPT/PMNT): the cash/bank account
-- pre-selected on the New Transaction form, still changeable there.

-- AlterTable
ALTER TABLE "accounting"."TransactionTypeRule" ADD COLUMN "defaultCashAccountId" TEXT;

-- CreateIndex
CREATE INDEX "TransactionTypeRule_tenantId_defaultCashAccountId_idx" ON "accounting"."TransactionTypeRule"("tenantId", "defaultCashAccountId");

-- AddForeignKey
ALTER TABLE "accounting"."TransactionTypeRule" ADD CONSTRAINT "TransactionTypeRule_defaultCashAccountId_tenantId_fkey" FOREIGN KEY ("defaultCashAccountId", "tenantId") REFERENCES "accounting"."AccountingCashAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
