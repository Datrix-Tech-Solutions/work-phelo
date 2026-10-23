CREATE TABLE "w_auth"."TenantDocumentTemplate" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "config" JSONB NOT NULL,
  "watermarkObjectKey" TEXT,
  "watermarkMimeType" TEXT,
  "watermarkFileName" TEXT,
  "watermarkSizeBytes" INTEGER,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TenantDocumentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TenantDocumentTemplate_tenantId_key" ON "w_auth"."TenantDocumentTemplate"("tenantId");
CREATE INDEX "TenantDocumentTemplate_createdByUserId_idx" ON "w_auth"."TenantDocumentTemplate"("createdByUserId");
CREATE INDEX "TenantDocumentTemplate_updatedByUserId_idx" ON "w_auth"."TenantDocumentTemplate"("updatedByUserId");

ALTER TABLE "w_auth"."TenantDocumentTemplate" ADD CONSTRAINT "TenantDocumentTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "w_auth"."Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "w_auth"."TenantDocumentTemplate" ADD CONSTRAINT "TenantDocumentTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "w_auth"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "w_auth"."TenantDocumentTemplate" ADD CONSTRAINT "TenantDocumentTemplate_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "w_auth"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
