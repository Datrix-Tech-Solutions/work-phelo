-- Source Types: which other modules (HR, Marketing, ...) have completed their own
-- integration setup with Accounting. A row is only ever created by the owning module's
-- setup completing (e.g. HR's payroll GL account seed) — never from this side, which can
-- only link/unlink it.

-- CreateEnum
CREATE TYPE "accounting"."SourceModule" AS ENUM ('HR', 'MARKETING', 'ACCOUNTING', 'RECRUITMENT', 'OPERATIONS');

-- CreateTable
CREATE TABLE "accounting"."SourceType" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "module" "accounting"."SourceModule" NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SourceType_id_tenantId_key" ON "accounting"."SourceType"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "SourceType_tenantId_module_name_key" ON "accounting"."SourceType"("tenantId", "module", "name");
