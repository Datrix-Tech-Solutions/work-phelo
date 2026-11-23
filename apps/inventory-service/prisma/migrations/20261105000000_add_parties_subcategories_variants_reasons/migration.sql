-- CreateEnum
CREATE TYPE "inventory"."PartyKind" AS ENUM ('CUSTOMER', 'SUPPLIER');

-- AlterTable
ALTER TABLE "inventory"."InventoryItem" ADD COLUMN     "subcategoryId" TEXT;

-- Adjustment reasons become company-managed rows instead of a fixed enum. Existing movements keep
-- their reason: the enum value is converted to its text, which is the reason code.
-- AlterTable
ALTER TABLE "inventory"."StockMovement" ADD COLUMN "variantId" TEXT;
ALTER TABLE "inventory"."StockMovement"
  ALTER COLUMN "adjustmentReason" TYPE TEXT USING "adjustmentReason"::text;

-- DropEnum
DROP TYPE "inventory"."StockAdjustmentReason";

-- CreateTable
CREATE TABLE "inventory"."InventoryParty" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "kind" "inventory"."PartyKind" NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "status" "inventory"."InventoryConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory"."InventorySubcategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "inventory"."InventoryConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventorySubcategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory"."ItemVariant" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "inventory"."InventoryConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory"."VariantBalance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariantBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory"."AdjustmentReason" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "status" "inventory"."InventoryConfigurationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdjustmentReason_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryParty_tenantId_kind_name_key" ON "inventory"."InventoryParty"("tenantId", "kind", "name");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryParty_tenantId_id_key" ON "inventory"."InventoryParty"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySubcategory_tenantId_categoryId_name_key" ON "inventory"."InventorySubcategory"("tenantId", "categoryId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySubcategory_tenantId_id_key" ON "inventory"."InventorySubcategory"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ItemVariant_tenantId_itemId_name_key" ON "inventory"."ItemVariant"("tenantId", "itemId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ItemVariant_tenantId_id_key" ON "inventory"."ItemVariant"("tenantId", "id");

-- CreateIndex
CREATE INDEX "VariantBalance_tenantId_locationId_idx" ON "inventory"."VariantBalance"("tenantId", "locationId");

-- CreateIndex
CREATE INDEX "VariantBalance_tenantId_variantId_idx" ON "inventory"."VariantBalance"("tenantId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "VariantBalance_tenantId_itemId_locationId_variantId_key" ON "inventory"."VariantBalance"("tenantId", "itemId", "locationId", "variantId");

-- CreateIndex
CREATE UNIQUE INDEX "AdjustmentReason_tenantId_code_key" ON "inventory"."AdjustmentReason"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "AdjustmentReason_tenantId_name_key" ON "inventory"."AdjustmentReason"("tenantId", "name");

-- CreateIndex
CREATE INDEX "InventoryItem_tenantId_subcategoryId_idx" ON "inventory"."InventoryItem"("tenantId", "subcategoryId");

-- CreateIndex
CREATE INDEX "StockMovement_tenantId_variantId_idx" ON "inventory"."StockMovement"("tenantId", "variantId");

-- AddForeignKey
ALTER TABLE "inventory"."InventoryItem" ADD CONSTRAINT "InventoryItem_tenantId_subcategoryId_fkey" FOREIGN KEY ("tenantId", "subcategoryId") REFERENCES "inventory"."InventorySubcategory"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."StockMovement" ADD CONSTRAINT "StockMovement_tenantId_variantId_fkey" FOREIGN KEY ("tenantId", "variantId") REFERENCES "inventory"."ItemVariant"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."InventorySubcategory" ADD CONSTRAINT "InventorySubcategory_tenantId_categoryId_fkey" FOREIGN KEY ("tenantId", "categoryId") REFERENCES "inventory"."InventoryCategory"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."ItemVariant" ADD CONSTRAINT "ItemVariant_tenantId_itemId_fkey" FOREIGN KEY ("tenantId", "itemId") REFERENCES "inventory"."InventoryItem"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."VariantBalance" ADD CONSTRAINT "VariantBalance_tenantId_itemId_fkey" FOREIGN KEY ("tenantId", "itemId") REFERENCES "inventory"."InventoryItem"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."VariantBalance" ADD CONSTRAINT "VariantBalance_tenantId_locationId_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "inventory"."StockLocation"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."VariantBalance" ADD CONSTRAINT "VariantBalance_tenantId_variantId_fkey" FOREIGN KEY ("tenantId", "variantId") REFERENCES "inventory"."ItemVariant"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

