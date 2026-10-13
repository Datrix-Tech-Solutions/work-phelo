CREATE TYPE "marketing"."MarketingTransportPurpose" AS ENUM ('PERSONAL', 'OFFICIAL');
CREATE TYPE "marketing"."MarketingTransportStopKind" AS ENUM ('CLIENT', 'PROSPECT');
CREATE TYPE "marketing"."MarketingTransportStopSource" AS ENUM ('PLANNED', 'VISITED');

-- Purpose is now personal or official. Existing requests were all work trips, and keep their
-- old free-text purpose in businessPurpose, which new requests no longer fill in.
ALTER TABLE "marketing"."MarketingTransportRequest"
  ADD COLUMN "purpose" "marketing"."MarketingTransportPurpose" NOT NULL DEFAULT 'OFFICIAL',
  ALTER COLUMN "businessPurpose" DROP NOT NULL,
  ALTER COLUMN "returnTime" DROP NOT NULL;

CREATE TABLE "marketing"."MarketingTransportRequestStop" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "kind" "marketing"."MarketingTransportStopKind" NOT NULL,
  "refId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "locationLabel" TEXT NOT NULL,
  "latitude" DECIMAL(9, 6) NOT NULL,
  "longitude" DECIMAL(9, 6) NOT NULL,
  "source" "marketing"."MarketingTransportStopSource" NOT NULL DEFAULT 'PLANNED',
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MarketingTransportRequestStop_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingTransportRequestStop_requestId_kind_refId_key"
  ON "marketing"."MarketingTransportRequestStop"("requestId", "kind", "refId");
CREATE INDEX "MarketingTransportRequestStop_tenantId_refId_idx"
  ON "marketing"."MarketingTransportRequestStop"("tenantId", "refId");

ALTER TABLE "marketing"."MarketingTransportRequestStop"
  ADD CONSTRAINT "MarketingTransportRequestStop_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "marketing"."MarketingTransportRequest"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
