-- CreateEnum
CREATE TYPE "hr"."RecruitmentInterviewMode" AS ENUM ('VIDEO', 'PHONE', 'IN_PERSON');

-- CreateEnum
CREATE TYPE "hr"."RecruitmentInterviewStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "hr"."RecruitmentInterview" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "mode" "hr"."RecruitmentInterviewMode" NOT NULL,
    "status" "hr"."RecruitmentInterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "platform" TEXT,
    "meetingLink" TEXT,
    "phone" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "feedback" TEXT,
    "createdByUserId" TEXT,
    "createdByEmployeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentInterview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecruitmentInterview_tenantId_applicationId_scheduledAt_idx" ON "hr"."RecruitmentInterview"("tenantId", "applicationId", "scheduledAt");

-- CreateIndex
CREATE INDEX "RecruitmentInterview_tenantId_status_scheduledAt_idx" ON "hr"."RecruitmentInterview"("tenantId", "status", "scheduledAt");

-- AddForeignKey
ALTER TABLE "hr"."RecruitmentInterview" ADD CONSTRAINT "RecruitmentInterview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "hr"."RecruitmentApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."RecruitmentInterview" ADD CONSTRAINT "RecruitmentInterview_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "hr"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
