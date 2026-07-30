# Reinsurance Settlement Architecture Audit v1

Status: Draft 1

Scope: Reinsurer settlement and disbursement events for Reinsurance to Accounting under WFIS v1.

Related standards:

- [WorkPhelo Financial Integration Standard v1.0](../workphelo-financial-integration-standard-v1.md)
- [WorkPhelo Reinsurance Accounting Integration Specification v1.0](../workphelo-reinsurance-accounting-integration-spec-v1.md)
- [Reinsurance Financial Event Catalogue v1](./reinsurance-financial-event-catalogue-v1.md)
- [Reinsurance Posting Policy Register v1](./reinsurance-posting-policy-register-v1.md)
- [Reinsurance Settlement Policy Decision Register v1](./reinsurance-settlement-policy-decision-register-v1.md)

## 1. Purpose

This audit documents the current Reinsurance settlement architecture before activating:

- `REINSURER_DISBURSEMENT_RECORDED`
- `REINSURER_DISBURSEMENT_REVERSED`

The original audit was documentation-only. The 2026-07-30 addendum below records the minimum domain-readiness changes required after Finance/Product approved the settlement policy.

## 2. Executive Verdict

The Reinsurance domain already supports operational capture of reinsurer disbursements through `PlacementPayment` records with:

- `type = REINSURER_DISBURSEMENT`
- `direction = OUTBOUND`
- `status = RECORDED`
- exactly one closing source, either `closingId` or `endorsementClosingId`
- tenant-scoped counterparty validation
- confirmed closing validation
- placement-currency validation
- overpayment prevention against current effective financial position
- immutable reversal through a linked reversal `PlacementPayment`

However, `REINSURER_DISBURSEMENT_RECORDED` is not ready for broad accounting activation until the Reinsurance domain can represent the approved allocation, bank-confirmation, FX, bank-charge and withholding facts.

The narrow technical event is implementable, but event activation must wait until those domain facts are persisted and validated.

### 2.1 Post-Approval Domain Readiness Addendum - 2026-07-30

Finance/Product approved a richer settlement model than the original narrow single-closing event:

- payable recognition comes from issued Credit Notes and Endorsement Credit Notes;
- payment clears existing payable balances;
- bank confirmation or successful payment completion is the recognition boundary;
- one payment may settle many Credit Notes;
- one Credit Note may receive many payments;
- overpayments are allowed and corrected through Journal Voucher or approved accounting correction;
- unallocated payments are not allowed;
- cross-currency payment is allowed only with a persisted agreed exchange rate;
- bank charges and withholding tax must be captured on the transaction;
- failed and cancelled payments do not emit accounting.

Therefore, the next implementation milestone MUST add the minimum settlement domain foundation before activating `REINSURER_DISBURSEMENT_RECORDED`. The prior single-closing/same-currency findings remain useful historical audit context, but they are no longer sufficient for the approved policy.

## 3. Source Review

| Area                 | Files or Records Reviewed                                                                         | Finding                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Payment schema       | `PlacementPayment`, `PlacementPaymentType`, `PlacementPaymentDirection`, `PlacementPaymentStatus` | Disbursement and reversal records exist. Status model is only `RECORDED` and `REVERSED`.                                    |
| Closing schema       | `PlacementClosing`, `PlacementEndorsementClosing`                                                 | Original and endorsement closings expose confirmed snapshot values and payment relations.                                   |
| Note schema          | `PlacementNote.settledByPaymentId`                                                                | A note-to-payment relation exists, but no settlement service path actively uses it for allocation.                          |
| Payment API          | `GET/POST /placements/:id/payments`, `POST /placements/:id/payments/:paymentId/reverse`           | Generic payment recording supports premium receipts and reinsurer disbursements; claim settlement is rejected.              |
| Payment service      | `PlacementPaymentsService`                                                                        | Reinsurer disbursement validation exists, but only premium payment events are currently enqueued to Accounting.             |
| Financial position   | `PlacementFinancialPositionService`                                                               | Reinsurer outstanding is calculated from confirmed effective closing obligations minus recorded non-reversed disbursements. |
| Accounting publisher | `ReinsuranceFinancialEventPublisher`                                                              | `PREMIUM_PAYMENT_RECEIVED` and `PAYMENT_REVERSED` are active. No reinsurer disbursement event builder exists yet.           |
| Outbox               | `ReinsuranceAccountingOutboxService`                                                              | Existing durable outbox, idempotency, retry and delivery semantics can be reused.                                           |

