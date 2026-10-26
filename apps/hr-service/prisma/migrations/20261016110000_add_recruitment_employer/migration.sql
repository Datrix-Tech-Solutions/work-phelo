-- CreateTable
CREATE TABLE "hr"."RecruitmentEmployer" (
    "tenantId" TEXT NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentEmployer_pkey" PRIMARY KEY ("tenantId")
);
