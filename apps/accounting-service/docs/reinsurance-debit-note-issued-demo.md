# Accounting Demo: Reinsurance Debit Note Issued

This is a sprint-review helper for demonstrating the loop:

`Source Event -> Posting Rule -> Journal -> General Ledger`

It is not a production seed because tenant chart-of-account IDs differ.

## Posting Rule

Create active GL accounts first:

- `Cedant Premium Receivable`
- `Premium Clearing` or `Premium Income`

Then create a posting rule using the actual tenant GL account IDs.
The debit line may use the Cedant subledger by resolving the Reinsurance
`Counterparty.id` from `counterparty.id`.

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
      "subledgerType": "CEDANT",
      "subledgerExternalRefSource": "counterparty.id",
      "amountSource": "amounts.netPremium",
      "currencySource": "currency",
      "descriptionTemplate": "Debit note {{payload.references.noteNumber}} receivable for {{payload.references.placementReference}}"
    },
    {
      "sequence": 2,
      "direction": "CR",
      "glAccountId": "<premium-clearing-or-income-account-id>",
      "amountSource": "amounts.netPremium",
      "currencySource": "currency",
      "descriptionTemplate": "Premium recognized from debit note {{payload.references.noteNumber}}"
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
    "transactionDate": "2026-07-09T10:00:00.000Z",
    "currency": "GHS",
    "references": {
      "placementId": "placement-uuid",
      "placementReference": "FAC-2026-001",
      "policyNumber": "POL-2026-001",
      "noteId": "placement-note-uuid",
      "noteNumber": "DN-001"
    },
    "counterparty": {
      "id": "cedant-uuid",
      "type": "CEDANT",
      "name": "Example Cedant",
      "subledgerExternalRef": "cedant-uuid"
    },
    "amounts": {
      "grossPremium": 15000,
      "commissionAmount": 1500,
      "brokerageAmount": 750,
      "netPremium": 12750
    },
    "documents": {
      "placementNoteId": "placement-note-uuid",
      "placementNoteNumber": "DN-001",
      "sourceDocumentId": "placement-note-uuid"
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
