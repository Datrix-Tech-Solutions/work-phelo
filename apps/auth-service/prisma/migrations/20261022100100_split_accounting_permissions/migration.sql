-- Accounting gets a permission of its own for each area it used to borrow one for: transactions,
-- the archive, entities, cost centres, transaction settings and bank reconciliations. Reports stay
-- on accounting.ledger. Void and reverse of a journal are split from posting it.

INSERT INTO "w_auth"."Resource" ("id", "name", "module", "description", "isActive", "createdAt")
VALUES
  (gen_random_uuid()::text, 'accounting.bank-reconciliations', 'ACCOUNTING', 'Bank statement imports and reconciliation of cash accounts', true, now()),
  (gen_random_uuid()::text, 'accounting.transactions', 'ACCOUNTING', 'Raise, post, void and reverse direct receipts and payments', true, now()),
  (gen_random_uuid()::text, 'accounting.archive', 'ACCOUNTING', 'Voided entries: view, restore and remove from the archive', true, now()),
  (gen_random_uuid()::text, 'accounting.entities', 'ACCOUNTING', 'Accounting entities (customers, vendors and others) and entity types', true, now()),
  (gen_random_uuid()::text, 'accounting.cost-centres', 'ACCOUNTING', 'Accounting cost centres', true, now()),
  (gen_random_uuid()::text, 'accounting.transaction-settings', 'ACCOUNTING', 'Transaction types, source types and transaction rules', true, now())
ON CONFLICT ("name") DO NOTHING;

-- Keep access for every role that could do the work before the split. Each row reads: whoever holds
-- (from_resource, from_action) also gets (to_resource, to_action).
CREATE TEMP TABLE "accounting_split_map" ("from_resource", "from_action", "to_resource", "to_action") AS
  VALUES
    -- Direct receipts and payments were the cashbook.
    ('accounting.cashbook', 'VIEW',    'accounting.transactions', 'VIEW'),
    ('accounting.cashbook', 'CREATE',  'accounting.transactions', 'CREATE'),
    ('accounting.cashbook', 'APPROVE', 'accounting.transactions', 'APPROVE'),
    ('accounting.cashbook', 'APPROVE', 'accounting.transactions', 'CANCEL'),
    ('accounting.cashbook', 'DELETE',  'accounting.transactions', 'DELETE'),
    -- Contra transfers were cashbook:CREATE; they now belong to managing cash and bank.
    ('accounting.cashbook', 'CREATE',  'accounting.cash-accounts', 'EDIT'),
    ('accounting.cash-accounts', 'EDIT', 'accounting.cash-accounts', 'DEACTIVATE'),
    ('accounting.cash-accounts', 'VIEW', 'accounting.bank-reconciliations', 'VIEW'),
    ('accounting.cash-accounts', 'EDIT', 'accounting.bank-reconciliations', 'EDIT'),
    -- Void and reverse of a journal used to be the post permission.
    ('accounting.journals', 'APPROVE', 'accounting.journals', 'CANCEL'),
    ('accounting.journals', 'APPROVE', 'accounting.journals', 'DELETE'),
    -- The archive: viewing it was journals:VIEW, restoring and deleting from it were the post permissions.
    ('accounting.journals',    'VIEW',    'accounting.archive', 'VIEW'),
    ('accounting.journals',    'APPROVE', 'accounting.archive', 'EDIT'),
    ('accounting.journals',    'APPROVE', 'accounting.archive', 'DELETE'),
    ('accounting.cashbook',    'APPROVE', 'accounting.archive', 'EDIT'),
    ('accounting.cashbook',    'APPROVE', 'accounting.archive', 'DELETE'),
    ('accounting.receivables', 'APPROVE', 'accounting.archive', 'EDIT'),
    ('accounting.receivables', 'APPROVE', 'accounting.archive', 'DELETE'),
    ('accounting.payables',    'APPROVE', 'accounting.archive', 'EDIT'),
    ('accounting.payables',    'APPROVE', 'accounting.archive', 'DELETE'),
    -- Entities were subledger accounts under accounts, and entity types under settings.
    ('accounting.accounts', 'VIEW',   'accounting.entities', 'VIEW'),
    ('accounting.accounts', 'CREATE', 'accounting.entities', 'CREATE'),
    ('accounting.accounts', 'EDIT',   'accounting.entities', 'EDIT'),
    ('accounting.accounts', 'EDIT',   'accounting.entities', 'DEACTIVATE'),
    ('accounting.settings', 'VIEW',   'accounting.entities', 'VIEW'),
    ('accounting.settings', 'EDIT',   'accounting.entities', 'CREATE'),
    ('accounting.settings', 'EDIT',   'accounting.entities', 'EDIT'),
    ('accounting.settings', 'EDIT',   'accounting.entities', 'DELETE'),
    -- Cost centres were under accounts.
    ('accounting.accounts', 'VIEW',   'accounting.cost-centres', 'VIEW'),
    ('accounting.accounts', 'CREATE', 'accounting.cost-centres', 'CREATE'),
    ('accounting.accounts', 'EDIT',   'accounting.cost-centres', 'EDIT'),
    ('accounting.accounts', 'EDIT',   'accounting.cost-centres', 'DEACTIVATE'),
    -- Transaction types, source types and rules were under settings.
    ('accounting.settings', 'VIEW', 'accounting.transaction-settings', 'VIEW'),
    ('accounting.settings', 'EDIT', 'accounting.transaction-settings', 'CREATE'),
    ('accounting.settings', 'EDIT', 'accounting.transaction-settings', 'EDIT'),
    ('accounting.settings', 'EDIT', 'accounting.transaction-settings', 'DELETE'),
    -- Deactivating a group or classification could not be granted at all before.
    ('accounting.account-groups',          'EDIT', 'accounting.account-groups', 'DEACTIVATE'),
    ('accounting.account-classifications', 'EDIT', 'accounting.account-classifications', 'DEACTIVATE');

