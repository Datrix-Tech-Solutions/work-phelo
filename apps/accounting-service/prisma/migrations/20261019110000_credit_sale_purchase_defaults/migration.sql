-- Adds the Credit Sale (receivable) and Credit Purchase (payable) default transaction types to
-- tenants whose Receivable/Payable types are still exactly the two original defaults, Receipt
-- (RCPT) and Payment (PMNT). A tenant that has added, removed or renamed any Receivable/Payable
-- type is left alone. New tenants get these from the seed in AccountingMasterDataService.
--
-- Each new type gets a starter rule with only its main line (Credit Sale: a credit to Revenue;
-- Credit Purchase: a debit to Expense or Asset). The control (AR/AP) line and any tax lines
-- depend on the tenant's own accounts, so the user adds them. Receipt and Payment also get the
-- CUSTOMER / VENDOR business role, where they have none set.

DO $$
DECLARE
  t RECORD;
  type_id TEXT;
  rule_id TEXT;
  line_id TEXT;
BEGIN
  FOR t IN
    SELECT "tenantId", MIN("createdByUserId") AS user_id
    FROM "accounting"."TransactionType"
    WHERE "category" IN ('RECEIVABLE', 'PAYABLE')
    GROUP BY "tenantId"
    HAVING COUNT(*) = 2
       AND COUNT(*) FILTER (WHERE "code" = 'RCPT' AND "category" = 'RECEIVABLE') = 1
       AND COUNT(*) FILTER (WHERE "code" = 'PMNT' AND "category" = 'PAYABLE') = 1
  LOOP
    UPDATE "accounting"."TransactionType"
    SET "businessRoles" = ARRAY['CUSTOMER']::TEXT[], "updatedAt" = CURRENT_TIMESTAMP
    WHERE "tenantId" = t."tenantId" AND "code" = 'RCPT' AND cardinality("businessRoles") = 0;

    UPDATE "accounting"."TransactionType"
    SET "businessRoles" = ARRAY['VENDOR']::TEXT[], "updatedAt" = CURRENT_TIMESTAMP
    WHERE "tenantId" = t."tenantId" AND "code" = 'PMNT' AND cardinality("businessRoles") = 0;

    -- Credit Sale
    type_id := gen_random_uuid()::text;
    rule_id := gen_random_uuid()::text;
    line_id := gen_random_uuid()::text;
    INSERT INTO "accounting"."TransactionType"
      ("id", "tenantId", "code", "name", "category", "businessRoles", "description",
       "isSystemDefault", "createdByUserId", "updatedByUserId", "updatedAt")
    VALUES
      (type_id, t."tenantId", 'CRE-SAL', 'Credit Sale', 'RECEIVABLE', ARRAY['CUSTOMER']::TEXT[],
       'A sale made on credit, to be collected from the customer later.',
       true, t.user_id, t.user_id, CURRENT_TIMESTAMP);
    INSERT INTO "accounting"."TransactionTypeRule"
      ("id", "tenantId", "transactionTypeId", "createdByUserId", "updatedByUserId", "updatedAt")
    VALUES (rule_id, t."tenantId", type_id, t.user_id, t.user_id, CURRENT_TIMESTAMP);
    INSERT INTO "accounting"."TransactionTypeRuleLine"
      ("id", "tenantId", "ruleId", "sequence", "direction", "updatedAt")
    VALUES (line_id, t."tenantId", rule_id, 1, 'CR', CURRENT_TIMESTAMP);
    INSERT INTO "accounting"."TransactionTypeRuleLineScope" ("id", "tenantId", "ruleLineId", "category")
    VALUES (gen_random_uuid()::text, t."tenantId", line_id, 'REVENUE');

    -- Credit Purchase
    type_id := gen_random_uuid()::text;
    rule_id := gen_random_uuid()::text;
    line_id := gen_random_uuid()::text;
    INSERT INTO "accounting"."TransactionType"
      ("id", "tenantId", "code", "name", "category", "businessRoles", "description",
       "isSystemDefault", "createdByUserId", "updatedByUserId", "updatedAt")
    VALUES
      (type_id, t."tenantId", 'CRE-PUR', 'Credit Purchase', 'PAYABLE', ARRAY['VENDOR']::TEXT[],
       'A purchase made on credit, to be paid to the supplier later.',
       true, t.user_id, t.user_id, CURRENT_TIMESTAMP);
    INSERT INTO "accounting"."TransactionTypeRule"
      ("id", "tenantId", "transactionTypeId", "createdByUserId", "updatedByUserId", "updatedAt")
    VALUES (rule_id, t."tenantId", type_id, t.user_id, t.user_id, CURRENT_TIMESTAMP);
    INSERT INTO "accounting"."TransactionTypeRuleLine"
      ("id", "tenantId", "ruleId", "sequence", "direction", "updatedAt")
    VALUES (line_id, t."tenantId", rule_id, 1, 'DR', CURRENT_TIMESTAMP);
    INSERT INTO "accounting"."TransactionTypeRuleLineScope" ("id", "tenantId", "ruleLineId", "category")
    VALUES
      (gen_random_uuid()::text, t."tenantId", line_id, 'EXPENSE'),
      (gen_random_uuid()::text, t."tenantId", line_id, 'ASSET');
  END LOOP;
END $$;
