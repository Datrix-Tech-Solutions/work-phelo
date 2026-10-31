-- A prospect or client can be recorded before its location is known.
ALTER TABLE "marketing"."MarketingProspect" ALTER COLUMN "locationLabel" DROP NOT NULL,
ALTER COLUMN "latitude" DROP NOT NULL,
ALTER COLUMN "longitude" DROP NOT NULL;

ALTER TABLE "marketing"."MarketingClient" ALTER COLUMN "locationLabel" DROP NOT NULL,
ALTER COLUMN "latitude" DROP NOT NULL,
ALTER COLUMN "longitude" DROP NOT NULL;
