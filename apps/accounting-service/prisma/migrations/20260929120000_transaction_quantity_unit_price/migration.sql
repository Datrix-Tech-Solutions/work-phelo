-- Optional descriptive quantity / unit price on bills, invoices and cashbook entries.
-- amount stays the stored source of truth (quantity × unitPrice, 2dp) and is validated in
-- application code.
ALTER TABLE "accounting"."AccountingPayableDocument"
  ADD COLUMN "quantity" DECIMAL(20,4),
  ADD COLUMN "unitPrice" DECIMAL(20,4);

ALTER TABLE "accounting"."AccountingReceivableDocument"
  ADD COLUMN "quantity" DECIMAL(20,4),
  ADD COLUMN "unitPrice" DECIMAL(20,4);

ALTER TABLE "accounting"."CashbookTransaction"
  ADD COLUMN "quantity" DECIMAL(20,4),
  ADD COLUMN "unitPrice" DECIMAL(20,4);
