# Reinsurance Accounting UAT: CREDIT_NOTE_ISSUED

Status: Draft 1

Parent standards:

- `docs/workphelo-financial-integration-standard-v1.md`
- `docs/workphelo-reinsurance-accounting-integration-spec-v1.md`

## Scope

This UAT guide covers only:

```text
REINSURANCE + CREDIT_NOTE_ISSUED
```

It applies to placement-level credit notes only. It does not cover endorsement
notes, note voiding, reinsurer disbursements, claims, recoveries or settlements.

## Recognition Boundary

`CREDIT_NOTE_ISSUED` is recognized when a placement `PlacementNote` transitions
from `DRAFT` to `ISSUED` with:

- `type = CREDIT_NOTE`
- `direction = BROKER_TO_REINSURER`
- `issuedAt` populated
- immutable note snapshot amounts available

Draft credit-note creation, placement closing confirmation, payments, UI
previews and document rendering do not publish this event.

## Source Record

The source record is the issued `PlacementNote.id`.

The event uses:

```text
sourceRecordType = PlacementNote
sourceRecordId = <credit-note-id>
sourceDocumentId = <credit-note-id>
idempotencyKey = reinsurance:credit-note:<credit-note-id>:issued:v1
occurredAt = PlacementNote.issuedAt
currency = PlacementNote.currency
```

## Counterparty Semantics

Placement credit notes are addressed to a Reinsurer:

```text
counterparty.type = REINSURER
counterparty.subledgerExternalRef = Reinsurance Counterparty.id
```

Accounting posting rules that use a subledger should resolve a `REINSURER`
subledger from `payload.counterparty.id`. Missing subledger setup must fail
inside Accounting processing without removing the Reinsurance outbox event.

## Amount And Sign Semantics

Reinsurance stores placement credit-note values as positive source-note
magnitudes. The payload therefore exposes positive display amounts and explicit
signed impact facts:

```json
{
  "amounts": {
    "grossPremium": 4500,
    "commission": 450,
    "brokerage": 337.5,
    "charges": 0,
    "netAmount": 3712.5,
    "creditMagnitude": 3712.5,
    "signedReceivableImpact": 0,
    "signedPayableImpact": 3712.5
  }
}
```

The exact GL treatment remains Accounting-owned. Reinsurance does not send GL
account IDs, debit/credit journal instructions or posting-rule IDs.

## Posting Policy Status

Finance must decide whether `CREDIT_NOTE_ISSUED` means:

- reduction of a Cedant receivable,
- creation of a Reinsurer payable,
- posting to an interim clearing liability, or
- another tenant-defined treatment.

The engineering implementation supports tenant-configured posting rules; it
does not hardcode any one policy.

## Example Posting Rule Shape

One possible tenant-configured policy is:

| Line | Direction | Conceptual account        | Subledger                          | Amount source             |
| ---- | --------- | ------------------------- | ---------------------------------- | ------------------------- |
| 1    | DR        | Premium clearing          | None                               | `amounts.creditMagnitude` |
| 2    | CR        | Reinsurer premium payable | `REINSURER` from `counterparty.id` | `amounts.creditMagnitude` |

This is an example only. Exact GL accounts remain tenant policy.

## UAT Scenarios

