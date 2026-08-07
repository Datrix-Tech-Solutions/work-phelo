-- AlterTable
ALTER TABLE "hr"."Asset" ADD COLUMN     "branchId" TEXT;

-- CreateIndex
CREATE INDEX "Asset_tenantId_branchId_idx" ON "hr"."Asset"("tenantId", "branchId");

-- AddForeignKey
ALTER TABLE "hr"."Asset" ADD CONSTRAINT "Asset_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "hr"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
