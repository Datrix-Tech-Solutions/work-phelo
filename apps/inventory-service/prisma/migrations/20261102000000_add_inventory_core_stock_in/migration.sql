-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "inventory";

-- CreateEnum
CREATE TYPE "inventory"."StockLocationType" AS ENUM ('WAREHOUSE', 'STORE', 'BRANCH', 'OFFICE_STORE', 'OTHER');

-- CreateEnum
CREATE TYPE "inventory"."InventoryItemStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "inventory"."StockMovementType" AS ENUM ('STOCK_IN');

-- CreateTable
CREATE TABLE "inventory"."InventoryCategory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory"."UnitOfMeasure" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitOfMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory"."StockLocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "inventory"."StockLocationType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory"."InventoryItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "unitOfMeasureId" TEXT NOT NULL,
    "description" TEXT,
    "costPrice" DECIMAL(18,4),
    "sellingPrice" DECIMAL(18,4),
    "reorderLevel" DECIMAL(18,4),
    "status" "inventory"."InventoryItemStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory"."StockBalance" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory"."StockMovement" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "unitOfMeasureId" TEXT NOT NULL,
    "type" "inventory"."StockMovementType" NOT NULL DEFAULT 'STOCK_IN',
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4),
    "totalCost" DECIMAL(36,8),
    "date" TIMESTAMP(3) NOT NULL,
    "source" TEXT,
    "supplier" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCategory_tenantId_name_key" ON "inventory"."InventoryCategory"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCategory_tenantId_id_key" ON "inventory"."InventoryCategory"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasure_tenantId_name_key" ON "inventory"."UnitOfMeasure"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasure_tenantId_id_key" ON "inventory"."UnitOfMeasure"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "StockLocation_tenantId_name_key" ON "inventory"."StockLocation"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "StockLocation_tenantId_id_key" ON "inventory"."StockLocation"("tenantId", "id");

-- CreateIndex
CREATE INDEX "InventoryItem_tenantId_categoryId_idx" ON "inventory"."InventoryItem"("tenantId", "categoryId");

-- CreateIndex
CREATE INDEX "InventoryItem_tenantId_unitOfMeasureId_idx" ON "inventory"."InventoryItem"("tenantId", "unitOfMeasureId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_tenantId_sku_key" ON "inventory"."InventoryItem"("tenantId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_tenantId_id_key" ON "inventory"."InventoryItem"("tenantId", "id");

-- CreateIndex
CREATE INDEX "StockBalance_tenantId_locationId_idx" ON "inventory"."StockBalance"("tenantId", "locationId");

-- CreateIndex
CREATE UNIQUE INDEX "StockBalance_tenantId_itemId_locationId_key" ON "inventory"."StockBalance"("tenantId", "itemId", "locationId");

-- CreateIndex
CREATE INDEX "StockMovement_tenantId_createdAt_id_idx" ON "inventory"."StockMovement"("tenantId", "createdAt", "id");

-- CreateIndex
CREATE INDEX "StockMovement_tenantId_itemId_idx" ON "inventory"."StockMovement"("tenantId", "itemId");

-- CreateIndex
CREATE INDEX "StockMovement_tenantId_locationId_idx" ON "inventory"."StockMovement"("tenantId", "locationId");

-- CreateIndex
CREATE INDEX "StockMovement_tenantId_unitOfMeasureId_idx" ON "inventory"."StockMovement"("tenantId", "unitOfMeasureId");

-- AddForeignKey
ALTER TABLE "inventory"."InventoryItem" ADD CONSTRAINT "InventoryItem_tenantId_categoryId_fkey" FOREIGN KEY ("tenantId", "categoryId") REFERENCES "inventory"."InventoryCategory"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."InventoryItem" ADD CONSTRAINT "InventoryItem_tenantId_unitOfMeasureId_fkey" FOREIGN KEY ("tenantId", "unitOfMeasureId") REFERENCES "inventory"."UnitOfMeasure"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."StockBalance" ADD CONSTRAINT "StockBalance_tenantId_itemId_fkey" FOREIGN KEY ("tenantId", "itemId") REFERENCES "inventory"."InventoryItem"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."StockBalance" ADD CONSTRAINT "StockBalance_tenantId_locationId_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "inventory"."StockLocation"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."StockMovement" ADD CONSTRAINT "StockMovement_tenantId_itemId_fkey" FOREIGN KEY ("tenantId", "itemId") REFERENCES "inventory"."InventoryItem"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."StockMovement" ADD CONSTRAINT "StockMovement_tenantId_locationId_fkey" FOREIGN KEY ("tenantId", "locationId") REFERENCES "inventory"."StockLocation"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory"."StockMovement" ADD CONSTRAINT "StockMovement_tenantId_unitOfMeasureId_fkey" FOREIGN KEY ("tenantId", "unitOfMeasureId") REFERENCES "inventory"."UnitOfMeasure"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep numeric invariants valid even for writes outside the HTTP API.
ALTER TABLE "inventory"."InventoryItem" ADD CONSTRAINT "InventoryItem_nonnegative_values" CHECK
  (("costPrice" IS NULL OR "costPrice" >= 0) AND
   ("sellingPrice" IS NULL OR "sellingPrice" >= 0) AND
   ("reorderLevel" IS NULL OR "reorderLevel" >= 0));
ALTER TABLE "inventory"."StockBalance" ADD CONSTRAINT "StockBalance_nonnegative_quantity" CHECK ("quantity" >= 0);
ALTER TABLE "inventory"."StockMovement" ADD CONSTRAINT "StockMovement_receipt_values" CHECK
  ("quantity" > 0 AND
   (("unitCost" IS NULL AND "totalCost" IS NULL) OR
    ("unitCost" IS NOT NULL AND "unitCost" >= 0 AND "totalCost" IS NOT NULL AND "totalCost" = "quantity" * "unitCost")));
