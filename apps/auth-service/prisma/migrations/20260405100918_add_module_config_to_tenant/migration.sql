-- AlterTable
ALTER TABLE "auth"."Tenant" ADD COLUMN     "moduleConfig" JSONB NOT NULL DEFAULT '{"hr": false, "accounting": false, "marketing": false}';
