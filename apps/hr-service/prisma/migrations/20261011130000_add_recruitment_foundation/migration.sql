-- HR Recruitment foundation: vacancies, tenant recruitment stages, applications and stage history.

-- CreateEnum
CREATE TYPE "hr"."RecruitmentVacancyStatus" AS ENUM ('DRAFT', 'OPEN', 'CLOSED');

-- CreateTable
CREATE TABLE "hr"."RecruitmentVacancy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT,
    "location" TEXT,
    "jobType" "hr"."EmploymentType",
    "description" TEXT,
    "responsibilities" TEXT,
    "requirements" TEXT,
    "salaryMin" DECIMAL(15,2),
    "salaryMax" DECIMAL(15,2),
    "salaryCurrency" TEXT,
    "status" "hr"."RecruitmentVacancyStatus" NOT NULL DEFAULT 'DRAFT',
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentVacancy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."RecruitmentStage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."RecruitmentApplication" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vacancyId" TEXT NOT NULL,
    "currentStageId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "professionalSummary" TEXT,
    "skills" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "education" TEXT,
    "expectedSalary" DECIMAL(15,2),
    "expectedSalaryCurrency" TEXT,
    "noticePeriod" TEXT,
    "resumeUrl" TEXT,
    "resumeFileName" TEXT,
    "coverLetterUrl" TEXT,
    "coverLetterFileName" TEXT,
    "portfolioUrl" TEXT,
    "githubUrl" TEXT,
    "metadata" JSONB,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."RecruitmentStageHistory" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "previousStageId" TEXT,
    "newStageId" TEXT NOT NULL,
    "changedByUserId" TEXT NOT NULL,
    "changedByEmployeeId" TEXT,
    "note" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecruitmentStageHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecruitmentVacancy_tenantId_status_idx" ON "hr"."RecruitmentVacancy"("tenantId", "status");

-- CreateIndex
CREATE INDEX "RecruitmentVacancy_tenantId_createdAt_idx" ON "hr"."RecruitmentVacancy"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentStage_tenantId_normalizedName_key" ON "hr"."RecruitmentStage"("tenantId", "normalizedName");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentStage_tenantId_sortOrder_key" ON "hr"."RecruitmentStage"("tenantId", "sortOrder");

-- CreateIndex
CREATE INDEX "RecruitmentStage_tenantId_isDefault_idx" ON "hr"."RecruitmentStage"("tenantId", "isDefault");

-- CreateIndex
CREATE UNIQUE INDEX "RecruitmentStage_tenantId_default_key" ON "hr"."RecruitmentStage"("tenantId") WHERE "isDefault" = true;

-- CreateIndex
CREATE INDEX "RecruitmentApplication_tenantId_vacancyId_idx" ON "hr"."RecruitmentApplication"("tenantId", "vacancyId");

-- CreateIndex
CREATE INDEX "RecruitmentApplication_tenantId_currentStageId_idx" ON "hr"."RecruitmentApplication"("tenantId", "currentStageId");

-- CreateIndex
CREATE INDEX "RecruitmentApplication_tenantId_appliedAt_idx" ON "hr"."RecruitmentApplication"("tenantId", "appliedAt");

-- CreateIndex
CREATE INDEX "RecruitmentApplication_tenantId_email_idx" ON "hr"."RecruitmentApplication"("tenantId", "email");

-- CreateIndex
CREATE INDEX "RecruitmentStageHistory_tenantId_applicationId_changedAt_idx" ON "hr"."RecruitmentStageHistory"("tenantId", "applicationId", "changedAt");

-- CreateIndex
CREATE INDEX "RecruitmentStageHistory_tenantId_newStageId_idx" ON "hr"."RecruitmentStageHistory"("tenantId", "newStageId");

-- AddForeignKey
ALTER TABLE "hr"."RecruitmentApplication" ADD CONSTRAINT "RecruitmentApplication_vacancyId_fkey" FOREIGN KEY ("vacancyId") REFERENCES "hr"."RecruitmentVacancy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."RecruitmentApplication" ADD CONSTRAINT "RecruitmentApplication_currentStageId_fkey" FOREIGN KEY ("currentStageId") REFERENCES "hr"."RecruitmentStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."RecruitmentStageHistory" ADD CONSTRAINT "RecruitmentStageHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "hr"."RecruitmentApplication"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."RecruitmentStageHistory" ADD CONSTRAINT "RecruitmentStageHistory_previousStageId_fkey" FOREIGN KEY ("previousStageId") REFERENCES "hr"."RecruitmentStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."RecruitmentStageHistory" ADD CONSTRAINT "RecruitmentStageHistory_newStageId_fkey" FOREIGN KEY ("newStageId") REFERENCES "hr"."RecruitmentStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."RecruitmentStageHistory" ADD CONSTRAINT "RecruitmentStageHistory_changedByEmployeeId_fkey" FOREIGN KEY ("changedByEmployeeId") REFERENCES "hr"."Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
