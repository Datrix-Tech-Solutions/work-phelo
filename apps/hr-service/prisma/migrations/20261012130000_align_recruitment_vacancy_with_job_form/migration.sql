-- Align the recruitment vacancy with the job opening form: department/branch, work mode, vacancies,
-- city, closing date, perks, structured requirements and a salary type. Also gives screening questions
-- an extensible answer-type enum.

-- Question types: rename the original three values (keeps existing rows) and add the new ones.
ALTER TYPE "hr"."RecruitmentQuestionType" RENAME VALUE 'TEXT' TO 'SHORT_ANSWER';
ALTER TYPE "hr"."RecruitmentQuestionType" RENAME VALUE 'SINGLE_SELECT' TO 'MULTIPLE_CHOICE';
ALTER TYPE "hr"."RecruitmentQuestionType" RENAME VALUE 'MULTI_SELECT' TO 'CHECKBOXES';
ALTER TYPE "hr"."RecruitmentQuestionType" ADD VALUE 'PARAGRAPH' AFTER 'SHORT_ANSWER';
ALTER TYPE "hr"."RecruitmentQuestionType" ADD VALUE 'YES_NO' AFTER 'PARAGRAPH';
ALTER TYPE "hr"."RecruitmentQuestionType" ADD VALUE 'DROPDOWN' AFTER 'CHECKBOXES';

-- CreateEnum
CREATE TYPE "hr"."RecruitmentSalaryType" AS ENUM ('FIXED', 'RANGE', 'NEGOTIABLE', 'NON_DISCLOSED');

-- AlterTable
ALTER TABLE "hr"."RecruitmentVacancy"
ADD COLUMN "departmentId" TEXT,
ADD COLUMN "branchId" TEXT,
ADD COLUMN "city" TEXT,
ADD COLUMN "workMode" "hr"."WorkMode",
ADD COLUMN "vacancies" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "closingDate" DATE,
ADD COLUMN "perksAndBenefits" TEXT,
ADD COLUMN "details" JSONB,
ADD COLUMN "salaryType" "hr"."RecruitmentSalaryType" NOT NULL DEFAULT 'NON_DISCLOSED',
ADD COLUMN "salaryAmount" DECIMAL(15,2);

-- Existing vacancies: a salary range (or a single figure when min = max) was the only thing stored.
UPDATE "hr"."RecruitmentVacancy"
SET "salaryType" = 'FIXED', "salaryAmount" = "salaryMin", "salaryMin" = NULL, "salaryMax" = NULL
WHERE "salaryMin" IS NOT NULL AND "salaryMin" = "salaryMax";

UPDATE "hr"."RecruitmentVacancy"
SET "salaryType" = 'RANGE'
WHERE "salaryType" = 'NON_DISCLOSED' AND ("salaryMin" IS NOT NULL OR "salaryMax" IS NOT NULL);

-- CreateIndex
CREATE INDEX "RecruitmentVacancy_tenantId_departmentId_idx" ON "hr"."RecruitmentVacancy"("tenantId", "departmentId");

-- CreateIndex
CREATE INDEX "RecruitmentVacancy_tenantId_branchId_idx" ON "hr"."RecruitmentVacancy"("tenantId", "branchId");

-- CreateIndex
CREATE INDEX "RecruitmentVacancy_tenantId_closingDate_idx" ON "hr"."RecruitmentVacancy"("tenantId", "closingDate");

-- AddForeignKey
ALTER TABLE "hr"."RecruitmentVacancy" ADD CONSTRAINT "RecruitmentVacancy_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "hr"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."RecruitmentVacancy" ADD CONSTRAINT "RecruitmentVacancy_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "hr"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
