# Reinsurance Posting Policy Register v1

Status: Draft 1

Purpose: track the difference between engineering event activation, Finance
policy approval, and tenant posting-rule configuration for Reinsurance source
events.

This register does not assign tenant GL account IDs. Accounting tenant admins or
accountants own exact posting rules.

| Event                             | Recognition Boundary                                | Conceptual Accounting Effect                                                                                                                                      | Engineering Status                   | Policy Status                                    | Posting-Rule Configuration                                                                                                                                                                                        | Owner   |
| --------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `DEBIT_NOTE_ISSUED`               | Placement debit note issued                         | Cedant premium receivable recognition against premium clearing or income                                                                                          | Implemented                          | Approved for current Phase 1 integration profile | Tenant rule required for `REINSURANCE + DEBIT_NOTE_ISSUED`                                                                                                                                                        | Finance |
| `PREMIUM_PAYMENT_RECEIVED`        | Premium receipt payment row recorded                | Cash/bank receipt and cedant receivable clearing                                                                                                                  | Implemented                          | Approved for current Phase 1 integration profile | Tenant rule required for `REINSURANCE + PREMIUM_PAYMENT_RECEIVED`                                                                                                                                                 | Finance |
| `PAYMENT_REVERSED`                | Linked premium payment reversal row recorded        | Reverse original premium payment cash/receivable impact                                                                                                           | Implemented                          | Approved for current Phase 1 integration profile | Tenant rule required for `REINSURANCE + PAYMENT_REVERSED`                                                                                                                                                         | Finance |
| `CREDIT_NOTE_ISSUED`              | Placement credit note issued                        | Tenant-defined: receivable reduction, reinsurer payable, clearing liability, or other approved treatment                                                          | Implemented for source-event capture | Pending final Finance policy selection           | Tenant rule required for `REINSURANCE + CREDIT_NOTE_ISSUED` before posting succeeds                                                                                                                               | Finance |
| `ENDORSEMENT_DEBIT_NOTE_ISSUED`   | Endorsement debit note issued                       | Additional Cedant receivable for endorsement premium adjustment against tenant-defined premium clearing/income                                                    | Implemented for source-event capture | Pending final Finance policy confirmation        | Tenant rule required for `REINSURANCE + ENDORSEMENT_DEBIT_NOTE_ISSUED` before posting succeeds                                                                                                                    | Finance |
| `ENDORSEMENT_CREDIT_NOTE_ISSUED`  | Endorsement credit note issued                      | Tenant-defined return-premium treatment such as reinsurer payable, receivable reduction or clearing adjustment                                                    | Implemented for source-event capture | Pending final Finance policy confirmation        | Tenant rule required for `REINSURANCE + ENDORSEMENT_CREDIT_NOTE_ISSUED` before posting succeeds                                                                                                                   | Finance |
| `REINSURER_DISBURSEMENT_RECORDED` | Reinsurer outbound payment reaches `BANK_CONFIRMED` | Clear recognized Reinsurer payable from issued Credit Notes against tenant-configured bank/cash; optional bank-charge and withholding lines are tenant configured | Implemented for source-event capture | Approved 2026-07-30                              | Tenant rule required for `REINSURANCE + REINSURER_DISBURSEMENT_RECORDED`; rules may use `amounts.allocatedAmount`, `amounts.paymentAmount`, `amounts.bankCharges`, `amounts.withholdingTax` and `counterparty.id` | Finance |
| `REINSURER_DISBURSEMENT_REVERSED` | Linked reinsurer disbursement reversal row recorded | Reverse the original disbursement settlement impact                                                                                                               | Planned only                         | Pending settlement policy approval               | Do not configure production rule until RSD decisions are approved                                                                                                                                                 | Finance |

## Notes

- Reinsurance publishes business facts only.
- Accounting posting rules own debit/credit lines and GL account selection.
- Missing posting rules, missing subledgers or closed fiscal periods should fail
  Accounting source-event processing without mutating the Reinsurance source
  record or deleting the Reinsurance outbox row.
- Future note-voiding, reinsurer-disbursement reversal and claim events must be added to
  this register before activation.
- Reinsurer disbursement policy is tracked in
  [Reinsurance Settlement Policy Decision Register v1](./reinsurance-settlement-policy-decision-register-v1.md).
- Reinsurer disbursement events publish business facts only. Reinsurance does
  not choose payable, bank-charge, withholding-tax or FX gain/loss GL accounts.
  Accounting posting rules resolve those accounts per tenant.
- The recorded disbursement event supports multiple Credit Note allocations,
  partial settlement, persisted agreed FX rates, bank-charge facts and
  withholding-tax facts. Unallocated payments are rejected before event capture.
