-- HR Recruitment application questions and applicant answers.

-- AlterTable
ALTER TABLE "hr"."RecruitmentStageHistory" ALTER COLUMN "changedByUserId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "hr"."RecruitmentVacancyQuestion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vacancyId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentVacancyQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."RecruitmentApplicationAnswer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "questionSnapshot" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitmentApplicationAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecruitmentVacancyQuestion_tenantId_vacancyId_retiredAt_idx" ON "hr"."RecruitmentVacancyQuestion"("tenantId", "vacancyId", "retiredAt");

-- CreateIndex
CREATE INDEX "RecruitmentVacancyQuestion_tenantId_sortOrder_idx" ON "hr"."RecruitmentVacancyQuestion"("tenantId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentApplicationAnswer_applicationId_questionId_key" ON "hr"."RecruitmentApplicationAnswer"("applicationId", "questionId");

-- CreateIndex
CREATE INDEX "RecruitmentApplicationAnswer_tenantId_applicationId_idx" ON "hr"."RecruitmentApplicationAnswer"("tenantId", "applicationId");

-- CreateIndex
CREATE INDEX "RecruitmentApplicationAnswer_tenantId_questionId_idx" ON "hr"."RecruitmentApplicationAnswer"("tenantId", "questionId");

-- AddForeignKey
ALTER TABLE "hr"."RecruitmentVacancyQuestion" ADD CONSTRAINT "RecruitmentVacancyQuestion_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "hr"."RecruitmentVacancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."RecruitmentApplicationAnswer" ADD CONSTRAINT "RecruitmentApplicationAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "hr"."RecruitmentApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."RecruitmentApplicationAnswer" ADD CONSTRAINT "RecruitmentApplicationAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "hr"."RecruitmentVacancyQuestion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
