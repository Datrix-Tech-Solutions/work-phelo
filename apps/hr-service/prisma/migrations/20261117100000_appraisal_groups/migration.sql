-- CreateTable
CREATE TABLE "hr"."AppraisalGroup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "employeeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppraisalGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."AppraisalGroupGoal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL,

    CONSTRAINT "AppraisalGroupGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."AppraisalCycleGroup" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "groupName" TEXT,
    "employeeIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "goalWeights" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppraisalCycleGroup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppraisalGroup_tenantId_name_key" ON "hr"."AppraisalGroup"("tenantId", "name");

-- CreateIndex
CREATE INDEX "AppraisalGroupGoal_tenantId_goalId_idx" ON "hr"."AppraisalGroupGoal"("tenantId", "goalId");

-- CreateIndex
CREATE UNIQUE INDEX "AppraisalGroupGoal_groupId_goalId_key" ON "hr"."AppraisalGroupGoal"("groupId", "goalId");

-- CreateIndex
CREATE INDEX "AppraisalCycleGroup_tenantId_groupId_idx" ON "hr"."AppraisalCycleGroup"("tenantId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "AppraisalCycleGroup_cycleId_groupId_key" ON "hr"."AppraisalCycleGroup"("cycleId", "groupId");

-- AddForeignKey
ALTER TABLE "hr"."AppraisalGroupGoal" ADD CONSTRAINT "AppraisalGroupGoal_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "hr"."AppraisalGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."AppraisalGroupGoal" ADD CONSTRAINT "AppraisalGroupGoal_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "hr"."AppraisalGoal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."AppraisalCycleGroup" ADD CONSTRAINT "AppraisalCycleGroup_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "hr"."AppraisalCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."AppraisalCycleGroup" ADD CONSTRAINT "AppraisalCycleGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "hr"."AppraisalGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
