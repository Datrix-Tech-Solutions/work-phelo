-- A Receivable/Payable rule's main line can now be a scope (a whole category, or one
-- classification) instead of a single fixed account, so the user picks the account on the
-- transaction form and one transaction type serves many accounts. Existing rules keep their
-- fixed account.

-- AlterTable
ALTER TABLE "accounting"."TransactionTypeRuleLine" ALTER COLUMN "accountId" DROP NOT NULL;
ALTER TABLE "accounting"."TransactionTypeRuleLine" ADD COLUMN "scopeCategory" "accounting"."GLAccountCategory";
ALTER TABLE "accounting"."TransactionTypeRuleLine" ADD COLUMN "scopeClassificationId" TEXT;

-- At most one of a fixed account or a scope.
ALTER TABLE "accounting"."TransactionTypeRuleLine" ADD CONSTRAINT "TransactionTypeRuleLine_account_or_scope_check"
  CHECK (("accountId" IS NOT NULL)::int + ("scopeCategory" IS NOT NULL)::int + ("scopeClassificationId" IS NOT NULL)::int = 1);

-- CreateIndex
CREATE INDEX "TransactionTypeRuleLine_tenantId_scopeClassificationId_idx" ON "accounting"."TransactionTypeRuleLine"("tenantId", "scopeClassificationId");

-- AddForeignKey
ALTER TABLE "accounting"."TransactionTypeRuleLine" ADD CONSTRAINT "TransactionTypeRuleLine_scopeClassificationId_tenantId_fkey" FOREIGN KEY ("scopeClassificationId", "tenantId") REFERENCES "accounting"."AccountClassification"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
