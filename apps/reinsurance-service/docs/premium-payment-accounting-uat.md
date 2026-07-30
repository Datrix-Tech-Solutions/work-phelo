# Reinsurance Accounting UAT: PREMIUM_PAYMENT_RECEIVED and PAYMENT_REVERSED

Status: Draft 1

Parent standards:

- `docs/workphelo-financial-integration-standard-v1.md`
- `docs/workphelo-reinsurance-accounting-integration-spec-v1.md`

## Scope

This UAT guide covers only:

```text
REINSURANCE + PREMIUM_PAYMENT_RECEIVED
REINSURANCE + PAYMENT_REVERSED
```

It does not cover credit notes, endorsement notes, claims, recoveries,
settlements or reinsurer disbursements.

## Recognition Boundaries

`PREMIUM_PAYMENT_RECEIVED` is recognized when a valid premium receipt
`PlacementPayment` row is recorded.

`PAYMENT_REVERSED` is recognized when a distinct reversal `PlacementPayment` row
is created and linked to the original payment through `reversalOfPaymentId`.

Accounting delivery remains asynchronous. Reinsurance must not call Accounting
synchronously inside the payment create or reversal transaction.

## Allocation Model

Current premium payments are placement-level receivable settlements.

The payment workflow does not allocate premium receipts to one specific debit
note or multiple debit notes. The event payload therefore marks:

```json
{
  "allocation": {
    "model": "PLACEMENT_LEVEL_RECEIVABLE",
    "noteAllocationSupported": false
  }
}
```

Accounting posting rules must not infer a note-level settlement that the
Reinsurance source record does not support.

## Posting Rule Shapes

Exact GL accounts are tenant policy and remain Accounting-owned.

### Premium Payment Received

| Line | Direction | Conceptual account              | Subledger                       | Amount source           |
| ---- | --------- | ------------------------------- | ------------------------------- | ----------------------- |
| 1    | DR        | Bank / Cash / Undeposited Funds | None                            | `amounts.paymentAmount` |
| 2    | CR        | Cedant Premium Receivable       | `CEDANT` from `counterparty.id` | `amounts.paymentAmount` |

### Payment Reversed

| Line | Direction | Conceptual account              | Subledger                       | Amount source           |
| ---- | --------- | ------------------------------- | ------------------------------- | ----------------------- |
| 1    | DR        | Cedant Premium Receivable       | `CEDANT` from `counterparty.id` | `amounts.paymentAmount` |
| 2    | CR        | Bank / Cash / Undeposited Funds | None                            | `amounts.paymentAmount` |

Reversal payloads include signed audit facts, but the posting-rule engine uses
positive amounts and tenant-configured DR/CR lines.

## UAT Scenarios

