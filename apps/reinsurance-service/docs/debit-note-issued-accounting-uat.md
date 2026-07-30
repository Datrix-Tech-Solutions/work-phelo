# Reinsurance Accounting UAT: DEBIT_NOTE_ISSUED

Status: Draft 1

Parent standards:

- `docs/workphelo-financial-integration-standard-v1.md`
- `docs/workphelo-reinsurance-accounting-integration-spec-v1.md`

## Scope

This UAT guide covers only the first activated Reinsurance financial event:

```text
REINSURANCE + DEBIT_NOTE_ISSUED
```

It does not cover payments, reversals, claims, recoveries, endorsements, or
settlements.

## Preconditions

Before full delivery/posting testing:

1. Accounting module is enabled for the tenant.
2. Reinsurance module is enabled for the tenant.
3. `ACCOUNTING_SERVICE_URL` is configured in Reinsurance.
4. `INTERNAL_SERVICE_AUTH_SECRET` matches between Reinsurance and Accounting.
5. Accounting allows `reinsurance-service` in `INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES`.
6. Accounting tenant config exists.
7. Fiscal period for the debit note issue date is `OPEN`.
8. Cedant subledger has been synced from Reinsurance.
9. Active posting rule exists for `REINSURANCE + DEBIT_NOTE_ISSUED`.

For capture-only outage tests, Accounting must be enabled for the tenant but
delivery configuration or service availability may intentionally be broken.

## Posting Rule Shape

The recommended first rule posts the debit note net premium:

| Line | Direction | Account                            | Subledger                       | Amount source        |
| ---- | --------- | ---------------------------------- | ------------------------------- | -------------------- |
| 1    | DR        | Cedant Premium Receivable          | `CEDANT` from `counterparty.id` | `amounts.netPremium` |
| 2    | CR        | Premium Clearing or Premium Income | None                            | `amounts.netPremium` |

Exact GL accounts are tenant policy and remain Accounting-owned.

## UAT Scenarios

| Scenario                         | Action                                                                                                              | Expected Accounting Result                                                                                                              | Expected Journal Result                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Issue placement debit note       | In Reinsurance, create a placement, confirm closing(s), generate a draft debit note, then issue it.                 | One Reinsurance outbox row is created for `DEBIT_NOTE_ISSUED`, then delivered to Accounting as one `SourceEventInbox` row.              | Processing the source event creates one posted journal with balanced debit/credit lines.     |
| Accounting disabled              | Disable Accounting for the tenant, then issue a debit note.                                                         | Debit note issues. No Reinsurance outbox row is created in Phase 1.                                                                     | No Accounting source event or journal is expected.                                           |
| Temporary Accounting outage      | Ensure Accounting is enabled, stop Accounting service, then issue the debit note. Run the outbox dispatcher.        | Debit note issues. One Reinsurance outbox row exists. Dispatcher marks it `FAILED` with retry metadata while Accounting is unavailable. | No journal is created until Accounting recovers and the same outbox event is delivered.      |
| Missing Accounting URL           | Ensure Accounting is enabled, remove `ACCOUNTING_SERVICE_URL`, issue a debit note, then run dispatcher.             | Debit note issues. One outbox row exists. Dispatcher stores `ACCOUNTING_SERVICE_URL is not configured` and does not hot-loop.           | No journal is created until configuration is fixed and the same outbox row is retried.       |
| HMAC misconfiguration            | Ensure Accounting is enabled, misconfigure `INTERNAL_SERVICE_AUTH_SECRET`, issue a debit note, then run dispatcher. | Debit note issues. One outbox row exists. Dispatcher stores a clear auth/config failure.                                                | No journal is created until the secret is fixed and the same outbox row is retried.          |
| Recovery after outage/config fix | Restore Accounting/configuration and run dispatcher for the failed outbox row.                                      | Same event is delivered. One Accounting `SourceEventInbox` row exists. Duplicate delivery returns the same event.                       | One posted journal is created after source-event processing. No manual backfill is required. |
| Duplicate issue request          | Re-submit the same issue action or retry the same outbox delivery.                                                  | No duplicate source event is created because idempotency key is stable: `reinsurance:debit-note:<noteId>:issued:v1`.                    | No duplicate journal is created for the same Accounting source event.                        |
| Missing posting rule             | Remove/deactivate the posting rule, deliver/process the source event.                                               | Accounting `SourceEventInbox` accepts the source event and marks processing `FAILED` with a posting-rule failure reason.                | No journal is created.                                                                       |
| Missing Cedant subledger         | Use an unsynced Cedant and deliver/process the source event.                                                        | Accounting `SourceEventInbox` accepts the source event and marks processing `FAILED` with an active Cedant subledger failure reason.    | No journal is created.                                                                       |
| Closed fiscal period             | Close/lock the fiscal period for the note issue date, then process.                                                 | Source event becomes `FAILED` with fiscal-period failure reason.                                                                        | No journal is created.                                                                       |
| Reconciliation dry run           | Call reconciliation with `dryRun=true` for an issued debit note missing its outbox event.                           | Response lists only missing `DEBIT_NOTE_ISSUED` rows and does not enqueue.                                                              | No journal is created by dry run.                                                            |
| Reconciliation enqueue           | Call reconciliation with `dryRun=false` for a missing issued debit note event.                                      | A Reinsurance outbox row is created using the original deterministic idempotency key and issued date.                                   | Journal is created only after delivery and Accounting source-event processing.               |

