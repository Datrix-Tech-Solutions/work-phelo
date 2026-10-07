-- Numbers typed in local form (0244072091) were saved as +2330244072091. A Ghanaian number never
-- has a 0 straight after +233, so drop it to get the international form (+233244072091).
UPDATE "marketing"."MarketingProspectContact"
  SET "phone" = '+233' || SUBSTRING("phone" FROM 6)
  WHERE "phone" LIKE '+2330%';

UPDATE "marketing"."MarketingClientContact"
  SET "phone" = '+233' || SUBSTRING("phone" FROM 6)
  WHERE "phone" LIKE '+2330%';
