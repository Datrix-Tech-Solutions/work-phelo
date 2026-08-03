# Reinsurer Disbursement Accounting UAT

Status: v1.0 implementation guide

Event: `REINSURER_DISBURSEMENT_RECORDED`

## Approved Policy Summary

- Reinsurer payable is recognized when a Credit Note or Endorsement Credit Note
  is issued.
- A bank-confirmed Reinsurer payment clears an existing payable.
- Bank approval is operational only and does not emit accounting.
- Bank confirmation or successful payment completion is the accounting
  recognition boundary.
- One payment may settle many Credit Notes.
- One Credit Note may receive many payments.
- Partial settlements are supported.
- Unallocated Reinsurer payments are rejected.
- Overpayments remain immutable and are corrected through Journal Voucher or an
  approved accounting correction process.
- Payment currency may differ from Credit Note currency only when the agreed
  exchange rate is persisted on the transaction.
- Reinsurance never fetches live FX rates during accounting capture.
- Bank charges and withholding tax are transaction facts; Accounting posting
  rules decide ledger treatment.
- Failed and cancelled payments emit no accounting event.
- Write-offs are not implemented in this milestone.

## Source Model

Source record: `PlacementPayment.id`

Eligible source shape:

```text
type = REINSURER_DISBURSEMENT
direction = OUTBOUND
status = BANK_CONFIRMED
reversalOfPaymentId = null
bankConfirmedAt is present
counterparty.type = REINSURER
allocations.length > 0
```

Allocation source: `PlacementPaymentAllocation`.

Supported obligations:

- `PlacementNote.type = CREDIT_NOTE`
- `PlacementNote.type = ENDORSEMENT_CREDIT_NOTE`

The allocation row stores payment-currency amount, obligation-currency amount,
obligation currency and agreed FX rate where applicable.

## Recognition Boundary

The event is captured atomically when a valid Reinsurer disbursement is recorded
as `BANK_CONFIRMED`.

No event is emitted for:

- draft/prepared payments;
- bank approval without confirmation;
- failed payments;
- cancelled payments;
- reversal rows;
- inbound Cedant payments;
- payments without complete allocations.

## Payload Semantics

`paymentAmount` is a positive magnitude in payment currency.

`allocatedAmount` is the sum of allocation payment-currency amounts.

`unallocatedAmount` must be zero.

`bankCharges` and `withholdingTax` are positive factual magnitudes.

`signedCashImpact` is negative because cash leaves the business.

`signedPayableImpact` is negative because the existing Reinsurer payable is
reduced.

No GL account IDs, debit/credit instructions or journal voucher instructions are
published by Reinsurance.

## Happy Path

1. Issue one or more Credit Notes or Endorsement Credit Notes.
2. Ensure the Reinsurer counterparty has an Accounting subledger.
3. Configure a tenant posting rule for
   `REINSURANCE + REINSURER_DISBURSEMENT_RECORDED`.
4. Record a Reinsurer disbursement with bank confirmation.
5. Allocate the full payment amount to issued Credit Note obligations.
6. Confirm a `PENDING` Reinsurance Accounting outbox row exists with idempotency
   key:
   `reinsurance:reinsurer-disbursement:<paymentId>:recorded:v1`.
7. Dispatch the outbox.
8. Confirm Accounting creates or reuses one SourceEventInbox row and posts one
   balanced journal.

## Failure and Recovery Scenarios

Accounting disabled:

- Payment records successfully.
- No outbox row is created.

Accounting URL missing or Accounting unavailable:

- Payment and outbox row commit.
- Dispatch marks the outbox failed/retryable.
- Support can retry via outbox processing.

Invalid HMAC or service-auth configuration:

- Payment and outbox row remain durable.
- Delivery fails with diagnostics.
- Fix configuration and retry dispatch.

Missing posting rule:

- Accounting inbox receives the event.
- Processing fails cleanly.
- No journal is created.

Missing Reinsurer subledger:

- Accounting processing fails cleanly.
- No journal is created.
- Sync the Reinsurer subledger and retry source-event processing.

Closed fiscal period:

- Accounting processing fails cleanly.
- No journal is created.

Malformed allocation payload:

- Accounting processing fails cleanly.
- No partial journal is created.

Duplicate confirmation or duplicate delivery:

- Deterministic idempotency key prevents duplicate outbox/inbox/posting.

## Reconciliation

Endpoint:

```text
POST /api/v1/operations/reinsurance/accounting-integration/reconciliation/reinsurer-disbursement-recorded
```

Use `dryRun=true` to find eligible bank-confirmed disbursements missing outbox
rows.

Use `dryRun=false` to enqueue missing events using the same event builder as
live capture.

The reconciliation process preserves the original `bankConfirmedAt` business
date.

## Traceability

Forward:

```text
Placement
Credit Notes
PlacementPaymentAllocations
PlacementPayment
ReinsuranceAccountingOutbox
Accounting SourceEventInbox
JournalEntry
JournalLines
```

Reverse:

```text
Journal
SourceEventInbox.sourceRecordId
PlacementPayment
PlacementPaymentAllocations
Credit Notes
Placement
```

## Explicit Non-Goals

- Reinsurance does not create Journal Vouchers.
- Reinsurance does not create write-off events.
- Reinsurance does not publish FX gain/loss events.
- Reinsurance does not publish bank-charge-specific or withholding-tax-specific
  events.
- Claims events are not part of this UAT.
