# Endorsement Note Accounting UAT

Status: Draft 1

Scope: Phase 1 Accounting source-event capture for issued Reinsurance
endorsement debit and credit notes.

## Preconditions

- Tenant has Accounting enabled in module configuration.
- Accounting service is configured for source-event ingestion.
- Cedant and Reinsurer counterparties have Accounting subledger readiness where
  tenant posting rules require subledgers.
- Tenant posting rules exist for:
  - `REINSURANCE + ENDORSEMENT_DEBIT_NOTE_ISSUED`
  - `REINSURANCE + ENDORSEMENT_CREDIT_NOTE_ISSUED`

## Recognition Boundaries

| Event                            | Boundary                                                    | Non-Boundaries                                                                                    |
| -------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `ENDORSEMENT_DEBIT_NOTE_ISSUED`  | `PlacementNote` of type `ENDORSEMENT_DEBIT_NOTE` is issued  | Endorsement creation, submission, participant response, closing confirmation, draft note creation |
| `ENDORSEMENT_CREDIT_NOTE_ISSUED` | `PlacementNote` of type `ENDORSEMENT_CREDIT_NOTE` is issued | Endorsement creation, submission, participant response, closing confirmation, draft note creation |

## Source Records

- Source record: `PlacementNote.id`
- Source document: `PlacementNote.id`
- Business date: `PlacementNote.issuedAt`
- Endorsement link: `PlacementNote.endorsementId`
- Credit note closing link: `PlacementNote.endorsementClosingId`

## Classification Rules

| Event                            | Required Note Type        | Direction             | Counterparty | Association                                         |
| -------------------------------- | ------------------------- | --------------------- | ------------ | --------------------------------------------------- |
| `ENDORSEMENT_DEBIT_NOTE_ISSUED`  | `ENDORSEMENT_DEBIT_NOTE`  | `CEDANT_TO_BROKER`    | Cedant       | `endorsementId` required                            |
| `ENDORSEMENT_CREDIT_NOTE_ISSUED` | `ENDORSEMENT_CREDIT_NOTE` | `BROKER_TO_REINSURER` | Reinsurer    | `endorsementId` and `endorsementClosingId` required |

Normal placement notes must not be classified as endorsement events.

## Amount And Sign Semantics

Endorsement debit notes publish additional-premium facts:

- magnitude fields are positive where generated from the issued note snapshot.
- `signedReceivableImpact` is positive.
- `signedPayableImpact` is zero.

Endorsement credit notes publish return-premium facts:

- raw signed source values are preserved where available.
- magnitude fields are positive for posting-rule extraction.
- `signedReceivableImpact` is zero in the current Reinsurance event contract.
- `signedPayableImpact` is positive and equals the return premium magnitude.

Accounting owns exact GL treatment through tenant posting rules.

## Conceptual Accounting Treatment

| Event                            | Conceptual Effect                                                                      | Finance Policy                                 |
| -------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------- |
| `ENDORSEMENT_DEBIT_NOTE_ISSUED`  | Additional cedant receivable against premium clearing/income                           | Pending Finance confirmation per tenant policy |
| `ENDORSEMENT_CREDIT_NOTE_ISSUED` | Return premium adjustment, reinsurer payable, contra-receivable, or clearing treatment | Pending Finance confirmation per tenant policy |

## Happy Path

1. Create and validate an endorsement using backend truth.
2. Generate the required endorsement debit or credit note.
3. Issue the draft endorsement note.
4. Verify a `ReinsuranceAccountingOutbox` row exists with the deterministic
   idempotency key.
5. Dispatch pending outbox rows.
6. Verify Accounting `SourceEventInbox` receives the event.
7. Process the source event.
8. Verify the journal is posted from tenant posting rules.

## Disabled And Outage Behavior

- If Accounting is disabled, issuing the endorsement note succeeds and no outbox
  row is created.
- If Accounting is enabled, note issuance and outbox capture commit atomically.
- Delivery URL, HMAC, posting-rule, subledger or fiscal-period failures must not
  prevent source capture once the note issuance transaction commits.
- Failed delivery or processing remains retryable and auditable.

## Reconciliation

Dry-run:

```text
POST /api/v1/operations/reinsurance/accounting-integration/reconciliation/endorsement-debit-note-issued?dryRun=true
POST /api/v1/operations/reinsurance/accounting-integration/reconciliation/endorsement-credit-note-issued?dryRun=true
```

Enqueue:

```text
POST /api/v1/operations/reinsurance/accounting-integration/reconciliation/endorsement-debit-note-issued?dryRun=false
POST /api/v1/operations/reinsurance/accounting-integration/reconciliation/endorsement-credit-note-issued?dryRun=false
```

Reconciliation must be tenant scoped, duplicate safe, and must preserve original
`issuedAt` as the event business date.

## Traceability

Forward:

```text
Placement
-> PlacementEndorsement
-> PlacementEndorsementClosing where applicable
-> PlacementNote
-> ReinsuranceAccountingOutbox
-> Accounting SourceEventInbox
-> JournalEntry
-> JournalLines
```

Reverse:

```text
JournalEntry
-> SourceEventInbox.sourceRecordId
-> PlacementNote
-> PlacementEndorsementClosing where applicable
-> PlacementEndorsement
-> Placement
```

## Negative Tests

- Draft endorsement notes emit no event.
- Non-endorsement placement notes emit no endorsement event.
- Wrong direction, wrong counterparty type, or missing endorsement association
  must fail event construction.
- Missing posting rule fails Accounting processing with no journal.
- Missing subledger fails Accounting processing with no journal.
- Closed fiscal period fails Accounting processing with no journal.
- Duplicate issue/reconciliation/delivery must not create duplicate events or
  duplicate journals.
