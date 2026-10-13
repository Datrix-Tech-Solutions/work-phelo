-- AlterEnum
ALTER TYPE "hr"."DocumentType" ADD VALUE IF NOT EXISTS 'DRIVER_LICENCE';

-- CreateTable
CREATE TABLE "hr"."EmployeeDriverLicence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "licenceNumber" TEXT NOT NULL,
    "issuedAt" DATE NOT NULL,
    "expiresAt" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeDriverLicence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeDriverLicence_employeeId_key" ON "hr"."EmployeeDriverLicence"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeDriverLicence_tenantId_idx" ON "hr"."EmployeeDriverLicence"("tenantId");

-- AddForeignKey
ALTER TABLE "hr"."EmployeeDriverLicence" ADD CONSTRAINT "EmployeeDriverLicence_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
