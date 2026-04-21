/*
  Warnings:

  - A unique constraint covering the columns `[inviteToken]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "auth"."OtpType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET', 'MFA_SMS');

-- CreateEnum
CREATE TYPE "auth"."SocialProvider" AS ENUM ('GOOGLE', 'MICROSOFT');

-- CreateEnum
CREATE TYPE "auth"."MfaMethod" AS ENUM ('TOTP', 'SMS');

-- AlterTable
ALTER TABLE "auth"."RefreshToken" ADD COLUMN     "deviceId" TEXT,
ADD COLUMN     "deviceName" TEXT;

-- AlterTable
ALTER TABLE "auth"."User" ADD COLUMN     "forcePasswordReset" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "inviteExpiresAt" TIMESTAMP(3),
ADD COLUMN     "inviteToken" TEXT,
ADD COLUMN     "mfaMethod" "auth"."MfaMethod",
ALTER COLUMN "password" DROP NOT NULL;

-- CreateTable
CREATE TABLE "auth"."OtpCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "auth"."OtpType" NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth"."SocialAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "auth"."SocialProvider" NOT NULL,
    "providerId" TEXT NOT NULL,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocialAccount_provider_providerId_key" ON "auth"."SocialAccount"("provider", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_inviteToken_key" ON "auth"."User"("inviteToken");

-- AddForeignKey
ALTER TABLE "auth"."OtpCode" ADD CONSTRAINT "OtpCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth"."SocialAccount" ADD CONSTRAINT "SocialAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "auth"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
