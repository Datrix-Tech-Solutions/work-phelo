-- Expected value and commission come across from the prospect product at conversion.
-- Achieved revenue is intentionally absent: it will be derived from the sales module.
ALTER TABLE "marketing"."MarketingClientProduct"
  ADD COLUMN "expectedValue" DECIMAL(18, 2),
  ADD COLUMN "commissionRate" DECIMAL(7, 4),
  ADD COLUMN "commissionAmount" DECIMAL(18, 2);
