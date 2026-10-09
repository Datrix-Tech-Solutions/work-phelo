-- A direct cashbook entry that names an entity is listed on that entity's transactions but must
-- not move its outstanding balance. For a short time posting tagged every offset line of such an
-- entry with the entity, which did. Remove those tags. Only entries made on the New Transaction
-- form are touched (no source module, no explicit offset subledger), so payroll and other
-- source events, and invoice/bill settlements, keep theirs. Amounts and GL accounts are unchanged.
UPDATE "accounting"."JournalLine" AS jl
SET "subledgerAccountId" = NULL
FROM "accounting"."CashbookTransaction" AS ct
WHERE jl."tenantId" = ct."tenantId"
  AND jl."journalEntryId" = ct."postedJournalEntryId"
  AND jl."subledgerAccountId" IS NOT NULL
  AND ct."counterpartyId" IS NOT NULL
  AND ct."offsetSubledgerAccountId" IS NULL
  AND ct."sourceModule" IS NULL
  AND ct."transactionType" <> 'TRANSFER';
