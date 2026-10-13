-- Clients converted before product terms were carried over have blank expected revenue and
-- commission. Copy them from the prospect products they were converted from.
UPDATE "marketing"."MarketingClientProduct" cp
SET
  "expectedValue" = pp."expectedValue",
  "commissionRate" = pp."commissionRate",
  "commissionAmount" = CASE
    WHEN pp."commissionRate" IS NULL THEN pp."commissionAmount"
    ELSE ROUND(pp."expectedValue" * pp."commissionRate" / 100, 2)
  END
FROM "marketing"."MarketingClient" c
JOIN "marketing"."MarketingProspectProduct" pp
  ON pp."prospectId" = c."convertedFromProspectId"
WHERE cp."clientId" = c."id"
  AND pp."productId" = cp."productId"
  AND cp."expectedValue" IS NULL;
