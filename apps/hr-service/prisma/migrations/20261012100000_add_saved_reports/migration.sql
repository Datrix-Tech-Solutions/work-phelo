-- Saved reports for the HR report builder. Visible to everyone who can open the reports page.

-- CreateTable
CREATE TABLE "hr"."SavedReport" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "definition" JSONB NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SavedReport_pkey" PRIMARY KEY ("id")
);
-- CreateIndex
CREATE INDEX "SavedReport_tenantId_idx" ON "hr"."SavedReport"("tenantId");
-- CreateIndex
CREATE UNIQUE INDEX "SavedReport_tenantId_name_key" ON "hr"."SavedReport"("tenantId", "name");
