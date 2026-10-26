-- AlterTable
ALTER TABLE "hr"."RecruitmentApplication"
  ADD COLUMN "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "certificates" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "educationHistory" JSONB,
  ADD COLUMN "workHistory" JSONB;