## 4. Current Domain Model

### 4.1 PlacementPayment

`PlacementPayment` is the current operational settlement record.

| Field                  | Meaning for settlement                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `tenantId`             | Tenant isolation key.                                                                                 |
| `placementId`          | Owning placement.                                                                                     |
| `closingId`            | Original placement closing settled by a reinsurer disbursement.                                       |
| `endorsementClosingId` | Endorsement closing settled by a reinsurer disbursement.                                              |
| `participantId`        | Required for original placement closing disbursement.                                                 |
| `counterpartyId`       | Reinsurer or Cedant counterparty depending on payment type.                                           |
| `type`                 | `PREMIUM_RECEIVED`, `REINSURER_DISBURSEMENT`, or `CLAIM_SETTLEMENT`.                                  |
| `direction`            | `INBOUND` or `OUTBOUND`.                                                                              |
| `amount`               | Stored as decimal transaction amount. Original payment rows are positive; reversal rows are negative. |
| `currency`             | Transaction currency. Current service requires placement currency.                                    |
| `paymentDate`          | Business date candidate for accounting `occurredAt`.                                                  |
| `reference`            | Payment or bank reference text.                                                                       |
| `notes`                | Operational notes.                                                                                    |
| `status`               | `RECORDED` or `REVERSED`.                                                                             |
| `reversalOfPaymentId`  | Links a reversal row to the original payment.                                                         |
| `createdByUserId`      | Actor who recorded payment or reversal.                                                               |

### 4.2 PlacementClosing

Original placement closings are eligible for settlement only when:

- `status = CONFIRMED`
- `tenantId` and `placementId` match the payment
- `participantId` matches the supplied original participant
- `participant.counterpartyId` matches the reinsurer counterparty
- `currency` matches payment currency

The service uses `netPremium` as the original closing payable cap and also checks the current effective reinsurer outstanding.

### 4.3 PlacementEndorsementClosing

Endorsement closings are eligible for settlement only when:

- `status = CONFIRMED`
- owning endorsement is `CLOSED`
- endorsement `effectiveDate <= paymentDate`
- tenant and placement match
- endorsement participant counterparty matches the reinsurer counterparty
- closing currency matches payment currency

Endorsement-closing disbursements must omit `participantId`.

### 4.4 PlacementNote

`PlacementNote` has `settledByPaymentId`, and `PlacementPayment` has a `settledNotes` relation.

Current audit finding:

- The relation exists at schema/DTO level.
- The generic payment recording service does not set `settledByPaymentId`.
- No allocation amount or note-payment join table exists.
- Therefore, note-level settlement is not yet an active source of truth.

Accounting event payloads MUST NOT claim that a credit note or endorsement credit note was settled unless a future workflow explicitly records that relationship.

## 5. Actual Lifecycle Inventory

