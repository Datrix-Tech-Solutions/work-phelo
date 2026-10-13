CREATE TYPE "marketing"."MarketingAppointmentStatus" AS ENUM (
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
  'COMPLETED'
);

CREATE TABLE "marketing"."MarketingAppointment" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId" TEXT NOT NULL,
  "prospectId" TEXT,
  "prospectName" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT,
  "marketerUserId" TEXT NOT NULL,
  "marketerName" TEXT NOT NULL,
  "managerUserId" TEXT,
  "managerName" TEXT,
  "comment" TEXT,
  "status" "marketing"."MarketingAppointmentStatus" NOT NULL DEFAULT 'PENDING',
  "createdByUserId" TEXT NOT NULL,
  "reviewedByUserId" TEXT,
  "reviewedByName" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "cancelledAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MarketingAppointment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MarketingAppointment_tenantId_status_date_idx"
  ON "marketing"."MarketingAppointment"("tenantId", "status", "date");
CREATE INDEX "MarketingAppointment_marketer_date_idx"
  ON "marketing"."MarketingAppointment"("tenantId", "marketerUserId", "date");
CREATE INDEX "MarketingAppointment_manager_date_idx"
  ON "marketing"."MarketingAppointment"("tenantId", "managerUserId", "date");
CREATE INDEX "MarketingAppointment_tenantId_prospectId_idx"
  ON "marketing"."MarketingAppointment"("tenantId", "prospectId");

ALTER TABLE "marketing"."MarketingAppointment"
  ADD CONSTRAINT "MarketingAppointment_prospectId_fkey"
  FOREIGN KEY ("prospectId") REFERENCES "marketing"."MarketingProspect"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
