# WorkPhelo Accounting Service

The Accounting Service owns tenant-scoped ledgers, posting policy and financial
recognition. It must remain independently usable even when operational modules
such as Reinsurance are unavailable or disabled.

## Responsibilities

- Chart of Accounts, account hierarchy and account status.
- Fiscal periods, currencies, cost centres and accounting settings.
- Manual journals, posting, reversal and General Ledger reads.
- Customers/vendors and subledger references.
- Cash, bank and wallet account masters.
- Standalone cashbook receipts, payments, transfers, bank charges and adjustments.
- Posting rules for source-module events.
- Source Event Inbox, idempotency, reconciliation and retry state.
- Financial Confirmation Queue adapters for optional source modules.

Accounting chooses GL accounts through tenant posting rules. Source modules
publish business facts only.

## Gateway Prefix

```text
/api/v1/accounting/*
```

Direct local service routes use the global prefix:

```text
/api/*
```

Internal source-event and subledger ensure endpoints intentionally bypass the
global `/api` prefix and require signed internal-service authentication.

## Local Development

```bash
npm run dev --workspace=apps/accounting-service
```

Default local port: `4008`

Local Swagger: `http://localhost:4008/api/docs`

## Database

```bash
npm run db:generate --workspace=apps/accounting-service
npm run db:migrate --workspace=apps/accounting-service
npm run db:validate --workspace=apps/accounting-service
```

The service owns the Accounting Prisma schema and migrations. Do not apply
Reinsurance migrations through Accounting.

## Key Environment Variables

| Variable                                       | Required                | Secret | Purpose                                                     |
| ---------------------------------------------- | ----------------------- | ------ | ----------------------------------------------------------- |
| `DATABASE_URL`                                 | Yes                     | Yes    | Accounting PostgreSQL schema                                |
| `JWT_SECRET`                                   | Yes                     | Yes    | User JWT verification                                       |
| `INTERNAL_SERVICE_AUTH_SECRET`                 | For source integrations | Yes    | HMAC verification for internal source-event/subledger calls |
| `INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES`       | Optional                | No     | Comma-separated allowed internal service names              |
| `INTERNAL_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS` | Optional                | No     | Internal request timestamp skew window                      |
| `ENABLE_SWAGGER`                               | Optional                | No     | Explicit Swagger enable/disable                             |
| `DEPLOY_ENV`                                   | Optional                | No     | Dev/prod Swagger default behavior                           |

## Integrations

Reinsurance is currently the first operational source-module integration. Active
source-event families include issued debit/credit notes, endorsement notes,
premium receipts and reversals, bank-confirmed reinsurer disbursements and
reversals, claim-level payable approvals and allocation-level claim recovery
approvals, plus bank-confirmed claim recovery receipts and reversals.
Bank-confirmed cedant claim settlements and reversals complete the Cedant-side
claim payable settlement boundary.

### Active Reinsurance AR/AP Matrix

| Event                              | Recognition boundary                             | Business meaning                                  |
| ---------------------------------- | ------------------------------------------------ | ------------------------------------------------- |
| `DEBIT_NOTE_ISSUED`                | Official placement debit note issue time         | Cedant owes premium to broker                     |
| `CREDIT_NOTE_ISSUED`               | Official placement credit note issue time        | Broker owes premium share to Reinsurer            |
| `ENDORSEMENT_DEBIT_NOTE_ISSUED`    | Official endorsement debit note issue time       | Additional premium due from Cedant                |
| `ENDORSEMENT_CREDIT_NOTE_ISSUED`   | Official endorsement credit note issue time      | Return premium or payable adjustment to Reinsurer |
| `PREMIUM_PAYMENT_RECEIVED`         | Accounting confirmation time (`bankConfirmedAt`) | Cedant payment clears receivable                  |
| `PAYMENT_REVERSED`                 | Reversal row creation time                       | Premium receipt reversal                          |
| `REINSURER_DISBURSEMENT_RECORDED`  | Accounting confirmation time (`bankConfirmedAt`) | Confirmed Reinsurer settlement                    |
| `REINSURER_DISBURSEMENT_REVERSED`  | Reversal row creation time                       | Reinsurer disbursement reversal                   |
| `CLAIM_PAYABLE_APPROVED`           | Broker claim-level payable approval time         | Approved Cedant claim payable                     |
| `CLAIM_CEDANT_SETTLEMENT_PAID`     | Accounting confirmation time (`bankConfirmedAt`) | Broker settlement paid to Cedant                  |
| `CLAIM_CEDANT_SETTLEMENT_REVERSED` | Reversal row creation time                       | Cedant claim settlement reversal                  |
| `CLAIM_RECOVERY_APPROVED`          | Formal per-allocation recovery approval time     | Approved Reinsurer recovery receivable            |
| `CLAIM_RECOVERY_RECEIVED`          | Accounting confirmation time (`bankConfirmedAt`) | Confirmed Reinsurer claim recovery receipt        |
| `CLAIM_RECOVERY_RECEIPT_REVERSED`  | Reversal row creation time                       | Claim recovery receipt reversal                   |

Operational Reinsurance payments can be recorded before Accounting recognition.
No Accounting outbox event is created at that point for bank-confirmed
workflows; recognition starts at the Accounting-owned confirmation boundary.

Claims events that remain policy-gated must not be treated as active posting
events until implemented and covered by posting rules.

## Validation

```bash
npm run test --workspace=apps/accounting-service
npm run lint --workspace=apps/accounting-service
npm run check-types --workspace=apps/accounting-service
npm run build --workspace=apps/accounting-service
```

## Operational Notes

- Posted journals are immutable; corrections use linked reversals.
- Posted cashbook transactions are immutable; corrections use linked reversal
  cashbook rows and reversal journals.
- Cash/bank accounts store only masked public identifiers. Do not store raw
  credentials, secrets or provider tokens.
- Cross-currency cashbook transfers require an explicit agreed exchange rate;
  Accounting never fetches live FX during posting.
- Source-event idempotency keys are tenant-scoped and deterministic.
- Manual Accounting remains supported independently of automation.
- Posting rules are tenant-owned and determine final debit/credit accounts.