INSERT INTO "w_auth"."PermissionSetResource" ("id", "permissionSetId", "resourceId", "action")
SELECT DISTINCT
  gen_random_uuid()::text,
  psr."permissionSetId",
  target."id",
  m."to_action"::"w_auth"."PermissionAction"
FROM "accounting_split_map" m
JOIN "w_auth"."Resource" source ON source."name" = m."from_resource"
JOIN "w_auth"."PermissionSetResource" psr
  ON psr."resourceId" = source."id"
 AND psr."action" = m."from_action"::"w_auth"."PermissionAction"
JOIN "w_auth"."Resource" target ON target."name" = m."to_resource"
ON CONFLICT ("permissionSetId", "resourceId", "action") DO NOTHING;

-- The same for permissions granted to a user directly.
INSERT INTO "w_auth"."UserPermission" ("id", "tenantId", "userId", "resourceId", "action", "grantedBy", "grantedAt", "expiresAt", "isActive")
SELECT DISTINCT ON (up."tenantId", up."userId", target."id", m."to_action")
  gen_random_uuid()::text,
  up."tenantId",
  up."userId",
  target."id",
  m."to_action"::"w_auth"."PermissionAction",
  up."grantedBy",
  now(),
  up."expiresAt",
  true
FROM "accounting_split_map" m
JOIN "w_auth"."Resource" source ON source."name" = m."from_resource"
JOIN "w_auth"."UserPermission" up
  ON up."resourceId" = source."id"
 AND up."action" = m."from_action"::"w_auth"."PermissionAction"
 AND up."isActive" = true
 AND up."revokedAt" IS NULL
JOIN "w_auth"."Resource" target ON target."name" = m."to_resource"
WHERE NOT EXISTS (
  SELECT 1 FROM "w_auth"."UserPermission" existing
  WHERE existing."tenantId" = up."tenantId"
    AND existing."userId" = up."userId"
    AND existing."resourceId" = target."id"
    AND existing."action" = m."to_action"::"w_auth"."PermissionAction"
    AND existing."isActive" = true
);

DROP TABLE "accounting_split_map";
