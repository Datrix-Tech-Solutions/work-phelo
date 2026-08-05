# Reinsurance Claims Accounting Approval Form v1

Status: Phase 1 approved baseline

Date: 2026-08-05

Audience: Finance, Product, Claims Operations, Management and Solution
Architecture.

Purpose: provide a compact approval form for the pending Claims Accounting
policy decisions. This form summarizes the Finance Decision Pack and is intended
for sign-off.

Finance/Product approved the Phase 1 Claims Accounting policy on 2026-08-05.
This form records policy approval only; Engineering still activates events one
milestone at a time.

Approved scope: Reinsurance claims between Cedant and Reinsurers through the
Broker. Direct insurance policyholder claims are out of scope.

## 1. Approval Instructions

For each decision:

1. Review the recommended Phase 1 answer.
2. Select an approved option or mark the decision as deferred/rejected.
3. Fill in Approved by, Approval date and Comments.
4. Do not leave implementation-critical decisions ambiguous if Claims Accounting
   activation is expected.

## 2. Highest-Priority Implementation Blockers

These decisions should be answered first because they directly control whether
Claims Accounting events can be implemented safely.

### CLM-002

| Field                      | Response                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------- |
| Plain-language question    | When does the Broker officially owe the Cedant?                                    |
| Recommended Phase 1 answer | When the approved payable amount is approved, with safeguards.                     |
| Alternative options        | When claim is registered; when final loss is entered; only when cash is paid.      |
| Example                    | Claim is reviewed at GHS 100,000 and broker approves GHS 80,000 payable to Cedant. |
| Main business consequence  | Defines when the Cedant liability appears in Accounting.                           |
| Approved option            | Recognize claim payable when the Reinsurer approves the claim.                     |
| Approved by                | Finance/Product                                                                    |
| Approval date              | 2026-08-05                                                                         |
| Comments                   | Implemented through immutable approval version before Accounting event capture.    |

### CLM-003

| Field                      | Response                                                                                  |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| Plain-language question    | Which amount should be recognized as payable?                                             |
| Recommended Phase 1 answer | Approved payable amount.                                                                  |
| Alternative options        | Estimated loss; final loss; approved payable net of expected Reinsurer recoveries.        |
| Example                    | Estimated loss is GHS 120,000, final loss is GHS 100,000, approved payable is GHS 80,000. |
| Main business consequence  | Controls the claim liability amount posted to Accounting.                                 |
| Approved option            | Approved payable amount.                                                                  |
| Approved by                | Finance/Product                                                                           |
| Approval date              | 2026-08-05                                                                                |
| Comments                   | Final loss is validation cap, not the recognized amount unless equal to approval.         |

### CLM-004

| Field                      | Response                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| Plain-language question    | What happens if the approved payable amount changes later?                                             |
| Recommended Phase 1 answer | Require immutable approval/amendment history before later changes post.                                |
| Alternative options        | Block changes after Accounting activation; post increase/reduction adjustments; reverse and reapprove. |
| Example                    | Claim payable approved at GHS 80,000, later revised to GHS 100,000.                                    |
| Main business consequence  | Prevents losing audit history or making posted journals hard to explain.                               |
| Approved option            | Block silent mutation after recognition; future changes require explicit amendment/reversal design.    |
| Approved by                | Finance/Product                                                                                        |
| Approval date              | 2026-08-05                                                                                             |
| Comments                   | Phase 1 creates immutable approval history and does not activate amendment events.                     |

### CLM-005

| Field                      | Response                                                                                |
| -------------------------- | --------------------------------------------------------------------------------------- |
| Plain-language question    | Does issuing a cash call create a Reinsurer receivable?                                 |
| Recommended Phase 1 answer | Tenant-configurable, with memo-only as the safest Phase 1 default.                      |
| Alternative options        | Recognize receivable immediately; keep operational until cash arrives.                  |
| Example                    | Broker issues GHS 25,000 cash call to a Reinsurer, but no cash has been received.       |
| Main business consequence  | Determines whether expected recoveries appear in Accounting before cash arrives.        |
| Approved option            | Deferred for event activation; recovery recognition requires formal agreement/approval. |
| Approved by                | Finance/Product                                                                         |
| Approval date              | 2026-08-05                                                                              |
| Comments                   | Cash-call issue events are not activated in the payable-approval PR.                    |

### CLM-007

