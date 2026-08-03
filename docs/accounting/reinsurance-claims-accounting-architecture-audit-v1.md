# Reinsurance Claims Accounting Architecture Audit v1

Status: Draft 1

Date: 2026-08-03

Scope: design audit only. This document does not activate claim accounting
events, create migrations, add APIs, change posting rules or alter production
business logic.

## 1. Purpose

This audit defines the safe accounting recognition shape for the Reinsurance
claims lifecycle under WFIS v1. It reviews the current Reinsurance claim domain,
identifies the source records that can become Accounting source events, and
records the policy and data gaps that must be resolved before activation.

Claims are more sensitive than premium notes because they involve multiple cash
directions:

- cedant claim payable approval;
- broker to cedant settlement;
- reinsurer cash-call receivable or memo demand;
- reinsurer to broker recovery receipt;
- reversals of recovery receipts and cedant settlements.

The main design objective is to avoid posting journals from lifecycle states,
frontend calculations, or mutable projections. Every future claim accounting
event must use a durable backend source record with deterministic idempotency.

## 2. Audited Implementation

### 2.1 Models

| Model                            | Current role                                                                               | Accounting readiness                                                                                                             |
| -------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `PlacementClaim`                 | Loss event, claim lifecycle, final loss amount and approved cedant payable amount.         | Partially ready. It stores approved payable amount but not approval history or approved-date business event versions.            |
| `PlacementClaimAllocation`       | Allocation of claim loss to original or endorsement closing snapshots.                     | Ready as allocation support. It is snapshot-derived and tenant scoped, but does not itself represent accounting recognition.     |
| `PlacementClaimCashCall`         | One cash-call record per claim allocation. Supports DRAFT, ISSUED, PAID and VOID statuses. | Partially ready. ISSUED is durable, but Finance must decide whether issuance creates a receivable or only an operational demand. |
| `PlacementClaimRecoveryReceipt`  | Immutable reinsurer-to-broker receipt and linked reversal rows.                            | Mostly ready for receipt/reversal events. Lacks FX, bank charge and withholding fields.                                          |
| `PlacementClaimCedantSettlement` | Immutable broker-to-cedant settlement and linked reversal rows.                            | Mostly ready for settlement/reversal events. Lacks FX, bank charge and withholding fields.                                       |

### 2.2 Current lifecycle services

