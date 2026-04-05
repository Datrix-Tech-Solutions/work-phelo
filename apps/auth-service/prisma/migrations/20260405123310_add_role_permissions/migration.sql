-- AlterTable
ALTER TABLE "auth"."CompanyRole" ADD COLUMN     "permissions" JSONB NOT NULL DEFAULT '{"hr": "none", "accounting": "none", "marketing": "none"}';
