-- Soft close: a staging state between OPEN and CLOSED for the month-end review. For now it
-- blocks posting exactly like CLOSED (only OPEN periods accept postings); it exists so a
-- later RBAC change can let privileged users keep posting while a period is soft-closed.

-- AlterEnum
ALTER TYPE "accounting"."FiscalPeriodStatus" ADD VALUE 'SOFT_CLOSED' BEFORE 'CLOSED';

-- AlterTable
ALTER TABLE "accounting"."FiscalPeriod" ADD COLUMN "softClosedAt" TIMESTAMP(3),
ADD COLUMN "softClosedByUserId" TEXT;