| Field                      | Response                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------ |
| Plain-language question    | When a Reinsurer pays a recovery, what does the payment clear?                                         |
| Recommended Phase 1 answer | Tenant-configurable based on the approved cash-call policy.                                            |
| Alternative options        | Clear earlier cash-call receivable; recognize recovery clearing/income directly.                       |
| Example                    | Reinsurer pays GHS 10,000 against a GHS 25,000 cash call.                                              |
| Main business consequence  | Prevents double-counting recovery receivables and cash receipts.                                       |
| Approved option            | Recovery recognition occurs when formally agreed/approved; cash confirmation remains Accounting-owned. |
| Approved by                | Finance/Product                                                                                        |
| Approval date              | 2026-08-05                                                                                             |
| Comments                   | Recovery receipt events remain a later milestone.                                                      |

### CLM-009

| Field                      | Response                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------ |
| Plain-language question    | When the Broker pays the Cedant, what does the payment clear?                        |
| Recommended Phase 1 answer | Approved Cedant claim payable.                                                       |
| Alternative options        | Record claim expense directly at payment; tenant-configurable.                       |
| Example                    | Broker approved GHS 80,000 payable and pays GHS 30,000 to the Cedant.                |
| Main business consequence  | Determines whether settlement clears a liability or creates expense at payment time. |
| Approved option            | Clear approved Cedant claim payable after Accounting bank confirmation.              |
| Approved by                | Finance/Product                                                                      |
| Approval date              | 2026-08-05                                                                           |
| Comments                   | Cedant settlement events remain a later milestone.                                   |

### CLM-011

| Field                      | Response                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| Plain-language question    | Can the Broker pay the Cedant before all Reinsurer recoveries are received?                 |
| Recommended Phase 1 answer | Yes, with broker-funded exposure reported.                                                  |
| Alternative options        | No, require recoveries first; tenant-configurable.                                          |
| Example                    | Cedant paid GHS 100,000, recoveries received GHS 60,000, broker-funded exposure GHS 40,000. |
| Main business consequence  | Determines whether the system supports urgent Cedant settlement before full recovery.       |
| Approved option            | Yes. Partial and early Cedant settlement are supported; outstanding balances remain open.   |
| Approved by                | Finance/Product                                                                             |
| Approval date              | 2026-08-05                                                                                  |
| Comments                   | Broker-funded exposure reporting/workflow remains separate from this PR.                    |

### CLM-016

| Field                      | Response                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Plain-language question    | Is cross-currency Claims accounting supported?                                        |
| Recommended Phase 1 answer | Not until agreed FX fields are persisted. Never use live FX for historical posting.   |
| Alternative options        | No cross-currency support; support with stored agreed FX rate.                        |
| Example                    | Claim is USD 10,000, recovery is received in GHS at an agreed transaction rate.       |
| Main business consequence  | Prevents historical journals from using incorrect or live exchange rates.             |
| Approved option            | Use contractual/agreed persisted FX rate where applicable; never live FX.             |
| Approved by                | Finance/Product                                                                       |
| Approval date              | 2026-08-05                                                                            |
| Comments                   | Event activation requires persisted FX facts where cross-currency claims are allowed. |

### CLM-017

| Field                      | Response                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------- |
| Plain-language question    | How should bank charges and withholding tax be handled for recovery receipts and Cedant settlements? |
| Recommended Phase 1 answer | Not supported until structured fields are added. Accounting must not estimate.                       |
| Alternative options        | Add structured transaction fields; leave manual/out of scope.                                        |
| Example                    | Reinsurer pays GHS 10,000, bank charge is GHS 50, net cash received is GHS 9,950.                    |
| Main business consequence  | Prevents Accounting from guessing charges or withholding tax after the fact.                         |
| Approved option            | Bank charges are Accounting-owned; WHT and NIC levy are not applicable to claim settlements.         |
| Approved by                | Finance/Product                                                                                      |
| Approval date              | 2026-08-05                                                                                           |
| Comments                   | Operations does not allocate GL accounts for bank charges.                                           |

### CLM-018

| Field                      | Response                                                                    |
| -------------------------- | --------------------------------------------------------------------------- |
| Plain-language question    | Which Accounting subledgers are required?                                   |
| Recommended Phase 1 answer | Cedant and Reinsurer subledgers where posting rules use subledger tracking. |
| Alternative options        | Cedant only; generic claims clearing only.                                  |
| Example                    | Cedant is paid GHS 100,000 and Reinsurer reimburses GHS 60,000.             |
| Main business consequence  | Determines whether journals can be traced by Cedant and Reinsurer.          |
| Approved option            | Cedant and Reinsurer subledgers where posting rules use subledger tracking. |
| Approved by                | Finance/Product                                                             |
| Approval date              | 2026-08-05                                                                  |
| Comments                   | Posting rules remain tenant/accounting-admin owned.                         |

