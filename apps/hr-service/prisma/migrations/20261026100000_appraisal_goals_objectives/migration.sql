-- AlterEnum
ALTER TYPE "hr"."AppraisalCycleStatus" ADD VALUE 'CLOSED';

-- AlterTable
ALTER TABLE "hr"."AppraisalCycle" ADD COLUMN     "closedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "hr"."Appraisal" ADD COLUMN     "objectiveIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "hr"."AppraisalGoal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "selfAssessmentWeight" INTEGER NOT NULL DEFAULT 40,
    "managerAssessmentWeight" INTEGER NOT NULL DEFAULT 60,
    "employeeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppraisalGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."AppraisalCycleGoal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "goalName" TEXT,
    "selfAssessmentWeight" INTEGER,
    "managerAssessmentWeight" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppraisalCycleGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."AppraisalObjective" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "goalId" TEXT,
    "name" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppraisalObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."AppraisalObjectiveComment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppraisalObjectiveComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."AppraisalObjectiveScore" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "appraisalId" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "reviewType" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppraisalObjectiveScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppraisalGoal_tenantId_name_key" ON "hr"."AppraisalGoal"("tenantId", "name");

-- CreateIndex
CREATE INDEX "AppraisalCycleGoal_tenantId_goalId_idx" ON "hr"."AppraisalCycleGoal"("tenantId", "goalId");

-- CreateIndex
CREATE UNIQUE INDEX "AppraisalCycleGoal_cycleId_goalId_key" ON "hr"."AppraisalCycleGoal"("cycleId", "goalId");

-- CreateIndex
CREATE INDEX "AppraisalObjective_tenantId_employeeId_idx" ON "hr"."AppraisalObjective"("tenantId", "employeeId");

-- CreateIndex
CREATE INDEX "AppraisalObjective_tenantId_goalId_linkedAt_idx" ON "hr"."AppraisalObjective"("tenantId", "goalId", "linkedAt");

-- CreateIndex
CREATE INDEX "AppraisalObjectiveComment_objectiveId_idx" ON "hr"."AppraisalObjectiveComment"("objectiveId");

-- CreateIndex
CREATE UNIQUE INDEX "AppraisalObjectiveScore_appraisalId_objectiveId_reviewType_key" ON "hr"."AppraisalObjectiveScore"("appraisalId", "objectiveId", "reviewType");

-- AddForeignKey
ALTER TABLE "hr"."AppraisalCycleGoal" ADD CONSTRAINT "AppraisalCycleGoal_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "hr"."AppraisalCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."AppraisalCycleGoal" ADD CONSTRAINT "AppraisalCycleGoal_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "hr"."AppraisalGoal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."AppraisalObjective" ADD CONSTRAINT "AppraisalObjective_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."AppraisalObjective" ADD CONSTRAINT "AppraisalObjective_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "hr"."AppraisalGoal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."AppraisalObjectiveComment" ADD CONSTRAINT "AppraisalObjectiveComment_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "hr"."AppraisalObjective"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."AppraisalObjectiveScore" ADD CONSTRAINT "AppraisalObjectiveScore_appraisalId_fkey" FOREIGN KEY ("appraisalId") REFERENCES "hr"."Appraisal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."AppraisalObjectiveScore" ADD CONSTRAINT "AppraisalObjectiveScore_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "hr"."AppraisalObjective"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

