-- A scoped main line can now list several scopes (each a whole category, one classification or one
-- specific account), and the user picks one account from any of them. Existing scoped lines become a list of one.

-- CreateTable
CREATE TABLE "accounting"."TransactionTypeRuleLineScope" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ruleLineId" TEXT NOT NULL,
    "category" "accounting"."GLAccountCategory" NOT NULL,
    "classificationId" TEXT,
    "accountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionTypeRuleLineScope_pkey" PRIMARY KEY ("id")
);

-- Carry the existing scopes over: a classification scope keeps its classification (and takes the
-- classification's category); a category scope keeps just the category.
INSERT INTO "accounting"."TransactionTypeRuleLineScope" ("id", "tenantId", "ruleLineId", "category", "classificationId")
SELECT gen_random_uuid()::text, l."tenantId", l."id",
       COALESCE(l."scopeCategory", c."category"), l."scopeClassificationId"
FROM "accounting"."TransactionTypeRuleLine" l
LEFT JOIN "accounting"."AccountClassification" c
  ON c."id" = l."scopeClassificationId" AND c."tenantId" = l."tenantId"
WHERE l."scopeCategory" IS NOT NULL OR l."scopeClassificationId" IS NOT NULL;

-- The single-scope columns and their rule are replaced by the table.
ALTER TABLE "accounting"."TransactionTypeRuleLine" DROP CONSTRAINT "TransactionTypeRuleLine_account_or_scope_check";
ALTER TABLE "accounting"."TransactionTypeRuleLine" DROP CONSTRAINT "TransactionTypeRuleLine_scopeClassificationId_tenantId_fkey";
DROP INDEX "accounting"."TransactionTypeRuleLine_tenantId_scopeClassificationId_idx";
ALTER TABLE "accounting"."TransactionTypeRuleLine" DROP COLUMN "scopeCategory";
ALTER TABLE "accounting"."TransactionTypeRuleLine" DROP COLUMN "scopeClassificationId";

-- CreateIndex
CREATE UNIQUE INDEX "TransactionTypeRuleLineScope_id_tenantId_key" ON "accounting"."TransactionTypeRuleLineScope"("id", "tenantId");
CREATE INDEX "TransactionTypeRuleLineScope_tenantId_ruleLineId_idx" ON "accounting"."TransactionTypeRuleLineScope"("tenantId", "ruleLineId");
CREATE INDEX "TransactionTypeRuleLineScope_tenantId_classificationId_idx" ON "accounting"."TransactionTypeRuleLineScope"("tenantId", "classificationId");
CREATE INDEX "TransactionTypeRuleLineScope_tenantId_accountId_idx" ON "accounting"."TransactionTypeRuleLineScope"("tenantId", "accountId");

-- AddForeignKey
ALTER TABLE "accounting"."TransactionTypeRuleLineScope" ADD CONSTRAINT "TransactionTypeRuleLineScope_ruleLineId_tenantId_fkey" FOREIGN KEY ("ruleLineId", "tenantId") REFERENCES "accounting"."TransactionTypeRuleLine"("id", "tenantId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "accounting"."TransactionTypeRuleLineScope" ADD CONSTRAINT "TransactionTypeRuleLineScope_classificationId_tenantId_fkey" FOREIGN KEY ("classificationId", "tenantId") REFERENCES "accounting"."AccountClassification"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accounting"."TransactionTypeRuleLineScope" ADD CONSTRAINT "TransactionTypeRuleLineScope_accountId_tenantId_fkey" FOREIGN KEY ("accountId", "tenantId") REFERENCES "accounting"."GLAccount"("id", "tenantId") ON DELETE RESTRICT ON UPDATE CASCADE;
