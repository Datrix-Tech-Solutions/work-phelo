# Reinsurance Settlement Policy Decision Register v1

Status: Draft 1

Scope: Finance/Product/Engineering decisions required before activating reinsurer settlement accounting events.

Related audit: [Reinsurance Settlement Architecture Audit v1](./reinsurance-settlement-architecture-audit-v1.md)

## 1. Decision Summary

| ID      | Decision                                        | Recommended Default                                                                                                                                  | Status                    | Owner                  | Blocks                 |
| ------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ---------------------- | ---------------------- |
| RSD-001 | Recognition boundary for reinsurer disbursement | Use `PlacementPayment` creation with `type = REINSURER_DISBURSEMENT`, `direction = OUTBOUND`, `status = RECORDED` and a confirmed closing source.    | Proposed                  | Finance/Product        | Event activation       |
| RSD-002 | Reversal boundary                               | Use linked reversal `PlacementPayment` row as the reversal source record.                                                                            | Proposed                  | Finance/Product        | Event activation       |
| RSD-003 | Reinsurer payable recognition policy            | Treat disbursement as cash settlement of an already recognized payable or clearing balance.                                                          | Pending approval          | Finance                | Posting-rule templates |
| RSD-004 | Credit-note settlement linkage                  | Do not treat `PlacementNote.settledByPaymentId` as active settlement truth until a service workflow sets it.                                         | Proposed                  | Product/Engineering    | Note allocation claims |
| RSD-005 | Allocation cardinality for v1                   | Support one payment to one original or endorsement closing; allow multiple payments per closing; do not support one payment across many obligations. | Proposed                  | Product/Finance        | Payload contract       |
| RSD-006 | Partial payments                                | Allow partial disbursement payments below outstanding; reject overpayments.                                                                          | Implemented operationally | Product/Finance        | UAT wording            |
| RSD-007 | Unallocated advances                            | Do not support reinsurer advances/unallocated disbursements in v1.                                                                                   | Proposed                  | Finance/Product        | Scope control          |
| RSD-008 | Payment approval and bank confirmation          | Do not model approvals/bank confirmation in the v1 event; `RECORDED` remains the durable financial fact.                                             | Pending approval          | Finance/Product        | Recognition timing     |
| RSD-009 | Currency and FX                                 | Require placement currency; defer FX, bank currency and realized gain/loss.                                                                          | Implemented operationally | Finance/Product        | Multi-currency rollout |
| RSD-010 | Subledger identity                              | Use `REINSURER` subledger with external reference equal to Reinsurance `Counterparty.id`.                                                            | Proposed                  | Accounting Engineering | Posting readiness      |
| RSD-011 | Payment reversal amount                         | Use full reversal row amount; partial reversal is out of scope until separately modeled.                                                             | Implemented operationally | Product/Finance        | Reversal event payload |
| RSD-012 | Batch disbursement                              | No batch identity in v1 payload because no batch model exists.                                                                                       | Proposed                  | Product                | Bulk-payment features  |

## 2. Detailed Decisions

### RSD-001 Recognition Boundary

`REINSURER_DISBURSEMENT_RECORDED` SHOULD be recognized from `PlacementPayment` creation, not from UI submit intent, document generation, credit-note issue, closing confirmation or bank-reference editing.

Required source shape:

```text
type = REINSURER_DISBURSEMENT
direction = OUTBOUND
status = RECORDED
reversalOfPaymentId = null
amount > 0
exactly one of closingId or endorsementClosingId exists
```

Reason:

This is the first durable operational record currently available that represents payment out to a reinsurer.

### RSD-002 Reversal Boundary

`REINSURER_DISBURSEMENT_REVERSED` SHOULD be recognized from the linked reversal `PlacementPayment`, not from the original payment status mutation.

Required source shape:

```text
type = REINSURER_DISBURSEMENT
direction = OUTBOUND
status = RECORDED
reversalOfPaymentId = <original payment id>
amount < 0
```

Reason:

This matches existing premium payment reversal architecture and preserves immutable source-event identity.

### RSD-003 Reinsurer Payable Recognition Policy

Open question:

When is the payable to the reinsurer recognized?

| Option                    | Recognition                                                  | Disbursement Posting                                |
| ------------------------- | ------------------------------------------------------------ | --------------------------------------------------- |
| Credit-note payable model | Issued credit or endorsement credit note recognizes payable. | Debit payable, credit bank.                         |
| Premium-clearing model    | Debit note/closing moves amounts through clearing.           | Debit clearing/payable, credit bank.                |
| Cash-only model           | Payable is not recognized before cash leaves.                | Debit tenant-defined expense/clearing, credit bank. |

Recommended default:

Use disbursement only as settlement of a prior payable or clearing balance. Do not make cash disbursement the payable recognition event unless Finance explicitly approves.

### RSD-004 Credit-Note Settlement Linkage

The event MUST NOT claim a specific `PlacementNote` is settled through `settledByPaymentId` until there is an active service/API workflow that writes that field.

Reason:

The schema relation exists, but no current payment service path uses it. Treating it as active would create false accounting traceability.

### RSD-005 Allocation Cardinality

V1 settlement accounting SHOULD use:

```text
allocation.model = SINGLE_CLOSING
```

Supported:

- many payments against one closing
- partial payment below outstanding
- one payment against one original placement closing
- one payment against one endorsement closing

Not supported:

- one payment across many closings
- one payment across many credit notes
- allocation amount per note
- unallocated advance

### RSD-006 Partial Payments and Overpayments

Partial payments are allowed. Overpayments are rejected before payment row creation.

Reason:

The service already checks outstanding effective reinsurer premium before creating the payment row.

### RSD-007 Unallocated Advances

Unallocated reinsurer disbursement advances are out of scope for v1.

Reason:

Current validation requires exactly one confirmed closing source. Supporting advances requires a separate liability/advance model and allocation workflow.

### RSD-008 Approval and Bank Confirmation

Finance/Product must decide whether `RECORDED` is sufficient to represent actual cash movement, or whether future `APPROVED`, `BANK_CONFIRMED`, `FAILED` and `CANCELLED` statuses are required before accounting recognition.

Recommended for v1:

Use `RECORDED` only if the UI/business process names the action truthfully as a recorded disbursement, not a payment instruction.

### RSD-009 Currency and FX

V1 disbursement accounting MUST remain placement-currency only.

Reason:

There is no bank currency, exchange rate, base amount, realized FX gain/loss or bank fee snapshot on `PlacementPayment`.

### RSD-010 Subledger Identity

Use:

```text
subledgerType = REINSURER
externalRef = Reinsurance Counterparty.id
```

Reason:

This aligns with the existing Reinsurance accounting readiness model and avoids name-based identity drift.

## 3. Activation Checklist

Before `REINSURER_DISBURSEMENT_RECORDED` is activated:

- Finance approves RSD-001, RSD-003, RSD-005, RSD-008 and RSD-009.
- Engineering adds event builder methods for recorded and reversed disbursements.
- Engineering enqueues outbox events transactionally with payment creation/reversal.
- Accounting posting-rule examples are agreed for at least one tenant profile.
- UAT documents include original closing and endorsement closing cases.
- Reconciliation endpoints are added or explicitly deferred with recovery procedure.

## 4. Deferred Enhancements

The following are intentionally outside the v1 settlement event:

- payment batches
- payment approval workflow
- bank statement matching
- bank confirmation status
- failed/cancelled payment statuses
- partial reversal
- one-to-many allocation
- credit-note settlement allocation
- multi-currency settlement and FX
- bank fees
- tax withheld at payment