| Lifecycle Step                | Entity                             | Route or Method                                               | Actor                              | Transaction                                                     | Mutability                                      | Audit Trail                                                | Financial Fact or Intent                                   |
| ----------------------------- | ---------------------------------- | ------------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------- |
| List payments                 | `PlacementPayment`                 | `GET /placements/:id/payments`                                | Broker/user with view permission   | Read only                                                       | Immutable read                                  | Payment rows only                                          | Historical fact display                                    |
| Record premium receipt        | `PlacementPayment`                 | `POST /placements/:id/payments` with `PREMIUM_RECEIVED`       | Broker/user with create permission | Creates payment and outbox row when Accounting enabled          | New row only                                    | Row metadata plus outbox                                   | Financial fact                                             |
| Record reinsurer disbursement | `PlacementPayment`                 | `POST /placements/:id/payments` with `REINSURER_DISBURSEMENT` | Broker/user with create permission | Creates payment row only                                        | New row only                                    | Row metadata                                               | Financial fact operationally, not yet Accounting-published |
| Reverse payment               | `PlacementPayment`                 | `POST /placements/:id/payments/:paymentId/reverse`            | Broker/user with edit permission   | Marks original `REVERSED`, creates linked negative reversal row | Original status changes; reversal row immutable | Row metadata plus premium reversal outbox for premium only | Reversal financial fact                                    |
| Calculate financial position  | Derived read model                 | `PlacementFinancialPositionService.getFinancialPosition`      | Backend services/UI                | Read transaction                                                | No mutation                                     | None                                                       | Backend projection                                         |
| Link note settlement          | `PlacementNote.settledByPaymentId` | No active service path found                                  | N/A                                | N/A                                                             | Not active                                      | N/A                                                        | Future or dormant relation                                 |

## 6. Supported Settlement Capabilities

| Capability                                        | Current Support                                       | Evidence and Constraints                                                                                                |
| ------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| One payment to one original closing               | Supported                                             | `closingId` plus `participantId` are required for original disbursement.                                                |
| One payment to one endorsement closing            | Supported                                             | `endorsementClosingId` is required and `participantId` must be omitted.                                                 |
| Multiple payments against one original closing    | Partially supported                                   | Multiple rows can reference the same closing/participant; overpayment check considers prior non-reversed original rows. |
| Multiple payments against one endorsement closing | Partially supported                                   | Multiple rows can reference the same endorsement closing; cap is current effective reinsurer outstanding.               |
| Partial payments                                  | Supported                                             | Service accepts amount below outstanding.                                                                               |
| Overpayment prevention                            | Supported                                             | Service rejects amount above outstanding effective reinsurer premium.                                                   |
| One payment allocated to many obligations         | Not supported                                         | No payment-allocation table or allocation amount exists.                                                                |
| One obligation allocated across many payments     | Supported for closing-level rows, not note-level rows | Closing relations allow multiple payment rows; note settlement relation is single payment FK with no allocation amount. |
| Credit-note-specific settlement                   | Not active                                            | `settledByPaymentId` exists but no service path sets it.                                                                |
| Unallocated or advance reinsurer payment          | Not supported                                         | Disbursement requires exactly one confirmed closing source.                                                             |
| Payment batch                                     | Not supported                                         | No batch model or batch reference.                                                                                      |
| Payment approval                                  | Not supported                                         | No approval status/actor fields beyond `createdByUserId`.                                                               |
| Bank confirmation                                 | Not supported                                         | `reference` exists, but no bank-confirmed status, bank account, statement line or confirmation date.                    |
| Failed/cancelled payment                          | Not supported                                         | Status enum does not include failed/cancelled.                                                                          |
| FX/bank-currency settlement                       | Not supported                                         | Service requires placement currency; no FX snapshot on payment.                                                         |
| Partial reversal                                  | Not supported                                         | Current reverse path creates a full negative reversal row for the original amount.                                      |

## 7. Current Financial Position Semantics

The financial position projection calculates reinsurer position as:

```text
currentEffectivePayable
minus recorded non-reversed REINSURER_DISBURSEMENT payments
= outstanding
```

For each reinsurer:

- `originalPayable` comes from confirmed original placement closing snapshots.
- `endorsementAdjustments` come from effective confirmed endorsement closing snapshots.
- disbursements are filtered by `type = REINSURER_DISBURSEMENT` and `counterpartyId`.
- original rows with `status = RECORDED` reduce outstanding.
- original rows with `status = REVERSED` are shown as reversed and do not reduce net settled.
- linked reversal rows are not included in net settled because they have `reversalOfPaymentId != null`.

This supports operational outstanding calculations, but it is not the same as Accounting recognition.

## 8. Candidate Recognition Boundary

