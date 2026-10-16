-- Optional insurance and vehicle safety certificate dates. Nullable, so existing vehicles are unaffected.
ALTER TABLE "marketing"."MarketingFleetVehicle"
  ADD COLUMN "insuranceStartDate" DATE,
  ADD COLUMN "insuranceExpiryDate" DATE,
  ADD COLUMN "safetyCertificateIssuedOn" DATE,
  ADD COLUMN "safetyCertificateExpiresOn" DATE;
