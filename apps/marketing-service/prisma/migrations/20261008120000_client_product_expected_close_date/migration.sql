-- The date a client's product is expected to close, captured when the client is created.
ALTER TABLE "marketing"."MarketingClientProduct"
  ADD COLUMN "expectedCloseDate" TIMESTAMP(3);
