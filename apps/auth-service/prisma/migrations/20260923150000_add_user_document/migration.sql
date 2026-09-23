-- "Personal Documents": files a user uploads about themselves, distinct from
-- hr-service's EmployeeDocument (HR-managed "Company Documents").

CREATE TABLE "w_auth"."UserDocument" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserDocument_tenantId_userId_idx" ON "w_auth"."UserDocument"("tenantId", "userId");

ALTER TABLE "w_auth"."UserDocument" ADD CONSTRAINT "UserDocument_userId_fkey" FOREIGN KEY ("userId") REFERENCES "w_auth"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
