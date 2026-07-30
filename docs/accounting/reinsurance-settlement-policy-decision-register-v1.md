# Reinsurance Settlement Policy Decision Register v1

Status: Approved policy baseline with domain-readiness implementation pending

Scope: Finance/Product/Engineering decisions required before activating reinsurer settlement accounting events.

Related audit: [Reinsurance Settlement Architecture Audit v1](./reinsurance-settlement-architecture-audit-v1.md)

Approval note: Finance/Product policies in this register were approved for implementation on 2026-07-30. Engineering MUST first ensure the Reinsurance domain can represent the complete approved business facts before activating `REINSURER_DISBURSEMENT_RECORDED`.

## 1. Decision Summary

| ID      | Decision                                        | Recommended Default                                                                                                                 | Status   | Owner                  | Blocks                 |
| ------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------- | ---------------------- | ---------------------- |
| RSD-001 | Recognition boundary for reinsurer disbursement | Use bank-confirmed `PlacementPayment` rows with `type = REINSURER_DISBURSEMENT`, `direction = OUTBOUND`, `status = BANK_CONFIRMED`. | Approved | Finance/Product        | Event activation       |
| RSD-002 | Reversal boundary                               | Use linked reversal `PlacementPayment` row as the reversal source record.                                                           | Approved | Finance/Product        | Event activation       |
| RSD-003 | Reinsurer payable recognition policy            | Treat disbursement as cash settlement of an existing payable created by issued Credit Note or Endorsement Credit Note.              | Approved | Finance                | Posting-rule templates |
| RSD-004 | Credit-note settlement linkage                  | Use explicit payment-allocation records to link disbursements to issued Credit Notes or Endorsement Credit Notes.                   | Approved | Product/Engineering    | Note allocation claims |
| RSD-005 | Allocation cardinality for v1                   | Support one payment to many Credit Notes and many payments to one Credit Note.                                                      | Approved | Product/Finance        | Payload contract       |
| RSD-006 | Partial payments and overpayments               | Allow partial settlements and overpayments; correct overpayments using Journal Voucher.                                             | Approved | Product/Finance        | UAT wording            |
| RSD-007 | Unallocated advances                            | Do not support reinsurer advances/unallocated disbursements in v1.                                                                  | Proposed | Finance/Product        | Scope control          |
| RSD-008 | Payment approval and bank confirmation          | Treat bank approval as operational only; bank confirmation or successful payment completion is the financial event boundary.        | Approved | Finance/Product        | Recognition timing     |
| RSD-009 | Currency and FX                                 | Allow payment currency to differ from Credit Note currency only when the agreed exchange rate is persisted and reused.              | Approved | Finance/Product        | Multi-currency rollout |
| RSD-010 | Subledger identity                              | Use `REINSURER` subledger with external reference equal to Reinsurance `Counterparty.id`.                                           | Proposed | Accounting Engineering | Posting readiness      |
| RSD-011 | Bank charges and withholding tax                | Capture bank charges and withholding tax on the transaction; Accounting decides the tenant-specific ledger postings.                | Approved | Product/Finance        | Payload contract       |
| RSD-012 | Failed, cancelled and write-off handling        | Failed/cancelled payments create no accounting event; settlement write-offs require accountant approval and JV/write-off workflow.  | Approved | Product/Finance        | Scope control          |

## 2. Detailed Decisions

### RSD-001 Recognition Boundary

`REINSURER_DISBURSEMENT_RECORDED` SHOULD be recognized from a bank-confirmed `PlacementPayment`, not from UI submit intent, document generation, credit-note issue, closing confirmation, bank approval, or draft payment instruction.

Required source shape:

```text
type = REINSURER_DISBURSEMENT
direction = OUTBOUND
status = BANK_CONFIRMED
reversalOfPaymentId = null
amount > 0
one or more allocations to issued credit-note obligations exist
```

Reason:

This is the first approved durable operational record that represents completed payment out to a reinsurer.

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

Approved default:

Use disbursement only as settlement of a prior payable created by an issued Credit Note or Endorsement Credit Note. Do not make cash disbursement the payable recognition event.

### RSD-004 Credit-Note Settlement Linkage

The event MUST claim settlement only through explicit payment-allocation records linking the payment to issued Credit Notes or Endorsement Credit Notes.

Reason:

The legacy `settledByPaymentId` relation is insufficient for partial and many-to-many settlement. Allocation rows preserve the approved settlement truth.

### RSD-005 Allocation Cardinality

V1 settlement accounting SHOULD use:

```text
allocation.model = CREDIT_NOTE_ALLOCATIONS
```

Supported:

- one payment across many Credit Notes
- many payments against one Credit Note
- partial payment below outstanding
- overpayment with later JV correction

Not supported:

- unallocated advance

### RSD-006 Partial Payments and Overpayments

Partial payments are allowed. Overpayments are allowed and corrected through Journal Voucher or an approved accounting correction workflow; the original payment row remains immutable.

Reason:

This reflects the approved Finance policy that settlement differences should be corrected transparently, not by editing or deleting the original payment.

### RSD-007 Unallocated Advances

Unallocated reinsurer disbursement advances are out of scope for v1.

Reason:

Current validation requires exactly one confirmed closing source. Supporting advances requires a separate liability/advance model and allocation workflow.

### RSD-008 Approval and Bank Confirmation

Bank approval is operational only. Bank confirmation or successful payment completion is the financial event boundary.

Recommended for v1:

Use `BANK_CONFIRMED` for disbursements that are eligible for accounting recognition. Failed and cancelled payments MUST NOT publish accounting events.

### RSD-009 Currency and FX

V1 disbursement accounting MAY support payment currency different from Credit Note currency only when the agreed transaction exchange rate is persisted and reused.

Reason:

Accounting MUST NOT fetch live FX rates for settlement recognition. Any FX posting must use the agreed persisted rate and the immutable payment/allocation snapshot.

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

- Engineering validates the domain model can represent approved allocations, bank confirmation, FX, charges and withholding.
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
- partial reversal
- automatic write-off approval workflow
- claim settlement accounting
