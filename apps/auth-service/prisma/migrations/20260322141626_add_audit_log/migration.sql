-- CreateEnum
CREATE TYPE "auth"."AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REVOKE', 'LOGIN', 'LOGOUT', 'EXPORT', 'ASSIGN', 'RUN');

-- CreateEnum
CREATE TYPE "auth"."AuditStatus" AS ENUM ('SUCCESS', 'FAILURE');

-- CreateTable
CREATE TABLE "auth"."AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "userEmail" TEXT,
    "userRole" TEXT,
    "action" "auth"."AuditAction" NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "changes" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "status" "auth"."AuditStatus" NOT NULL DEFAULT 'SUCCESS',
    "failureReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_createdAt_idx" ON "auth"."AuditLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_resource_idx" ON "auth"."AuditLog"("tenantId", "resource");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_userId_idx" ON "auth"."AuditLog"("tenantId", "userId");
