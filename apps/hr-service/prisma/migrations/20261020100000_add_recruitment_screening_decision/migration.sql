-- CreateEnum
CREATE TYPE "hr"."RecruitmentScreeningDecision" AS ENUM ('ACCEPTED', 'DECLINED');

-- AlterTable
ALTER TABLE "hr"."RecruitmentApplicationAnswer" ADD COLUMN "screeningDecision" "hr"."RecruitmentScreeningDecision",
ADD COLUMN "screeningDecidedAt" TIMESTAMP(3),
ADD COLUMN "screeningDecidedByUserId" TEXT;
