-- Deactivating a record is its own permission, apart from editing it. Accounting already asks for
-- it on account groups, classifications, customers and vendors, which no role could be given.
ALTER TYPE "w_auth"."PermissionAction" ADD VALUE IF NOT EXISTS 'DEACTIVATE';
