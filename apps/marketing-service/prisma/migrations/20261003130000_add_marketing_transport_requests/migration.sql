CREATE TYPE "marketing"."MarketingTransportRequestStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED'
);

CREATE TABLE "marketing"."MarketingTransportRequest" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "requesterUserId" TEXT NOT NULL,
  "requesterEmployeeId" TEXT,
  "requesterName" TEXT NOT NULL,
  "requesterDepartment" TEXT,
  "businessPurpose" TEXT NOT NULL,
  "travelDate" DATE NOT NULL,
  "departureTime" TEXT NOT NULL,
  "returnTime" TEXT NOT NULL,
  "destination" TEXT NOT NULL,
  "notes" TEXT,
  "status" "marketing"."MarketingTransportRequestStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedByUserId" TEXT,
  "reviewedByName" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingTransportRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing"."MarketingTransportRequestPassenger" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "department" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MarketingTransportRequestPassenger_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingTransportRequest_tenantId_status_travelDate_idx"
  ON "marketing"."MarketingTransportRequest"("tenantId", "status", "travelDate");
CREATE INDEX "MarketingTransportRequest_requester_created_idx"
  ON "marketing"."MarketingTransportRequest"("tenantId", "requesterUserId", "createdAt");
CREATE INDEX "MarketingTransportRequest_tenantId_createdAt_idx"
  ON "marketing"."MarketingTransportRequest"("tenantId", "createdAt");

CREATE UNIQUE INDEX "MarketingTransportRequestPassenger_requestId_employeeId_key"
  ON "marketing"."MarketingTransportRequestPassenger"("requestId", "employeeId");
CREATE INDEX "MarketingTransportRequestPassenger_tenantId_employeeId_idx"
  ON "marketing"."MarketingTransportRequestPassenger"("tenantId", "employeeId");

ALTER TABLE "marketing"."MarketingTransportRequestPassenger"
  ADD CONSTRAINT "MarketingTransportRequestPassenger_requestId_fkey"
  FOREIGN KEY ("requestId") REFERENCES "marketing"."MarketingTransportRequest"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
