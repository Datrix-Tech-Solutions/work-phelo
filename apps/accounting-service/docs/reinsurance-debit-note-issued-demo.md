# Accounting Demo: Reinsurance Debit Note Issued

This is a sprint-review helper for demonstrating the loop:

`Source Event -> Posting Rule -> Journal -> General Ledger`

It is not a production seed because tenant chart-of-account IDs differ.

## Posting Rule

Create active GL accounts first:

- `Cedant Premium Receivable`
- `Premium Clearing` or `Premium Income`

Then create a posting rule using the actual GL account IDs.

```json
{
  "name": "Reinsurance debit note issued",
  "sourceModule": "REINSURANCE",
  "sourceEventType": "DEBIT_NOTE_ISSUED",
  "version": 1,
  "active": true,
  "effectiveFrom": "2026-01-01T00:00:00.000Z",
  "lines": [
    {
      "sequence": 1,
      "direction": "DR",
      "glAccountId": "<cedant-premium-receivable-account-id>",
      "amountSource": "amounts.netPremium",
      "currencySource": "currency",
      "descriptionTemplate": "Debit note receivable {{sourceDocumentId}} for {{payload.policyNumber}}"
    },
    {
      "sequence": 2,
      "direction": "CR",
      "glAccountId": "<premium-clearing-or-income-account-id>",
      "amountSource": "amounts.netPremium",
      "currencySource": "currency",
      "descriptionTemplate": "Premium recognized from debit note {{sourceDocumentId}}"
    }
  ]
}
```

## Internal Source Event

Trusted services enqueue events through `POST /internal/source-events`.

```json
{
  "tenantId": "<tenant-id>",
  "sourceModule": "REINSURANCE",
  "sourceEventType": "DEBIT_NOTE_ISSUED",
  "sourceRecordId": "<placement-note-id>",
  "sourceDocumentId": "<debit-note-number-or-document-id>",
  "idempotencyKey": "reinsurance:debit-note:<placement-note-id>:issued:v1",
  "occurredAt": "2026-07-09T10:00:00.000Z",
  "currency": "GHS",
  "payload": {
    "amounts": {
      "netPremium": 12500
    },
    "policyNumber": "POL-2026-001",
    "cedant": {
      "id": "cedant-uuid",
      "name": "Example Cedant"
    }
  }
}
```

## Demo Processing

Process one event:

```http
POST /api/v1/accounting/source-events/:eventId/process
```

Process pending events:

```http
POST /api/v1/accounting/source-events/process-pending?sourceModule=REINSURANCE&sourceEventType=DEBIT_NOTE_ISSUED&limit=25
```
