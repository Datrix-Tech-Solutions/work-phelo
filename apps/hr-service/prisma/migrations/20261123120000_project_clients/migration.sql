-- CreateEnum
CREATE TYPE "hr"."ProjectClientSource" AS ENUM ('MARKETING', 'PROJECT');

-- AlterTable: null stays "a marketing client", so every existing project is untouched
ALTER TABLE "hr"."Project" ADD COLUMN     "clientSource" "hr"."ProjectClientSource";

-- AlterTable
ALTER TABLE "hr"."ProjectInvoice" ADD COLUMN     "state" TEXT;

-- CreateTable
CREATE TABLE "hr"."ProjectClient" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "accountingEntityId" TEXT,
    "accountingEntityTypeId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectClient_tenantId_name_idx" ON "hr"."ProjectClient"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectClient_tenantId_nameKey_key" ON "hr"."ProjectClient"("tenantId", "nameKey");

-- CreateIndex
CREATE INDEX "ProjectInvoice_tenantId_transactionId_idx" ON "hr"."ProjectInvoice"("tenantId", "transactionId");
