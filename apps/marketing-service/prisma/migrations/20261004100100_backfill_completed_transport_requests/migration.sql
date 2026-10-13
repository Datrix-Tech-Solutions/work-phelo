-- Trips used to complete on their own once the date had passed. Completing is now an
-- explicit action, so approved trips from earlier dates are marked completed here to
-- keep them in Request History instead of showing as overdue. Their real return time
-- was never recorded, so it stays empty. This is a separate migration because a new
-- enum value cannot be used in the transaction that adds it.
UPDATE "marketing"."MarketingTransportRequest"
SET "status" = 'COMPLETED', "completedAt" = NOW()
WHERE "status" = 'APPROVED' AND "travelDate" < CURRENT_DATE;