### 8.1 REINSURER_DISBURSEMENT_RECORDED

Recommended candidate boundary:

```text
PlacementPayment row is created with:
type = REINSURER_DISBURSEMENT
direction = OUTBOUND
status = RECORDED
reversalOfPaymentId = null
amount > 0
paymentDate is valid
counterparty.type = REINSURER
exactly one of closingId or endorsementClosingId is present
the referenced closing is confirmed and payable under current effective-state rules
```

Candidate event identity:

```text
sourceModule = REINSURANCE
sourceEventType = REINSURER_DISBURSEMENT_RECORDED
sourceRecordType = PlacementPayment
sourceRecordId = <PlacementPayment.id>
sourceDocumentId = <PlacementPayment.id>
idempotencyKey = reinsurance:reinsurer-disbursement:<paymentId>:recorded:v1
occurredAt = PlacementPayment.paymentDate
currency = PlacementPayment.currency
```

Candidate amount semantics:

```json
{
  "amounts": {
    "paymentAmount": 1000,
    "signedCashImpact": -1000,
    "signedReinsurerPayableImpact": -1000
  }
}
```

This event SHOULD clear a previously recognized reinsurer payable if Finance confirms that credit-note or payable recognition already occurred before settlement.

### 8.2 REINSURER_DISBURSEMENT_REVERSED

Recommended candidate boundary:

```text
Linked reversal PlacementPayment row is created with:
type = REINSURER_DISBURSEMENT
direction = OUTBOUND
status = RECORDED
reversalOfPaymentId = <original disbursement payment id>
amount < 0
```

Candidate event identity:

```text
sourceModule = REINSURANCE
sourceEventType = REINSURER_DISBURSEMENT_REVERSED
sourceRecordType = PlacementPayment
sourceRecordId = <reversal PlacementPayment.id>
sourceDocumentId = <reversal PlacementPayment.id>
idempotencyKey = reinsurance:reinsurer-disbursement:<reversalPaymentId>:reversal:v1
occurredAt = reversal PlacementPayment.paymentDate
currency = reversal PlacementPayment.currency
```

Candidate amount semantics:

```json
{
  "amounts": {
    "paymentAmount": 1000,
    "originalPaymentAmount": 1000,
    "signedCashImpact": 1000,
    "signedReinsurerPayableImpact": 1000
  }
}
```

The reversal source record MUST be the reversal row, not the mutated original row.

## 9. Liability Recognition Boundary

Current code can identify when money was paid to a reinsurer. It does not by itself settle the Finance policy question of when the reinsurer payable was recognized.

| Policy                    | Payable Recognized At                                                             | Disbursement Event Effect                                      |
| ------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Credit-note payable model | `CREDIT_NOTE_ISSUED` or `ENDORSEMENT_CREDIT_NOTE_ISSUED`                          | Clear reinsurer payable against cash/bank.                     |
| Premium-clearing model    | Debit/endorsement debit note or closing confirmation creates a clearing liability | Clear clearing/payable against cash/bank.                      |
| Cash-only model           | No payable before payment                                                         | Record outbound cash and expense/clearing movement at payment. |

Recommended default:

Use disbursement events as cash settlement events that clear an already recognized reinsurer payable or clearing balance. Do not use the disbursement event to invent the payable recognition boundary.

Finance approval is required before activation.

## 10. Counterparty and Subledger Rules

Candidate disbursement payloads MUST identify the reinsurer counterparty:

```json
{
  "counterparty": {
    "id": "<reinsurer-counterparty-id>",
    "type": "REINSURER",
    "name": "<reinsurer name>",
    "registrationNumber": "<optional>",
    "subledgerExternalRef": "<reinsurer-counterparty-id>"
  }
}
```

Posting rules that require a subledger SHOULD resolve:

```text
subledgerType = REINSURER
externalRef = payload.counterparty.subledgerExternalRef
```

Missing or inactive subledger readiness should fail Accounting source-event processing, not mutate Reinsurance payment rows.

## 11. Currency and FX

