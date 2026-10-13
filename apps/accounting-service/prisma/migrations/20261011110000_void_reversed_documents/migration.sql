-- Reversing an invoice, bill, credit note or debit note is gone: a mistake is edited or voided
-- instead. A document that was already reversed has no action left, so it is moved to the archive,
-- the same place voiding it would have taken it. Its original journal and the reversing journal
-- cancelled each other out, and both are voided together, so no balance, statement or report
-- changes. It can be restored from the archive while its period is open. Raw SQL, so it does not
-- depend on the period being open.

-- Receivable documents: audit trail first, while the reversal link is still on the row.
INSERT INTO "accounting"."AccountingAuditLog"
  ("id", "tenantId", "actorUserId", "action", "entityType", "entityId", "changedFields")
SELECT gen_random_uuid()::text, d."tenantId", COALESCE(d."reversedByUserId", 'system'),
  'RECEIVABLE_REVERSED_DOCUMENT_VOIDED', 'AccountingReceivableDocument', d."id",
  jsonb_build_object(
    'documentNumber', d."documentNumber",
    'reversalJournalEntryId', d."reversalJournalEntryId",
    'reason', 'Reversal is no longer available; the reversed document is moved to the archive'
  )
FROM "accounting"."AccountingReceivableDocument" AS d
WHERE d."status" = 'REVERSED';

-- Both journals leave the books. The reversal was exactly offsetting the original, so no balance moves.
UPDATE "accounting"."JournalEntry" AS j
SET "status" = 'VOIDED', "voidedAt" = now(), "voidedByUserId" = d."reversedByUserId",
    "voidReason" = 'Reversal is no longer available',
    "reversedAt" = NULL, "reversedByUserId" = NULL
FROM "accounting"."AccountingReceivableDocument" AS d
WHERE d."status" = 'REVERSED'
  AND j."tenantId" = d."tenantId"
  AND j."id" IN (d."postedJournalEntryId", d."reversalJournalEntryId")
  AND j."status" IN ('POSTED', 'REVERSED');

UPDATE "accounting"."AccountingReceivableDocument"
SET "status" = 'VOIDED', "voidedAt" = now(), "voidedByUserId" = "reversedByUserId",
    "voidReason" = 'Reversal is no longer available',
    "reversedAt" = NULL, "reversedByUserId" = NULL, "reversalJournalEntryId" = NULL
WHERE "status" = 'REVERSED';

-- Payable documents: audit trail first, while the reversal link is still on the row.
INSERT INTO "accounting"."AccountingAuditLog"
  ("id", "tenantId", "actorUserId", "action", "entityType", "entityId", "changedFields")
SELECT gen_random_uuid()::text, d."tenantId", COALESCE(d."reversedByUserId", 'system'),
  'PAYABLE_REVERSED_DOCUMENT_VOIDED', 'AccountingPayableDocument', d."id",
  jsonb_build_object(
    'documentNumber', d."documentNumber",
    'reversalJournalEntryId', d."reversalJournalEntryId",
    'reason', 'Reversal is no longer available; the reversed document is moved to the archive'
  )
FROM "accounting"."AccountingPayableDocument" AS d
WHERE d."status" = 'REVERSED';

-- Both journals leave the books. The reversal was exactly offsetting the original, so no balance moves.
UPDATE "accounting"."JournalEntry" AS j
SET "status" = 'VOIDED', "voidedAt" = now(), "voidedByUserId" = d."reversedByUserId",
    "voidReason" = 'Reversal is no longer available',
    "reversedAt" = NULL, "reversedByUserId" = NULL
FROM "accounting"."AccountingPayableDocument" AS d
WHERE d."status" = 'REVERSED'
  AND j."tenantId" = d."tenantId"
  AND j."id" IN (d."postedJournalEntryId", d."reversalJournalEntryId")
  AND j."status" IN ('POSTED', 'REVERSED');

UPDATE "accounting"."AccountingPayableDocument"
SET "status" = 'VOIDED', "voidedAt" = now(), "voidedByUserId" = "reversedByUserId",
    "voidReason" = 'Reversal is no longer available',
    "reversedAt" = NULL, "reversedByUserId" = NULL, "reversalJournalEntryId" = NULL
WHERE "status" = 'REVERSED';