## 3. Remaining Decisions

### CLM-001

| Field                      | Response                                                               |
| -------------------------- | ---------------------------------------------------------------------- |
| Plain-language question    | Does simply registering a claim create an Accounting entry?            |
| Recommended Phase 1 answer | No GL posting in Phase 1.                                              |
| Alternative options        | Memorandum-only tracking; reserve journal.                             |
| Example                    | Cedant reports a potential loss of GHS 100,000 before broker approval. |
| Main business consequence  | Prevents posting liabilities before the claim is approved.             |
| Approved option            | No GL posting in Phase 1.                                              |
| Approved by                | Finance/Product                                                        |
| Approval date              | 2026-08-05                                                             |
| Comments                   | Claim registration remains operational/audit only.                     |

### CLM-006

| Field                      | Response                                                                       |
| -------------------------- | ------------------------------------------------------------------------------ |
| Plain-language question    | If a cash call created a receivable, what happens when it is voided?           |
| Recommended Phase 1 answer | Reverse only if the cash-call issue posted; otherwise no posting.              |
| Alternative options        | Always reverse receivable; adjustment only if partly recovered.                |
| Example                    | GHS 25,000 cash call is issued, then voided after claim reallocation.          |
| Main business consequence  | Prevents stale Reinsurer receivables after voided cash calls.                  |
| Approved option            | Reverse only if a previous cash-call issue event posted; otherwise no posting. |
| Approved by                | Finance/Product                                                                |
| Approval date              | 2026-08-05                                                                     |
| Comments                   | Cash-call issue/void events remain deferred.                                   |

### CLM-008

| Field                      | Response                                                             |
| -------------------------- | -------------------------------------------------------------------- |
| Plain-language question    | How should a recovery receipt reversal behave?                       |
| Recommended Phase 1 answer | Reverse the original recovery event.                                 |
| Alternative options        | Correction account; manual journal only.                             |
| Example                    | GHS 10,000 recovery receipt is recorded in error and reversed.       |
| Main business consequence  | Preserves a clean audit trail between original receipt and reversal. |
| Approved option            | Reverse the original recovery event.                                 |
| Approved by                | Finance/Product                                                      |
| Approval date              | 2026-08-05                                                           |
| Comments                   | Recovery events remain deferred.                                     |

### CLM-010

| Field                      | Response                                                           |
| -------------------------- | ------------------------------------------------------------------ |
| Plain-language question    | How should a Cedant settlement reversal behave?                    |
| Recommended Phase 1 answer | Reverse the original settlement event.                             |
| Alternative options        | Correction account; manual journal only.                           |
| Example                    | GHS 30,000 Cedant settlement is reversed after bank correction.    |
| Main business consequence  | Keeps settlement correction traceable without overwriting history. |
| Approved option            | Reverse the original settlement event.                             |
| Approved by                | Finance/Product                                                    |
| Approval date              | 2026-08-05                                                         |
| Comments                   | Settlement events remain deferred.                                 |

### CLM-012

| Field                      | Response                                                                             |
| -------------------------- | ------------------------------------------------------------------------------------ |
| Plain-language question    | Should broker-funded exposure create a separate journal or only appear in reporting? |
| Recommended Phase 1 answer | Reporting only in Phase 1.                                                           |
| Alternative options        | No separate event; create journal when exposure exists.                              |
| Example                    | Cedant paid GHS 100,000, recoveries received GHS 60,000, exposure is GHS 40,000.     |
| Main business consequence  | Avoids double-counting while still showing broker funding exposure.                  |
| Approved option            | Reporting only in Phase 1.                                                           |
| Approved by                | Finance/Product                                                                      |
| Approval date              | 2026-08-05                                                                           |
| Comments                   | No separate broker-funded exposure event in this PR.                                 |

### CLM-013