| Service                                  | Observed behavior                                                                                                                                                                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PlacementClaimsService`                 | Creates DRAFT claims, validates loss date/currency/amount against effective placement state, updates editable claims, changes claim status, and generates allocations from effective confirmed placement/endorsement closing snapshots. |
| `PlacementClaimCashCallsService`         | Creates DRAFT cash calls from allocation snapshots, issues or voids cash calls, blocks duplicate active cash calls per allocation, and blocks voiding when effective recovery receipts exist.                                           |
| `PlacementClaimRecoveryReceiptsService`  | Records receipts only against ISSUED cash calls, rejects currency mismatch and over-recovery, creates immutable linked reversal rows, and calculates recovery/funding position.                                                         |
| `PlacementClaimCedantSettlementsService` | Approves payable amount, records cedant settlements, rejects over-settlement, creates immutable linked reversal rows, and calculates settlement position.                                                                               |

### 2.3 Current endpoint facts

| Workflow                     | Endpoint family                                                                                                     | Source truth                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Claim registration           | `POST /placements/:id/claims`                                                                                       | `PlacementClaim`                                                         |
| Claim payable approval       | `PATCH /placements/:id/claims/:claimId/approve-payable`                                                             | `PlacementClaim.approvedPayableAmount`, `approvedAt`, `approvedByUserId` |
| Allocation generation        | `POST /placements/:id/claims/:claimId/allocations/generate`                                                         | `PlacementClaimAllocation` rows from effective closing snapshots         |
| Cash-call creation and issue | `POST /placements/:id/claims/:claimId/allocations/:allocationId/cash-calls`, `PATCH /cash-calls/:cashCallId/status` | `PlacementClaimCashCall`                                                 |
| Cash-call void               | `POST /placements/:id/claims/:claimId/cash-calls/:cashCallId/void`                                                  | `PlacementClaimCashCall.status = VOID`                                   |
| Recovery receipt             | `POST /placements/:id/claims/:claimId/cash-calls/:cashCallId/recovery-receipts`                                     | `PlacementClaimRecoveryReceipt`                                          |
| Recovery receipt reversal    | `POST /placements/:id/claims/:claimId/recovery-receipts/:receiptId/reverse`                                         | linked reversal `PlacementClaimRecoveryReceipt`                          |
| Cedant settlement            | `POST /placements/:id/claims/:claimId/cedant-settlements`                                                           | `PlacementClaimCedantSettlement`                                         |
| Cedant settlement reversal   | `POST /placements/:id/claims/:claimId/cedant-settlements/:settlementId/reverse`                                     | linked reversal `PlacementClaimCedantSettlement`                         |

## 3. Recognition Boundary Findings

### 3.1 Claim registration

`CLAIM_REGISTERED` should not create GL journals in v1. Registration is an
operational notification of loss, not an approved financial liability.

It may later be useful for audit, reporting or reserve workflows, but posting
from registration would invent an accounting obligation before Finance approval.

### 3.2 Claim payable approval

`CLAIM_PAYABLE_APPROVED` is the first plausible cedant liability recognition
boundary because a broker-approved payable amount exists on `PlacementClaim`.

Current blocker: approval is stored as a mutable value on the claim. The service
allows updates to approved payable amount as long as the new amount is not below
already settled amount. There is no approval history table and no explicit delta
source record.

Safe options:

- Activate only first approval and block accounting activation for later
  amendments until a claim payable adjustment model exists.
- Add an immutable approval/amendment history model in a future milestone.
- Emit adjustment events only after Finance approves payable increase/reduction
  policy.

### 3.3 Claim cash-call issue

`CLAIM_CASH_CALL_ISSUED` is a durable operational demand on a reinsurer. It uses
claim allocation snapshots, cash-call amount, basis amount, signed line percent,
counterparty and issue date.

Policy blocker: Finance must decide whether issued cash calls create a reinsurer
receivable immediately or remain memo-only until cash is received.

If cash-call issue posts a receivable, `CLAIM_CASH_CALL_VOIDED` must reverse or
void that receivable when applicable.

If cash-call issue is memo-only, no journal should be posted at issue or void.

### 3.4 Recovery receipt

`CLAIM_RECOVERY_RECEIPT_RECORDED` is a strong financial boundary. It records
cash received from a reinsurer against an issued cash call and rejects over
recovery.

Current support:

- immutable receipt row;
- tenant, placement, claim, allocation, cash-call and counterparty scoping;
- explicit business date `paymentDate`;
- currency must match the cash-call currency;
- partial receipts are supported;
- reversal uses an immutable linked reversal receipt row.

Current gaps:

- no agreed FX rate for cross-currency receipt accounting;
- no bank charge fields;
- no withholding tax fields;
- reversal row stores positive amount and relies on linkage/status for
  direction, so payload contracts must be explicit.

### 3.5 Cedant settlement

`CLAIM_CEDANT_SETTLEMENT_RECORDED` is a strong financial boundary. It records
cash paid to the cedant against an approved payable amount and rejects
over-settlement.

Current support:

- immutable settlement row;
- tenant, placement and claim scoping;
- explicit business date `settlementDate`;
- currency must match the claim currency;
- partial settlement is supported;
- reversal uses an immutable linked reversal settlement row.

Current gaps:

- cedant is inferred from placement rather than stored directly on the
  settlement row;
- no agreed FX rate for cross-currency settlement accounting;
- no bank charge fields;
- no withholding tax fields;
- reversal row stores positive amount and relies on linkage/status for
  direction, so payload contracts must be explicit.

### 3.6 Claim closure

`CLAIM_CLOSED` should not post financial journals by default. Closure is a
lifecycle milestone that may confirm no further operational actions are
expected, but the financial effects should already be represented by approval,
settlement, recovery, reversal and any future write-off records.

Claim closure should post only if Finance later approves explicit write-off or
reserve-release events.

## 4. Claim Financial Event Matrix

| Event                              | Recognition boundary                    | Source record                                | Business date                 | Counterparty               | Amount source                                       | Accounting posture                                 | Activation status                 |
| ---------------------------------- | --------------------------------------- | -------------------------------------------- | ----------------------------- | -------------------------- | --------------------------------------------------- | -------------------------------------------------- | --------------------------------- |
| `CLAIM_REGISTERED`                 | Claim row created                       | `PlacementClaim.id`                          | `reportedDate` or `createdAt` | Cedant from placement      | None                                                | Do not post in v1                                  | Planned, non-posting              |
| `CLAIM_PAYABLE_APPROVED`           | Claim payable amount approved           | `PlacementClaim.id`                          | `approvedAt`                  | Cedant from placement      | `approvedPayableAmount`                             | Candidate payable recognition                      | Policy and source-history pending |
| `CLAIM_CASH_CALL_ISSUED`           | Cash call moved to ISSUED               | `PlacementClaimCashCall.id`                  | `issuedAt`                    | Reinsurer `counterpartyId` | `amount`, `basisAmount`, `signedLinePercent`        | Policy-dependent receivable or memo                | Policy pending                    |
| `CLAIM_CASH_CALL_VOIDED`           | Issued cash call moved to VOID          | `PlacementClaimCashCall.id`                  | `voidedAt`                    | Reinsurer `counterpartyId` | original cash-call amount                           | Reverse only if issue posted                       | Policy pending                    |
| `CLAIM_RECOVERY_RECEIPT_RECORDED`  | Recovery receipt row recorded           | `PlacementClaimRecoveryReceipt.id`           | `paymentDate`                 | Reinsurer `counterpartyId` | `amount`                                            | Candidate cash/recovery recognition                | Domain mostly ready               |
| `CLAIM_RECOVERY_RECEIPT_REVERSED`  | Linked reversal receipt row recorded    | reversal `PlacementClaimRecoveryReceipt.id`  | reversal `paymentDate`        | Reinsurer `counterpartyId` | reversal row `amount` plus original receipt link    | Reverse prior recovery receipt                     | Domain mostly ready               |
| `CLAIM_CEDANT_SETTLEMENT_RECORDED` | Cedant settlement row recorded          | `PlacementClaimCedantSettlement.id`          | `settlementDate`              | Cedant from placement      | `amount`                                            | Candidate payable clearing/cash disbursement       | Domain mostly ready               |
| `CLAIM_CEDANT_SETTLEMENT_REVERSED` | Linked reversal settlement row recorded | reversal `PlacementClaimCedantSettlement.id` | reversal `settlementDate`     | Cedant from placement      | reversal row `amount` plus original settlement link | Reverse prior cedant settlement                    | Domain mostly ready               |
| `CLAIM_CLOSED`                     | Claim status moved to CLOSED            | `PlacementClaim.id`                          | `closedAt`                    | Cedant from placement      | None                                                | Do not post unless write-off/reserve policy exists | Planned, non-posting              |

## 5. Proposed Factual Event Contracts

These contracts describe business facts only. They intentionally do not include
GL accounts, debit/credit directions, journal lines or posting-rule IDs.

### 5.1 Common claim event shape

```json
{
  "tenantId": "tenant-id",
  "sourceModule": "REINSURANCE",
  "sourceEventType": "CLAIM_EVENT_NAME",
  "sourceRecordId": "durable-source-record-id",
  "sourceDocumentId": "optional-document-id",
  "idempotencyKey": "deterministic-key",
  "occurredAt": "business-date-from-source-record",
  "currency": "GHS",
  "payload": {
    "references": {
      "placementId": "placement-id",
      "placementReference": "FAC-2026-001",
      "policyNumber": "POL-2026-001",
      "claimId": "claim-id",
      "claimNumber": "CLM-001"
    },
    "counterparty": {
      "id": "counterparty-id",
      "type": "CEDANT_OR_REINSURER",
      "name": "Counterparty name if already available"
    },
    "amounts": {},
    "trace": {}
  }
}
```

### 5.2 `CLAIM_PAYABLE_APPROVED`

```json
{
  "sourceRecordId": "claim-id",
  "sourceDocumentId": null,
  "idempotencyKey": "reinsurance:claim-payable:<claimId>:approved:v1",
  "occurredAt": "claim.approvedAt",
  "currency": "claim.currency",
  "payload": {
    "references": {
      "placementId": "placement-id",
      "claimId": "claim-id",
      "claimNumber": "CLM-001"
    },
    "amounts": {
      "finalLossAmount": "100000.00",
      "approvedPayableAmount": "90000.00"
    },
    "approval": {
      "approvedAt": "2026-08-03T10:00:00.000Z",
      "approvedByUserId": "user-id"
    }
  }
}
```

Activation warning: this contract is safe only for first approval unless an
immutable approval adjustment source is added.

### 5.3 `CLAIM_CASH_CALL_ISSUED`

```json
{
  "sourceRecordId": "cash-call-id",
  "sourceDocumentId": "claim-cash-call-document-id-if-generated",
  "idempotencyKey": "reinsurance:claim-cash-call:<cashCallId>:issued:v1",
  "occurredAt": "cashCall.issuedAt",
  "currency": "cashCall.currency",
  "payload": {
    "references": {
      "placementId": "placement-id",
      "claimId": "claim-id",
      "allocationId": "allocation-id",
      "cashCallId": "cash-call-id",
      "cashCallNumber": "CCL-001"
    },
    "counterparty": {
      "id": "reinsurer-counterparty-id",
      "type": "REINSURER"
    },
    "amounts": {
      "amount": "25000.00",
      "basisAmount": "100000.00",
      "signedLinePercent": "25.000000"
    },
    "allocation": {
      "placementClosingId": "original-closing-id-if-any",
      "endorsementClosingId": "endorsement-closing-id-if-any",
      "participantId": "original-participant-id-if-any",
      "endorsementParticipantId": "endorsement-participant-id-if-any"
    }
  }
}
```

### 5.4 `CLAIM_CASH_CALL_VOIDED`

```json
{
  "sourceRecordId": "cash-call-id",
  "idempotencyKey": "reinsurance:claim-cash-call:<cashCallId>:voided:v1",
  "occurredAt": "cashCall.voidedAt",
  "currency": "cashCall.currency",
  "payload": {
    "references": {
      "placementId": "placement-id",
      "claimId": "claim-id",
      "allocationId": "allocation-id",
      "cashCallId": "cash-call-id",
      "cashCallNumber": "CCL-001"
    },
    "amounts": {
      "amount": "25000.00"
    },
    "void": {
      "reason": "Cash call replaced after updated claim review."
    }
  }
}
```

### 5.5 `CLAIM_RECOVERY_RECEIPT_RECORDED`

```json
{
  "sourceRecordId": "receipt-id",
  "idempotencyKey": "reinsurance:claim-recovery-receipt:<receiptId>:recorded:v1",
  "occurredAt": "receipt.paymentDate",
  "currency": "receipt.currency",
  "payload": {
    "references": {
      "placementId": "placement-id",
      "claimId": "claim-id",
      "allocationId": "allocation-id",
      "cashCallId": "cash-call-id",
      "receiptId": "receipt-id",
      "cashCallNumber": "CCL-001"
    },
    "counterparty": {
      "id": "reinsurer-counterparty-id",
      "type": "REINSURER"
    },
    "amounts": {
      "receiptAmount": "10000.00"
    },
    "payment": {
      "reference": "BANK-REC-001",
      "paymentDate": "2026-08-03T10:00:00.000Z"
    }
  }
}
```

### 5.6 `CLAIM_RECOVERY_RECEIPT_REVERSED`

```json
{
  "sourceRecordId": "reversal-receipt-id",
  "idempotencyKey": "reinsurance:claim-recovery-receipt:<reversalReceiptId>:reversal:v1",
  "occurredAt": "reversalReceipt.paymentDate",
  "currency": "reversalReceipt.currency",
  "payload": {
    "references": {
      "placementId": "placement-id",
      "claimId": "claim-id",
      "allocationId": "allocation-id",
      "cashCallId": "cash-call-id",
      "originalReceiptId": "original-receipt-id",
      "reversalReceiptId": "reversal-receipt-id"
    },
    "counterparty": {
      "id": "reinsurer-counterparty-id",
      "type": "REINSURER"
    },
    "amounts": {
      "reversalAmount": "10000.00"
    },
    "reversal": {
      "reason": "Correction details from notes if supplied"
    }
  }
}
```

### 5.7 `CLAIM_CEDANT_SETTLEMENT_RECORDED`

```json
{
  "sourceRecordId": "settlement-id",
  "idempotencyKey": "reinsurance:claim-cedant-settlement:<settlementId>:recorded:v1",
  "occurredAt": "settlement.settlementDate",
  "currency": "settlement.currency",
  "payload": {
    "references": {
      "placementId": "placement-id",
      "claimId": "claim-id",
      "settlementId": "settlement-id"
    },
    "counterparty": {
      "id": "placement.cedantId",
      "type": "CEDANT"
    },
    "amounts": {
      "settlementAmount": "25000.00"
    },
    "payment": {
      "reference": "CEDANT-PAY-001",
      "settlementDate": "2026-08-03T10:00:00.000Z"
    }
  }
}
```

### 5.8 `CLAIM_CEDANT_SETTLEMENT_REVERSED`

```json
{
  "sourceRecordId": "reversal-settlement-id",
  "idempotencyKey": "reinsurance:claim-cedant-settlement:<reversalSettlementId>:reversal:v1",
  "occurredAt": "reversalSettlement.settlementDate",
  "currency": "reversalSettlement.currency",
  "payload": {
    "references": {
      "placementId": "placement-id",
      "claimId": "claim-id",
      "originalSettlementId": "original-settlement-id",
      "reversalSettlementId": "reversal-settlement-id"
    },
    "counterparty": {
      "id": "placement.cedantId",
      "type": "CEDANT"
    },
    "amounts": {
      "reversalAmount": "25000.00"
    },
    "reversal": {
      "reason": "Correction details from notes if supplied"
    }
  }
}
```

## 6. Do-Not-Post Analysis

| Business record or action               | Reason it should not post in v1                                                                                         |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Claim creation                          | A reported claim is not yet an approved payable or cash movement.                                                       |
| Claim status `NOTIFIED` or `RESERVED`   | Current reserves are operational only; no reserve accounting policy has been approved.                                  |
| Claim allocation generation             | Allocation rows are calculation support for cash calls, not receivables or payments.                                    |
| DRAFT cash call                         | Draft demand is not issued to a reinsurer.                                                                              |
| VOID cash call when issue was memo-only | No prior accounting event exists to reverse.                                                                            |
| Claim close                             | Financial effects should already be represented by approval, settlement, recovery, reversal or future write-off events. |
| Dashboard recovery totals               | Aggregates are projections, not source records.                                                                         |
| Frontend claim calculations             | WFIS requires backend durable source records only.                                                                      |

## 7. Reconciliation Design

Future claim accounting events should expose reconciliation views using the same
pattern as premium and settlement events.

### 7.1 Reconciliation keys

| Event                              | Primary reconciliation key | Secondary trace keys                                  |
| ---------------------------------- | -------------------------- | ----------------------------------------------------- |
| `CLAIM_PAYABLE_APPROVED`           | `claimId`                  | placementId, claimNumber, approvedAt                  |
| `CLAIM_CASH_CALL_ISSUED`           | `cashCallId`               | claimId, allocationId, cashCallNumber, counterpartyId |
| `CLAIM_CASH_CALL_VOIDED`           | `cashCallId`               | claimId, allocationId, cashCallNumber                 |
| `CLAIM_RECOVERY_RECEIPT_RECORDED`  | `receiptId`                | cashCallId, allocationId, claimId, counterpartyId     |
| `CLAIM_RECOVERY_RECEIPT_REVERSED`  | `reversalReceiptId`        | originalReceiptId, cashCallId, claimId                |
| `CLAIM_CEDANT_SETTLEMENT_RECORDED` | `settlementId`             | claimId, placementId, cedantId                        |
| `CLAIM_CEDANT_SETTLEMENT_REVERSED` | `reversalSettlementId`     | originalSettlementId, claimId, placementId            |

### 7.2 Reconciliation views

Recommended future endpoints:

- `POST /accounting-integration/reconciliation/claim-payable-approved`
- `POST /accounting-integration/reconciliation/claim-cash-call-issued`
- `POST /accounting-integration/reconciliation/claim-cash-call-voided`
- `POST /accounting-integration/reconciliation/claim-recovery-receipt-recorded`
- `POST /accounting-integration/reconciliation/claim-recovery-receipt-reversed`
- `POST /accounting-integration/reconciliation/claim-cedant-settlement-recorded`
- `POST /accounting-integration/reconciliation/claim-cedant-settlement-reversed`

Each view should report:

- source record status and amount;
- accounting outbox status;
- Accounting SourceEventInbox status;
- linked journal entry if posted;
- failure reason if dispatch or posting failed;
- deterministic idempotency key.

## 8. Traceability Design

Traceability must flow from claim source records to Accounting and back:

```text
Placement
  -> PlacementClaim
  -> PlacementClaimAllocation
  -> PlacementClaimCashCall
  -> PlacementClaimRecoveryReceipt
  -> ReinsuranceAccountingOutbox
  -> Accounting SourceEventInbox
  -> JournalEntry
