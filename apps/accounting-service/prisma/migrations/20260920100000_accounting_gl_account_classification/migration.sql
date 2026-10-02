-- A GL account can now sit directly under a classification, with no account group in between,
-- so the classification is stored on the account. Grouped accounts keep their group; their
-- classification is backfilled from it (and stays in step with it in the service layer).

-- AlterTable
ALTER TABLE "accounting"."GLAccount" ADD COLUMN "classificationId" TEXT;

-- Backfill from each grouped account's group
UPDATE "accounting"."GLAccount" AS a
SET "classificationId" = g."classificationId"
FROM "accounting"."AccountGroup" AS g
WHERE a."accountGroupId" = g."id"
  AND a."tenantId" = g."tenantId";

-- CreateIndex
CREATE INDEX "GLAccount_tenantId_classificationId_idx" ON "accounting"."GLAccount"("tenantId", "classificationId");

-- AddForeignKey
ALTER TABLE "accounting"."GLAccount"
  ADD CONSTRAINT "GLAccount_classificationId_tenantId_fkey"
  FOREIGN KEY ("classificationId", "tenantId")
  REFERENCES "accounting"."AccountClassification"("id", "tenantId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
