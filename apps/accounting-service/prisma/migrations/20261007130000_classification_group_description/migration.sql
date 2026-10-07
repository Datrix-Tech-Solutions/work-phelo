-- Classifications and parent accounts (account groups) can carry a description, like accounts do.

-- AlterTable
ALTER TABLE "accounting"."AccountClassification" ADD COLUMN "description" TEXT;

-- AlterTable
ALTER TABLE "accounting"."AccountGroup" ADD COLUMN "description" TEXT;
