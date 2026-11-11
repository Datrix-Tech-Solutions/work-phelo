-- An order that was only partly delivered can be closed: what is still outstanding is no longer expected.
ALTER TYPE "inventory"."PurchaseOrderStatus" ADD VALUE 'CLOSED';
