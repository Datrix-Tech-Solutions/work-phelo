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

Before testing:

1. Accounting module is enabled for the tenant.
2. Reinsurance module is enabled for the tenant.
3. `ACCOUNTING_SERVICE_URL` is configured in Reinsurance.
4. `INTERNAL_SERVICE_AUTH_SECRET` matches between Reinsurance and Accounting.
5. Accounting allows `reinsurance-service` in `INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES`.
6. Accounting tenant config exists.
7. Fiscal period for the debit note issue date is `OPEN`.
8. Cedant subledger has been synced from Reinsurance.
9. Active posting rule exists for `REINSURANCE + DEBIT_NOTE_ISSUED`.

## Posting Rule Shape

The recommended first rule posts the debit note net premium:

| Line | Direction | Account                            | Subledger                       | Amount source        |
| ---- | --------- | ---------------------------------- | ------------------------------- | -------------------- |
| 1    | DR        | Cedant Premium Receivable          | `CEDANT` from `counterparty.id` | `amounts.netPremium` |
| 2    | CR        | Premium Clearing or Premium Income | None                            | `amounts.netPremium` |

Exact GL accounts are tenant policy and remain Accounting-owned.

## UAT Scenarios

| Scenario                            | Action                                                                                              | Expected Accounting Result                                                                                                 | Expected Journal Result                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Issue placement debit note          | In Reinsurance, create a placement, confirm closing(s), generate a draft debit note, then issue it. | One Reinsurance outbox row is created for `DEBIT_NOTE_ISSUED`, then delivered to Accounting as one `SourceEventInbox` row. | Processing the source event creates one posted journal with balanced debit/credit lines. |
| Duplicate issue request             | Re-submit the same issue action or retry the same outbox delivery.                                  | No duplicate source event is created because idempotency key is stable: `reinsurance:debit-note:<noteId>:issued:v1`.       | No duplicate journal is created for the same Accounting source event.                    |
| Missing posting rule                | Remove/deactivate the posting rule, then process the source event.                                  | Source event remains auditable and becomes `FAILED` with a posting-rule failure reason.                                    | No journal is created.                                                                   |
| Missing Cedant subledger            | Use an unsynced Cedant and process the source event.                                                | Source event becomes `FAILED` with an active Cedant subledger failure reason.                                              | No journal is created.                                                                   |
| Closed fiscal period                | Close/lock the fiscal period for the note issue date, then process.                                 | Source event becomes `FAILED` with fiscal-period failure reason.                                                           | No journal is created.                                                                   |
| Accounting unavailable during issue | Stop Accounting or remove Reinsurance Accounting config, then issue the debit note.                 | Debit note still issues. Reinsurance logs that Accounting event preparation was skipped.                                   | No journal is created until support explicitly reconciles/backfills later.               |

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
