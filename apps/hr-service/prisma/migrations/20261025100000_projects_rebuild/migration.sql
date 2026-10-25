-- CreateEnum
CREATE TYPE "hr"."ProjectKind" AS ENUM ('CLIENT', 'INTERNAL', 'RESEARCH', 'IMPLEMENTATION', 'OPERATIONS', 'OTHER');

-- CreateEnum
CREATE TYPE "hr"."ProjectBillingType" AS ENUM ('FLAT_RATE', 'TIMED', 'MILESTONE', 'RETAINER');

-- CreateEnum
CREATE TYPE "hr"."ProjectTimeSource" AS ENUM ('TIMER', 'MANUAL');

-- AlterTable
ALTER TABLE "hr"."Project" ADD COLUMN     "billable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "billingType" "hr"."ProjectBillingType",
ADD COLUMN     "clientId" TEXT,
ADD COLUMN     "clientName" TEXT,
ADD COLUMN     "config" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "estimatedHours" INTEGER,
ADD COLUMN     "flatPrice" DECIMAL(15,2),
ADD COLUMN     "hourlyRate" DECIMAL(15,2),
ADD COLUMN     "kind" "hr"."ProjectKind",
ADD COLUMN     "retainerAmount" DECIMAL(15,2),
ADD COLUMN     "templateName" TEXT;

-- AlterTable
ALTER TABLE "hr"."ProjectTask" ADD COLUMN     "isTimed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "objectiveId" TEXT,
ADD COLUMN     "priorityName" TEXT,
ADD COLUMN     "sprintId" TEXT,
ADD COLUMN     "stage" TEXT,
ADD COLUMN     "workType" TEXT;

-- CreateTable
CREATE TABLE "hr"."ProjectTaskAssignee" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTaskAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."ProjectObjective" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."ProjectSubtask" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSubtask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."ProjectSprint" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "completedAt" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectSprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."ProjectMilestone" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(15,2) NOT NULL,
    "dueDate" DATE,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."ProjectTimeEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "source" "hr"."ProjectTimeSource" NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "seconds" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTimeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr"."ProjectTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL,
    "defaultKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectTaskAssignee_tenantId_employeeId_idx" ON "hr"."ProjectTaskAssignee"("tenantId", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTaskAssignee_taskId_employeeId_key" ON "hr"."ProjectTaskAssignee"("taskId", "employeeId");

-- CreateIndex
CREATE INDEX "ProjectObjective_tenantId_projectId_idx" ON "hr"."ProjectObjective"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "ProjectSubtask_tenantId_projectId_idx" ON "hr"."ProjectSubtask"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "ProjectSubtask_taskId_idx" ON "hr"."ProjectSubtask"("taskId");

-- CreateIndex
CREATE INDEX "ProjectSprint_tenantId_projectId_idx" ON "hr"."ProjectSprint"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "ProjectMilestone_tenantId_projectId_idx" ON "hr"."ProjectMilestone"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "ProjectTimeEntry_tenantId_projectId_idx" ON "hr"."ProjectTimeEntry"("tenantId", "projectId");

-- CreateIndex
CREATE INDEX "ProjectTimeEntry_taskId_employeeId_idx" ON "hr"."ProjectTimeEntry"("taskId", "employeeId");

-- CreateIndex
CREATE INDEX "ProjectTemplate_tenantId_idx" ON "hr"."ProjectTemplate"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTemplate_tenantId_defaultKey_key" ON "hr"."ProjectTemplate"("tenantId", "defaultKey");

-- CreateIndex
CREATE INDEX "Project_tenantId_clientId_idx" ON "hr"."Project"("tenantId", "clientId");

-- AddForeignKey
ALTER TABLE "hr"."ProjectTask" ADD CONSTRAINT "ProjectTask_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "hr"."ProjectObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."ProjectTask" ADD CONSTRAINT "ProjectTask_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "hr"."ProjectSprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."ProjectTaskAssignee" ADD CONSTRAINT "ProjectTaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "hr"."ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."ProjectTaskAssignee" ADD CONSTRAINT "ProjectTaskAssignee_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."ProjectObjective" ADD CONSTRAINT "ProjectObjective_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "hr"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."ProjectSubtask" ADD CONSTRAINT "ProjectSubtask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "hr"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."ProjectSubtask" ADD CONSTRAINT "ProjectSubtask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "hr"."ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."ProjectSprint" ADD CONSTRAINT "ProjectSprint_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "hr"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."ProjectMilestone" ADD CONSTRAINT "ProjectMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "hr"."Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."ProjectTimeEntry" ADD CONSTRAINT "ProjectTimeEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "hr"."ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr"."ProjectTimeEntry" ADD CONSTRAINT "ProjectTimeEntry_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "hr"."Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

