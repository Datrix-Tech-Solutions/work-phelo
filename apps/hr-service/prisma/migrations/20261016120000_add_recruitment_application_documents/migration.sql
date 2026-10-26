CREATE TYPE "hr"."RecruitmentDocumentType" AS ENUM ('RESUME', 'COVER_LETTER', 'OTHER');
CREATE TYPE "hr"."RecruitmentDocumentStatus" AS ENUM ('ACTIVE', 'RETIRED');

CREATE UNIQUE INDEX "RecruitmentApplication_tenantId_id_key"
ON "hr"."RecruitmentApplication"("tenantId", "id");

CREATE TABLE "hr"."RecruitmentApplicationDocument" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "type" "hr"."RecruitmentDocumentType" NOT NULL,
  "originalFileName" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "status" "hr"."RecruitmentDocumentStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecruitmentApplicationDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RecruitmentApplicationDocument_tenantId_applicationId_fkey"
    FOREIGN KEY ("tenantId", "applicationId")
    REFERENCES "hr"."RecruitmentApplication"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "RecruitmentApplicationDocument_sizeBytes_check" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 15728640)
);

CREATE INDEX "RecruitmentApplicationDocument_tenantId_applicationId_status_idx"
ON "hr"."RecruitmentApplicationDocument"("tenantId", "applicationId", "status");

-- Preserve replacement history while allowing only one current resume/cover letter.
CREATE UNIQUE INDEX "RecruitmentApplicationDocument_active_type_key"
ON "hr"."RecruitmentApplicationDocument"("tenantId", "applicationId", "type")
WHERE "status" = 'ACTIVE' AND "type" IN ('RESUME', 'COVER_LETTER');

-- Legacy external URL fields are intentionally left untouched.
