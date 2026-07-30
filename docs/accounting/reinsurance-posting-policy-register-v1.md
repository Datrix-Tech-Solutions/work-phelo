# Reinsurance Posting Policy Register v1

Status: Draft 1

Purpose: track the difference between engineering event activation, Finance
policy approval, and tenant posting-rule configuration for Reinsurance source
events.

This register does not assign tenant GL account IDs. Accounting tenant admins or
accountants own exact posting rules.

| Event                             | Recognition Boundary                                | Conceptual Accounting Effect                                                                                   | Engineering Status                   | Policy Status                                    | Posting-Rule Configuration                                                                      | Owner   |
| --------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------- |
| `DEBIT_NOTE_ISSUED`               | Placement debit note issued                         | Cedant premium receivable recognition against premium clearing or income                                       | Implemented                          | Approved for current Phase 1 integration profile | Tenant rule required for `REINSURANCE + DEBIT_NOTE_ISSUED`                                      | Finance |
| `PREMIUM_PAYMENT_RECEIVED`        | Premium receipt payment row recorded                | Cash/bank receipt and cedant receivable clearing                                                               | Implemented                          | Approved for current Phase 1 integration profile | Tenant rule required for `REINSURANCE + PREMIUM_PAYMENT_RECEIVED`                               | Finance |
| `PAYMENT_REVERSED`                | Linked premium payment reversal row recorded        | Reverse original premium payment cash/receivable impact                                                        | Implemented                          | Approved for current Phase 1 integration profile | Tenant rule required for `REINSURANCE + PAYMENT_REVERSED`                                       | Finance |
| `CREDIT_NOTE_ISSUED`              | Placement credit note issued                        | Tenant-defined: receivable reduction, reinsurer payable, clearing liability, or other approved treatment       | Implemented for source-event capture | Pending final Finance policy selection           | Tenant rule required for `REINSURANCE + CREDIT_NOTE_ISSUED` before posting succeeds             | Finance |
| `ENDORSEMENT_DEBIT_NOTE_ISSUED`   | Endorsement debit note issued                       | Additional Cedant receivable for endorsement premium adjustment against tenant-defined premium clearing/income | Implemented for source-event capture | Pending final Finance policy confirmation        | Tenant rule required for `REINSURANCE + ENDORSEMENT_DEBIT_NOTE_ISSUED` before posting succeeds  | Finance |
| `ENDORSEMENT_CREDIT_NOTE_ISSUED`  | Endorsement credit note issued                      | Tenant-defined return-premium treatment such as reinsurer payable, receivable reduction or clearing adjustment | Implemented for source-event capture | Pending final Finance policy confirmation        | Tenant rule required for `REINSURANCE + ENDORSEMENT_CREDIT_NOTE_ISSUED` before posting succeeds | Finance |
| `REINSURER_DISBURSEMENT_RECORDED` | Reinsurer outbound payment recorded                 | Recommended: clear recognized reinsurer payable or premium clearing against bank/cash                          | Planned only                         | Pending settlement policy approval               | Do not configure production rule until RSD decisions are approved                               | Finance |
| `REINSURER_DISBURSEMENT_REVERSED` | Linked reinsurer disbursement reversal row recorded | Reverse the original disbursement settlement impact                                                            | Planned only                         | Pending settlement policy approval               | Do not configure production rule until RSD decisions are approved                               | Finance |

## Notes

- Reinsurance publishes business facts only.
- Accounting posting rules own debit/credit lines and GL account selection.
- Missing posting rules, missing subledgers or closed fiscal periods should fail
  Accounting source-event processing without mutating the Reinsurance source
  record or deleting the Reinsurance outbox row.
- Future note-voiding, reinsurer-disbursement and claim events must be added to
  this register before activation.
- Reinsurer disbursement policy is tracked in
  [Reinsurance Settlement Policy Decision Register v1](./reinsurance-settlement-policy-decision-register-v1.md).
