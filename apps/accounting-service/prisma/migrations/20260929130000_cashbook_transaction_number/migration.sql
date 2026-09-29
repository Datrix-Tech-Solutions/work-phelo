-- Human-readable ID for direct Receipt/Payment transactions (e.g. RCPT26-00001). Nullable:
-- existing rows and non-transaction cashbook entries (transfers, charges, ...) have none.
ALTER TABLE "accounting"."CashbookTransaction" ADD COLUMN "transactionNumber" TEXT;

CREATE UNIQUE INDEX "CashbookTransaction_tenantId_transactionNumber_key"
  ON "accounting"."CashbookTransaction"("tenantId", "transactionNumber");
