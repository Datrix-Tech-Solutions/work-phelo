-- Another module can now raise a payment (e.g. Inventory paying a supplier), not only an invoice or receipt.
ALTER TYPE "accounting"."AccountingSourceTransactionKind" ADD VALUE 'PAYMENT';
