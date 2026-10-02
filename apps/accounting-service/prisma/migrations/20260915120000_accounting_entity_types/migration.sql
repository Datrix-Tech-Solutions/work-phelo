-- CreateEnum
CREATE TYPE "accounting"."EntityAccountingRelation" AS ENUM ('RECEIVABLE', 'PAYABLE', 'BOTH', 'NONE');

-- CreateTable
CREATE TABLE "accounting"."EntityType" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "accountingRelation" "accounting"."EntityAccountingRelation" NOT NULL DEFAULT 'NONE',
  "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "createdByUserId" TEXT NOT NULL,
  "updatedByUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EntityType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EntityType_id_tenantId_key" ON "accounting"."EntityType"("id", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "EntityType_tenantId_name_key" ON "accounting"."EntityType"("tenantId", "name");