| Scenario                    | Action                                                                                   | Expected Accounting Result                                                                                         | Expected Journal Result                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Record premium payment      | Record an inbound premium receipt for the placement Cedant.                              | One Reinsurance outbox row is created for `PREMIUM_PAYMENT_RECEIVED`.                                              | Processing creates one balanced journal using the tenant payment-received posting rule.            |
| Accounting disabled         | Disable Accounting for the tenant, then record a premium receipt.                        | Payment records successfully. No Reinsurance outbox row is created in Phase 1.                                     | No Accounting source event or journal is expected.                                                 |
| Temporary Accounting outage | Stop Accounting service, record a premium receipt, then run dispatcher.                  | Payment records successfully. Outbox row remains durable and dispatcher marks it `FAILED` with retry metadata.     | No journal is created until Accounting recovers and the same event is delivered.                   |
| Missing URL/HMAC            | Remove Accounting URL or misconfigure HMAC, record payment, then run dispatcher.         | Payment records successfully. Outbox row stores a clear configuration/auth diagnostic.                             | No journal is created until configuration is fixed and the same outbox row is retried.             |
| Missing posting rule        | Deliver/process payment event without an active posting rule.                            | Accounting `SourceEventInbox` remains auditable and processing fails with posting-rule reason.                     | No journal is created.                                                                             |
| Missing Cedant subledger    | Deliver/process payment event before Cedant subledger exists.                            | Accounting `SourceEventInbox` remains auditable and processing fails with active Cedant subledger reason.          | No journal is created.                                                                             |
| Closed fiscal period        | Close/lock fiscal period for the payment date, then process the source event.            | Source event becomes `FAILED` with fiscal-period reason.                                                           | No journal is created.                                                                             |
| Duplicate delivery          | Retry delivery of the same payment outbox row.                                           | Accounting idempotency key returns or protects the existing source event.                                          | No duplicate journal is created for the same source event.                                         |
| Reverse payment             | Reverse a recorded premium payment.                                                      | Original payment is marked `REVERSED`; a distinct reversal payment row and `PAYMENT_REVERSED` outbox row are made. | Processing creates one separate balanced reversal journal. Original journal remains auditable.     |
| Duplicate reversal          | Attempt to reverse the original payment again.                                           | Reinsurance rejects duplicate reversal according to current domain rules.                                          | No additional reversal outbox event or journal is created.                                         |
| Reconciliation dry run      | Call payment reconciliation with `dryRun=true`.                                          | Missing deterministic payment or reversal outbox rows are reported only.                                           | No journal is created by dry run.                                                                  |
| Reconciliation enqueue      | Call payment reconciliation with `dryRun=false` for a missing event.                     | Missing event is enqueued with original payment/reversal date and deterministic idempotency key.                   | Journal is created only after dispatcher delivery and Accounting source-event processing.          |
| Reverse traceability        | Start from Accounting journal created from payment or reversal and trace back to source. | Journal links to `SourceEventInbox`, then to Reinsurance outbox and `PlacementPayment.sourceRecordId`.             | Broker/support can identify original payment, reversal payment, placement and Cedant from payload. |

## Reconciliation Endpoints

Premium payment dry run:

```http
POST /api/v1/operations/reinsurance/accounting-integration/reconciliation/premium-payment-received?dryRun=true&limit=50
```

Premium payment explicit enqueue:

```http
POST /api/v1/operations/reinsurance/accounting-integration/reconciliation/premium-payment-received?dryRun=false&limit=50
```

Payment reversal dry run:

```http
POST /api/v1/operations/reinsurance/accounting-integration/reconciliation/payment-reversed?dryRun=true&limit=50
```

Payment reversal explicit enqueue:

```http
POST /api/v1/operations/reinsurance/accounting-integration/reconciliation/payment-reversed?dryRun=false&limit=50
```

The operations are tenant scoped and duplicate-safe.

## Expected Payload Markers

`PREMIUM_PAYMENT_RECEIVED`:

```json
{
  "sourceModule": "REINSURANCE",
  "sourceEventType": "PREMIUM_PAYMENT_RECEIVED",
  "sourceRecordId": "<payment-id>",
  "sourceDocumentId": "<payment-id>",
  "payload": {
    "references": {
      "placementId": "<placement-id>",
      "placementReference": "<placement-reference>",
      "paymentId": "<payment-id>"
    },
    "counterparty": {
      "id": "<cedant-id>",
      "type": "CEDANT"
    },
    "amounts": {
      "paymentAmount": 1000,
      "signedCashImpact": 1000,
      "signedReceivableImpact": -1000
    },
    "allocation": {
      "model": "PLACEMENT_LEVEL_RECEIVABLE",
      "noteAllocationSupported": false
    }
  }
}
```

`PAYMENT_REVERSED`:

```json
{
  "sourceModule": "REINSURANCE",
  "sourceEventType": "PAYMENT_REVERSED",
  "sourceRecordId": "<reversal-payment-id>",
  "sourceDocumentId": "<reversal-payment-id>",
  "payload": {
    "references": {
      "originalPaymentId": "<original-payment-id>",
      "reversalPaymentId": "<reversal-payment-id>"
    },
    "amounts": {
      "paymentAmount": 1000,
      "signedCashImpact": -1000,
      "signedReceivableImpact": 1000
    }
  }
}
```

Payloads must not include GL account IDs, posting-rule IDs, journal IDs, or
debit/credit instructions.
