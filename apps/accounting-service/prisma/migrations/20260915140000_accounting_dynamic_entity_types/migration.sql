-- SubledgerAccount.type stops being capped at the fixed SubledgerType enum — it now
-- holds the tenant's own EntityType.name (uppercased), validated in application code
-- instead of by a Postgres enum, so a custom Entity Type can actually back real entities.
ALTER TABLE "accounting"."SubledgerAccount"
  ALTER COLUMN "type" TYPE TEXT USING "type"::TEXT;

-- Same relaxation for a Transaction Type Rule line's subledger tag.
ALTER TABLE "accounting"."TransactionTypeRuleLine"
  ALTER COLUMN "subledgerType" TYPE TEXT USING "subledgerType"::TEXT;