Current settlement model is single-currency only.

Current behavior:

- `PlacementPayment.currency` must match `Placement.currency`.
- original closing currency must match payment currency.
- endorsement closing currency must match payment currency.
- multi-currency financial position blocks aggregation.
- no bank account currency, exchange rate, base amount, realized FX gain/loss, bank fee or withholding-at-payment model exists.

Therefore, `REINSURER_DISBURSEMENT_RECORDED` MUST NOT claim FX support in v1.

## 12. Candidate Payload Contract

### 12.1 Recorded disbursement

```json
{
  "transactionDate": "2026-07-30T10:00:00.000Z",
  "currency": "GHS",
  "references": {
    "placementId": "placement-id",
    "placementReference": "FAC-2026-001",
    "policyNumber": "POL-2026-001",
    "placementTitle": "Xpress Group",
    "paymentId": "payment-id",
    "closingId": "closing-id-if-original",
    "endorsementClosingId": "closing-id-if-endorsement",
    "participantId": "participant-id-if-original",
    "endorsementParticipantId": "endorsement-participant-id-if-endorsement",
    "closingNumber": "CLS-001",
    "endorsementId": "endorsement-id-if-any",
    "endorsementNumber": "END-001-if-any"
  },
  "counterparty": {
    "id": "reinsurer-counterparty-id",
    "type": "REINSURER",
    "name": "Example Reinsurer",
    "registrationNumber": null,
    "subledgerExternalRef": "reinsurer-counterparty-id"
  },
  "amounts": {
    "paymentAmount": 1000,
    "signedCashImpact": -1000,
    "signedReinsurerPayableImpact": -1000
  },
  "payment": {
    "id": "payment-id",
    "paymentDate": "2026-07-30T10:00:00.000Z",
    "paymentReference": "BANK-REF-001",
    "bankReference": "BANK-REF-001",
    "status": "RECORDED",
    "type": "REINSURER_DISBURSEMENT",
    "direction": "OUTBOUND",
    "isReversal": false,
    "reversalOfPaymentId": null,
    "notes": "Optional notes"
  },
  "allocation": {
    "model": "SINGLE_CLOSING",
    "noteAllocationSupported": false,
    "closingSourceType": "PLACEMENT_CLOSING",
    "allocationAmount": 1000
  },
  "documents": {
    "sourceDocumentId": "payment-id",
    "paymentReceiptDocumentId": null
  }
}
```

### 12.2 Reversed disbursement

```json
{
  "transactionDate": "2026-07-30T10:00:00.000Z",
  "currency": "GHS",
  "references": {
    "placementId": "placement-id",
    "paymentId": "reversal-payment-id",
    "originalPaymentId": "original-payment-id",
    "reversalPaymentId": "reversal-payment-id"
  },
  "counterparty": {
    "id": "reinsurer-counterparty-id",
    "type": "REINSURER",
    "subledgerExternalRef": "reinsurer-counterparty-id"
  },
  "amounts": {
    "paymentAmount": 1000,
    "originalPaymentAmount": 1000,
    "signedCashImpact": 1000,
    "signedReinsurerPayableImpact": 1000
  },
  "payment": {
    "id": "reversal-payment-id",
    "originalPaymentId": "original-payment-id",
    "isReversal": true,
    "status": "RECORDED",
    "type": "REINSURER_DISBURSEMENT",
    "direction": "OUTBOUND"
  }
}
```

## 13. Do-Not-Post Events

| Operational Activity         | Reason                                                            |
| ---------------------------- | ----------------------------------------------------------------- |
| Draft payment form opened    | No durable financial fact.                                        |
| Payment validation preview   | No durable financial fact.                                        |
| Payment approval requested   | Approval lifecycle does not exist yet.                            |
| Bank file generated          | Bank file lifecycle does not exist yet.                           |
| Bank reference edited        | Current payment model has no immutable bank-confirmed state.      |
| Failed/cancelled payment     | Statuses do not exist yet.                                        |
| Unallocated advance          | Current disbursement requires a confirmed closing source.         |
| Credit note issued by itself | Already covered by note issued event; not a cash settlement.      |
| Closing confirmed            | Payable policy is unresolved; do not treat settlement as closing. |

