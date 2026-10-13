ALTER TABLE "marketing"."MarketingCampaign"
  ADD COLUMN "businessTypeIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "businessTypeNames" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "marketing"."MarketingCampaign"
SET "businessTypeIds" = ARRAY["businessTypeId"],
    "businessTypeNames" = ARRAY["businessTypeName"];

ALTER TABLE "marketing"."MarketingCampaign"
  ALTER COLUMN "businessTypeIds" DROP DEFAULT,
  ALTER COLUMN "businessTypeNames" DROP DEFAULT,
  DROP COLUMN "businessTypeId",
  DROP COLUMN "businessTypeName";