## Reconciliation Path

Support should trace a posted debit note in this order:

1. Reinsurance placement reference.
2. Reinsurance `PlacementNote`:
   - `id`
   - `noteNumber`
   - `status = ISSUED`
   - `issuedAt`
   - `counterpartyId`
   - `netAmount`
3. Reinsurance `ReinsuranceAccountingOutbox`:
   - `sourceEventType = DEBIT_NOTE_ISSUED`
   - `sourceRecordType = PlacementNote`
   - `sourceRecordId = <PlacementNote.id>`
   - `idempotencyKey = reinsurance:debit-note:<PlacementNote.id>:issued:v1`
   - `accountingSourceEventId`
4. Accounting `SourceEventInbox`:
   - `id = <accountingSourceEventId>`
   - `sourceModule = REINSURANCE`
   - `sourceEventType = DEBIT_NOTE_ISSUED`
   - `sourceRecordId = <PlacementNote.id>`
   - `journalEntryId`
5. Accounting `JournalEntry` and `JournalLine` records:
   - `sourceModule = REINSURANCE`
   - `sourceRecordType = DEBIT_NOTE_ISSUED`
   - `sourceRecordId = <PlacementNote.id>`

The reverse trace should also work from Accounting journal back to the
Reinsurance placement note using `sourceRecordId`.

## Reconciliation Endpoint

Dry run:

```http
POST /api/v1/operations/reinsurance/accounting-integration/reconciliation/debit-note-issued?dryRun=true&limit=50
```

Explicit enqueue:

```http
POST /api/v1/operations/reinsurance/accounting-integration/reconciliation/debit-note-issued?dryRun=false&limit=50
```

The operation is tenant scoped and targets only:

- `PlacementNote.type = DEBIT_NOTE`
- `PlacementNote.status = ISSUED`
- `issuedAt IS NOT NULL`
- missing outbox idempotency key `reinsurance:debit-note:<noteId>:issued:v1`

It does not replay payments, claims, endorsements, recoveries, settlements or
arbitrary historical records.

## Expected Payload Markers

The delivered Accounting event should contain:

```json
{
  "sourceModule": "REINSURANCE",
  "sourceEventType": "DEBIT_NOTE_ISSUED",
  "sourceRecordId": "<placement-note-id>",
  "sourceDocumentId": "<placement-note-id>",
  "payload": {
    "references": {
      "placementId": "<placement-id>",
      "placementReference": "<placement-reference>",
      "noteId": "<placement-note-id>",
      "noteNumber": "<debit-note-number>"
    },
    "counterparty": {
      "id": "<cedant-id>",
      "type": "CEDANT"
    },
    "amounts": {
      "netPremium": 12750
    }
  }
}
```

Payloads must not include GL account IDs, posting-rule IDs, journal IDs, or
debit/credit instructions.