## 14. Reconciliation and Recovery

Future reconciliation should follow existing patterns:

```http
POST /api/v1/operations/reinsurance/accounting-integration/reconciliation/reinsurer-disbursement-recorded?dryRun=true&limit=50
POST /api/v1/operations/reinsurance/accounting-integration/reconciliation/reinsurer-disbursement-reversed?dryRun=true&limit=50
```

Candidate reconciliation rules:

- select only `PlacementPayment.type = REINSURER_DISBURSEMENT`
- recorded event targets original rows with `status = RECORDED` and `reversalOfPaymentId = null`
- reversal event targets reversal rows with `status = RECORDED` and `reversalOfPaymentId != null`
- preserve `PlacementPayment.paymentDate` as `occurredAt`
- dry run MUST report candidate count, skipped reasons and expected idempotency keys
- non-dry run MUST enqueue outbox rows idempotently
- reconciliation MUST NOT change payment, note, closing or endorsement records

## 15. Traceability Requirements

Future event payloads SHOULD allow support to trace:

- Accounting source event to Reinsurance outbox row
- outbox row to `PlacementPayment`
- payment to placement
- payment to original or endorsement closing
- closing to participant or endorsement participant
- counterparty to Accounting subledger
- reversal payment to original payment
- posted journal back to source event

The current model can support this for single-closing settlement. It cannot support allocation-level traceability for one payment spread across multiple notes or closings.

## 16. Failure and Correction Model

Failure handling should follow WFIS:

- Reinsurance payment creation MUST remain independent of Accounting reachability.
- Accounting-enabled tenants SHOULD enqueue the outbox event transactionally with the payment once the event is activated.
- Outbox delivery failures MUST retry and preserve `lastError`.
- Accounting posting failures MUST remain in Accounting source-event processing.
- Reversal MUST emit a separate reversal event from the reversal payment row.
- No event should mutate or delete the original Accounting journal.

## 17. Safe Implementation Order

Recommended order:

1. Finance approves settlement policy decisions in the decision register.
2. Add event builder methods for `REINSURER_DISBURSEMENT_RECORDED` and `REINSURER_DISBURSEMENT_REVERSED`.
3. Enqueue disbursement events inside the existing `PlacementPaymentsService.create` and `reverse` transactions for Accounting-enabled tenants.
4. Add reconciliation endpoints for missing disbursement outbox rows.
5. Add tests for event payload shape, idempotency, outbox persistence, no duplicate delivery and disabled Accounting behavior.
6. Add Accounting posting-rule templates or seed examples only after Finance confirms conceptual GL treatment.
7. Add UAT documentation and run Accounting source-event processing end to end.
8. Defer note-level allocation, payment batches, approvals, bank confirmation, FX and unallocated advances to later milestones.

## 18. Implementation Readiness

`REINSURER_DISBURSEMENT_RECORDED` is ready for a narrow engineering implementation only if the product scope is:

```text
single recorded outbound payment
to one confirmed original or endorsement closing
in placement currency
for a reinsurer counterparty
without approval, batch, FX, bank-confirmation or note-allocation semantics
```

It is not ready as a complete production settlement standard until open Finance decisions are resolved.

## 19. Open Blockers

| Blocker                                 | Impact                                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------------------------- |
| Payable recognition policy not final    | Determines debit/credit conceptual posting.                                               |
| Note settlement relation inactive       | Cannot claim payment settles specific credit note(s).                                     |
| No allocation table                     | Cannot support one payment across multiple obligations with traceable allocation amounts. |
| No approval/bank-confirmation lifecycle | `RECORDED` means durable payment fact today; it may be too early for some finance teams.  |
| No FX model                             | Multi-currency bank settlement cannot be represented safely.                              |
| No payment batch model                  | Bulk disbursements cannot be traced as a batch.                                           |