| Field                      | Response                                                                  |
| -------------------------- | ------------------------------------------------------------------------- |
| Plain-language question    | Are claim reserves part of Version 1?                                     |
| Recommended Phase 1 answer | Out of scope for Phase 1.                                                 |
| Alternative options        | Post reserves when claim is marked reserved; post reserves on final loss. |
| Example                    | Claim reserve expected at GHS 120,000 before final approval.              |
| Main business consequence  | Avoids reserve journals until reserve policy and adjustment rules exist.  |
| Approved option            | Out of scope for Phase 1.                                                 |
| Approved by                | Finance/Product                                                           |
| Approval date              | 2026-08-05                                                                |
| Comments                   | No claim reserve event is activated.                                      |

### CLM-014

| Field                      | Response                                                                    |
| -------------------------- | --------------------------------------------------------------------------- |
| Plain-language question    | Should claim closure create an Accounting entry?                            |
| Recommended Phase 1 answer | No GL posting by default.                                                   |
| Alternative options        | Write-off only; reserve release only.                                       |
| Example                    | Fully handled claim is marked Closed after operational completion.          |
| Main business consequence  | Prevents duplicate posting from a lifecycle milestone.                      |
| Approved option            | No GL posting by default.                                                   |
| Approved by                | Finance/Product                                                             |
| Approval date              | 2026-08-05                                                                  |
| Comments                   | Claim closure is financial state/reporting unless write-off policy applies. |

### CLM-015

| Field                      | Response                                                                       |
| -------------------------- | ------------------------------------------------------------------------------ |
| Plain-language question    | How should claim write-offs be handled?                                        |
| Recommended Phase 1 answer | Manual journal voucher until a dedicated write-off record exists.              |
| Alternative options        | Not supported; future write-off source record.                                 |
| Example                    | GHS 5,000 remains unrecovered and Finance approves a write-off.                |
| Main business consequence  | Keeps write-offs accountant-approved and auditable.                            |
| Approved option            | Manual JV until approved write-off workflow/source record exists.              |
| Approved by                | Finance/Product                                                                |
| Approval date              | 2026-08-05                                                                     |
| Comments                   | Write-off thresholds and approval workflow remain Finance-owned future detail. |

## 4. Approval Summary

Complete this summary after reviewing CLM-001 through CLM-018.

| Status        | Decision IDs                                                                                                                                            |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Approved      | CLM-001, CLM-002, CLM-003, CLM-004, CLM-006, CLM-007, CLM-008, CLM-009, CLM-010, CLM-011, CLM-012, CLM-013, CLM-014, CLM-015, CLM-016, CLM-017, CLM-018 |
| Rejected      | None                                                                                                                                                    |
| Deferred      | CLM-005 event activation                                                                                                                                |
| Still pending | Write-off thresholds and detailed approval workflow for future dedicated write-off source records                                                       |

## 5. Implementation Readiness

Approvals unlock implementation groups as follows. These groups still require
Engineering implementation, tenant posting rules, reconciliation views and
validation before activation.

| Group   | Events unblocked                                                       | Required approvals                                                                       |
| ------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Group A | `CLAIM_PAYABLE_APPROVED`                                               | CLM-002, CLM-003, CLM-004                                                                |
| Group B | `CLAIM_CEDANT_SETTLEMENT_RECORDED`, `CLAIM_CEDANT_SETTLEMENT_REVERSED` | CLM-002, CLM-003, CLM-004, CLM-009, CLM-010, CLM-011, CLM-012, CLM-016, CLM-017, CLM-018 |
| Group C | `CLAIM_CASH_CALL_ISSUED`, `CLAIM_CASH_CALL_VOIDED`                     | CLM-005, CLM-006, CLM-016, CLM-017, CLM-018                                              |
| Group D | `CLAIM_RECOVERY_RECEIPT_RECORDED`, `CLAIM_RECOVERY_RECEIPT_REVERSED`   | CLM-005, CLM-007, CLM-008, CLM-016, CLM-017, CLM-018                                     |

Non-posting decisions:

- `CLAIM_REGISTERED` remains non-posting unless CLM-001 is approved otherwise.
- `CLAIM_CLOSED` remains non-posting unless CLM-014 or CLM-015 is approved
  otherwise.

## 6. Final Confirmation

By signing this form, Finance/Product confirms that selected policy decisions
may be used by Engineering to design and implement the next Claims Accounting
milestones.

Overall approval by:

Role:

Date:

Comments:

## 7. Source Document

This approval form summarizes:

- [Reinsurance Claims Accounting Finance Decision Pack v1](./reinsurance-claims-accounting-finance-decision-pack-v1.md)

Use the full decision pack for detailed explanation and risk context.
