-- AlterTable
ALTER TABLE "hr"."RecruitmentVacancy" ADD COLUMN "companyName" TEXT;

-- CreateIndex
CREATE INDEX "RecruitmentVacancy_status_createdAt_idx" ON "hr"."RecruitmentVacancy"("status", "createdAt");
