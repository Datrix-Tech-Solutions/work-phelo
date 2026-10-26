-- AlterTable
ALTER TABLE "hr"."RecruitmentVacancy" ADD COLUMN "cutoffScore" INTEGER;

-- AlterTable
ALTER TABLE "hr"."RecruitmentApplication" ADD COLUMN "autoRejectedAt" TIMESTAMP(3),
ADD COLUMN "autoRejectedScore" INTEGER;
