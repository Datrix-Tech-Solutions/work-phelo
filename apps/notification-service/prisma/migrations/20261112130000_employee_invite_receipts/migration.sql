BEGIN;
CREATE TYPE "notify"."EmployeeInviteReceiptStatus" AS ENUM ('SENDING', 'PROVIDER_ACCEPTED', 'RETRY', 'UNKNOWN', 'EXPIRED');
CREATE TABLE "notify"."EmployeeInviteReceipt" (
  "id" TEXT NOT NULL PRIMARY KEY, "tenantId" TEXT NOT NULL, "userId" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
  "status" "notify"."EmployeeInviteReceiptStatus" NOT NULL DEFAULT 'SENDING',
  "leaseToken" TEXT, "leaseUntil" TIMESTAMP(3), "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "lastErrorCode" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
COMMIT;
