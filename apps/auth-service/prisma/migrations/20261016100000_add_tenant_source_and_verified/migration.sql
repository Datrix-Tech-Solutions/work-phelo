CREATE TYPE "w_auth"."TenantSource" AS ENUM ('PLATFORM', 'WEBSITE');

ALTER TABLE "w_auth"."Tenant"
ADD COLUMN "source" "w_auth"."TenantSource" NOT NULL DEFAULT 'PLATFORM',
ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false;

-- Every company that exists today came through the platform.
UPDATE "w_auth"."Tenant" SET "isVerified" = true;
