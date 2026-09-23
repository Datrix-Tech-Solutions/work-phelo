-- Store the free-text label a user enters when EmployeeDocument.type is
-- 'OTHER', mirroring Asset.customType. Also add mimeType/sizeBytes, needed
-- now that documents are real uploaded files instead of externally-hosted
-- URLs.

ALTER TABLE "hr"."EmployeeDocument" ADD COLUMN "customType" TEXT;
ALTER TABLE "hr"."EmployeeDocument" ADD COLUMN "mimeType" TEXT NOT NULL DEFAULT 'application/octet-stream';
ALTER TABLE "hr"."EmployeeDocument" ADD COLUMN "sizeBytes" INTEGER NOT NULL DEFAULT 0;
