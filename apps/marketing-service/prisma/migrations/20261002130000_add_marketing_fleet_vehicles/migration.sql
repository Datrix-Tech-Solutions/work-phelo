CREATE TYPE "marketing"."MarketingFleetVehicleType" AS ENUM (
  'SEDAN',
  'SUV',
  'PICKUP',
  'VAN',
  'MINIBUS',
  'BUS',
  'MOTORCYCLE',
  'TRUCK',
  'OTHER'
);

CREATE TYPE "marketing"."MarketingFleetFuelType" AS ENUM (
  'PETROL',
  'DIESEL',
  'ELECTRIC',
  'HYBRID',
  'LPG',
  'OTHER'
);

CREATE TABLE "marketing"."MarketingFleetVehicle" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "assetId" TEXT NOT NULL,
  "vehicleType" "marketing"."MarketingFleetVehicleType" NOT NULL,
  "make" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "yearOfRegistration" INTEGER NOT NULL,
  "fuelType" "marketing"."MarketingFleetFuelType" NOT NULL,
  "currentMileage" INTEGER NOT NULL,
  "createdByUserId" TEXT,
  "updatedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingFleetVehicle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingFleetVehicle_tenantId_assetId_key"
  ON "marketing"."MarketingFleetVehicle"("tenantId", "assetId");
CREATE INDEX "MarketingFleetVehicle_tenantId_vehicleType_idx"
  ON "marketing"."MarketingFleetVehicle"("tenantId", "vehicleType");
CREATE INDEX "MarketingFleetVehicle_tenantId_fuelType_idx"
  ON "marketing"."MarketingFleetVehicle"("tenantId", "fuelType");
