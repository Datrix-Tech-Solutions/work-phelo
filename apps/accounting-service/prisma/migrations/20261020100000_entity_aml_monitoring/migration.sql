-- Entity AML monitoring settings. Stored only for now: nothing flags or blocks on them yet.
CREATE TYPE "accounting"."AmlRiskRating" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "accounting"."AmlAmountPeriod" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY');
CREATE TYPE "accounting"."AmlCountPeriod" AS ENUM ('HOURS_12', 'HOURS_24', 'HOURS_48');

ALTER TABLE "accounting"."SubledgerAccount"
  ADD COLUMN "monitorWithAml" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isPoliticallyExposed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "riskRating" "accounting"."AmlRiskRating",
  ADD COLUMN "amlAmountLimit" DECIMAL(18,2),
  ADD COLUMN "amlAmountPeriod" "accounting"."AmlAmountPeriod",
  ADD COLUMN "amlTransactionCountLimit" INTEGER,
  ADD COLUMN "amlTransactionCountPeriod" "accounting"."AmlCountPeriod";