```

```text
Placement
  -> PlacementClaim
  -> PlacementClaimCedantSettlement
  -> ReinsuranceAccountingOutbox
  -> Accounting SourceEventInbox
  -> JournalEntry
```

For reversal events, traceability must include both the original and reversal
source record IDs.

## 9. Recommended Activation Order

| Order | Event or prerequisite                                       | Reason                                                                                                  |
| ----- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 1     | Finance decision register approval                          | Prevents accidental GL policy decisions in Engineering.                                                 |
| 2     | Claim payable approval history or first-approval-only guard | Current mutable payable approval is not enough for safe amendments.                                     |
| 3     | `CLAIM_PAYABLE_APPROVED`                                    | Establishes cedant liability before settlement clearing.                                                |
| 4     | `CLAIM_CEDANT_SETTLEMENT_RECORDED`                          | Strong cash/payment boundary; can clear approved payable.                                               |
| 5     | `CLAIM_CEDANT_SETTLEMENT_REVERSED`                          | Required once settlement recorded is active.                                                            |
| 6     | `CLAIM_RECOVERY_RECEIPT_RECORDED`                           | Strong cash receipt boundary; can recognize recovery or clear cash-call receivable depending on policy. |
| 7     | `CLAIM_RECOVERY_RECEIPT_REVERSED`                           | Required once recovery receipt recorded is active.                                                      |
| 8     | `CLAIM_CASH_CALL_ISSUED`                                    | Activate only if Finance wants cash-call receivables at issue.                                          |
| 9     | `CLAIM_CASH_CALL_VOIDED`                                    | Activate only if cash-call issue posts.                                                                 |
| 10    | Claim close or write-off events                             | Defer until write-off/reserve policy exists.                                                            |

## 10. Activation Blockers

| Blocker                                                            | Impact                                                                 | Recommended resolution                                                 |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Mutable payable approval amount                                    | Cannot safely distinguish first approval from later adjustment events. | Add approval history or restrict v1 accounting to first approval only. |
| Cash-call receivable policy unresolved                             | `CLAIM_CASH_CALL_ISSUED` may or may not post.                          | Finance decision required.                                             |
| No cross-currency facts on claim receipts/settlements              | Cannot support FX postings under WFIS without agreed rate snapshot.    | Add agreed FX fields before cross-currency activation.                 |
| No bank charge or withholding fields on claim receipts/settlements | Cannot publish those facts.                                            | Add fields only if Finance requires them.                              |
| No approved reserve accounting policy                              | Claim notification/reserve statuses should not post.                   | Keep reserve events out of scope.                                      |
| Cedant inferred, not snapshotted, on settlement rows               | Payload builder must derive cedant from placement at event time.       | Accept for v1 or add explicit settlement counterparty snapshot later.  |

## 11. Final Audit Verdict

The claims domain is structurally close to accounting readiness for receipt and
settlement events, but not yet ready for full activation.

Ready candidates after policy approval:

- `CLAIM_CEDANT_SETTLEMENT_RECORDED`
- `CLAIM_CEDANT_SETTLEMENT_REVERSED`
- `CLAIM_RECOVERY_RECEIPT_RECORDED`
- `CLAIM_RECOVERY_RECEIPT_REVERSED`

Not ready without policy or model hardening:

- `CLAIM_PAYABLE_APPROVED`
- `CLAIM_CASH_CALL_ISSUED`
- `CLAIM_CASH_CALL_VOIDED`
- reserve, write-off and claim-close posting events
