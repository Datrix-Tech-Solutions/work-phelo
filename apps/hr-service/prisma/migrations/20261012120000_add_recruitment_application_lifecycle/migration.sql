-- HR Recruitment application lifecycle and typed vacancy questions.

-- CreateEnum
CREATE TYPE "hr"."RecruitmentQuestionType" AS ENUM ('TEXT', 'SINGLE_SELECT', 'MULTI_SELECT');

-- CreateEnum
CREATE TYPE "hr"."RecruitmentApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- AlterTable
ALTER TABLE "hr"."RecruitmentVacancyQuestion"
ADD COLUMN "type" "hr"."RecruitmentQuestionType" NOT NULL DEFAULT 'TEXT',
ADD COLUMN "options" JSONB;

-- AlterTable
ALTER TABLE "hr"."RecruitmentApplication"
ADD COLUMN "status" "hr"."RecruitmentApplicationStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "accessTokenHash" TEXT,
ADD COLUMN "submittedAt" TIMESTAMP(3),
ADD COLUMN "country" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "yearsOfExperience" INTEGER,
ADD COLUMN "currentJobTitle" TEXT,
ADD COLUMN "currentEmployer" TEXT,
ADD COLUMN "highestEducationLevel" TEXT,
ALTER COLUMN "currentStageId" DROP NOT NULL,
ALTER COLUMN "firstName" DROP NOT NULL,
ALTER COLUMN "lastName" DROP NOT NULL,
ALTER COLUMN "email" DROP NOT NULL;

-- Existing applications were created as submitted candidates before draft support.
UPDATE "hr"."RecruitmentApplication"
SET "status" = 'SUBMITTED',
    "submittedAt" = COALESCE("submittedAt", "appliedAt")
WHERE "currentStageId" IS NOT NULL;

-- AlterTable
ALTER TABLE "hr"."RecruitmentApplicationAnswer"
ADD COLUMN "answerText" TEXT,
ADD COLUMN "selectedOptions" TEXT[] DEFAULT ARRAY[]::TEXT[];

UPDATE "hr"."RecruitmentApplicationAnswer"
SET "answerText" = "answer"
WHERE "answerText" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentApplication_accessTokenHash_key" ON "hr"."RecruitmentApplication"("accessTokenHash");

-- CreateIndex
CREATE INDEX "RecruitmentApplication_tenantId_status_idx" ON "hr"."RecruitmentApplication"("tenantId", "status");

-- CreateIndex
CREATE INDEX "RecruitmentApplication_tenantId_vacancyId_status_idx" ON "hr"."RecruitmentApplication"("tenantId", "vacancyId", "status");

-- CreateIndex
CREATE INDEX "RecruitmentApplication_tenantId_submittedAt_idx" ON "hr"."RecruitmentApplication"("tenantId", "submittedAt");