| Scenario                    | Action                                                                                              | Expected Accounting Result                                                                                                  | Expected Journal Result                                                             |
| --------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Issue placement credit note | Create a confirmed placement closing, generate a draft credit note, then issue it.                  | One Reinsurance outbox row is created for `CREDIT_NOTE_ISSUED`, then delivered to Accounting as one `SourceEventInbox` row. | Processing creates one posted balanced journal using the tenant posting rule.       |
| Accounting disabled         | Disable Accounting for the tenant, then issue the credit note.                                      | Credit note issues. No Reinsurance outbox row is created in Phase 1.                                                        | No Accounting source event or journal is expected.                                  |
| Temporary Accounting outage | Stop Accounting service after issuing the note, then run dispatcher.                                | Outbox row remains durable. Dispatcher records retry diagnostics.                                                           | No journal is created until Accounting recovers and the event is delivered.         |
| Missing Accounting URL      | Remove `ACCOUNTING_SERVICE_URL`, issue the note, then run dispatcher.                               | Outbox row remains durable with clear configuration diagnostics.                                                            | No journal is created until configuration is fixed.                                 |
| Authentication failure      | Misconfigure HMAC secret, issue the note, then run dispatcher.                                      | Outbox row remains durable with auth diagnostics.                                                                           | No journal is created until service auth is fixed.                                  |
| Missing posting rule        | Deliver/process without an active `REINSURANCE + CREDIT_NOTE_ISSUED` posting rule.                  | Accounting `SourceEventInbox` becomes `FAILED` with posting-rule reason.                                                    | No partial journal is created.                                                      |
| Missing Reinsurer subledger | Process with a rule requiring `REINSURER` subledger before syncing the Reinsurer.                   | Accounting `SourceEventInbox` becomes `FAILED` with active subledger reason.                                                | No partial journal is created.                                                      |
| Closed fiscal period        | Close/lock the fiscal period for `issuedAt`, then process.                                          | Accounting `SourceEventInbox` becomes `FAILED` with fiscal-period reason.                                                   | No partial journal is created.                                                      |
| Duplicate issue or delivery | Retry issue or dispatcher delivery.                                                                 | Deterministic idempotency prevents duplicate outbox/inbox records.                                                          | No duplicate journal is created.                                                    |
| Reconciliation dry run      | Call reconciliation with `dryRun=true` for an issued credit note missing its outbox row.            | Response reports missing `CREDIT_NOTE_ISSUED` rows only.                                                                    | No journal is created by dry run.                                                   |
| Reconciliation enqueue      | Call reconciliation with `dryRun=false` for a missing issued credit-note event.                     | Missing outbox row is created with original `issuedAt` and deterministic idempotency key.                                   | Journal is created only after dispatcher delivery and Accounting source processing. |
| Forward traceability        | Start at Reinsurance placement and follow note/outbox/inbox/journal.                                | Every layer carries source module, event type, source record and idempotency key.                                           | Journal can be explained from the source credit note.                               |
| Reverse traceability        | Start at Accounting journal and trace to SourceEventInbox, outbox, credit note, closing, placement. | Support can identify placement reference, note number, closing and Reinsurer counterparty.                                  | No mutable placement recalculation is required.                                     |

## Reconciliation Endpoint

Dry run:

```http
POST /api/v1/operations/reinsurance/accounting-integration/reconciliation/credit-note-issued?dryRun=true&limit=50
```

Explicit enqueue:

```http
POST /api/v1/operations/reinsurance/accounting-integration/reconciliation/credit-note-issued?dryRun=false&limit=50
```

The operation is tenant scoped and targets only:

- `PlacementNote.type = CREDIT_NOTE`
- `PlacementNote.direction = BROKER_TO_REINSURER`
- `PlacementNote.status = ISSUED`
- `issuedAt IS NOT NULL`
- missing outbox idempotency key `reinsurance:credit-note:<noteId>:issued:v1`

It does not replay endorsement notes, note voiding, payments, claims,
recoveries, settlements or arbitrary historical records.

## Expected Payload Markers

```json
{
  "sourceModule": "REINSURANCE",
  "sourceEventType": "CREDIT_NOTE_ISSUED",
  "sourceRecordId": "<placement-note-id>",
  "sourceDocumentId": "<placement-note-id>",
  "payload": {
    "references": {
      "placementId": "<placement-id>",
      "placementReference": "<placement-reference>",
      "closingId": "<placement-closing-id>",
      "noteId": "<placement-note-id>",
      "noteNumber": "<credit-note-number>"
    },
    "counterparty": {
      "id": "<reinsurer-id>",
      "type": "REINSURER"
    },
    "amounts": {
      "creditMagnitude": 3712.5,
      "signedReceivableImpact": 0,
      "signedPayableImpact": 3712.5
    }
  }
}
```

Payloads must not include GL account IDs, posting-rule IDs, journal IDs or
debit/credit instructions.
