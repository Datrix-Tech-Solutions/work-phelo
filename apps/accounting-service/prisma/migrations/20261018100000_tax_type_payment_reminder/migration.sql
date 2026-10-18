-- A tax type can carry a payment reminder: how often the tax is paid, the day it is due in the month
-- after each period ends, and how many days ahead to remind. Off for existing tax types.
CREATE TYPE "accounting"."TaxPayFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

ALTER TABLE "accounting"."TaxType"
  ADD COLUMN "reminderEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "reminderFrequency" "accounting"."TaxPayFrequency" NOT NULL DEFAULT 'MONTHLY',
  ADD COLUMN "reminderDueDay" INTEGER,
  ADD COLUMN "reminderDueOnLastDay" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "reminderDaysBefore" INTEGER NOT NULL DEFAULT 3;
