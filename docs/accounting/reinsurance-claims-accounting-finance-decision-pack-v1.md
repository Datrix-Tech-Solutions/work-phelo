# Reinsurance Claims Accounting Finance Decision Pack v1

Status: Phase 1 approved policy baseline

Date: 2026-08-05

Audience: Finance, Product, Claims Operations, Management and Solution
Architecture.

Purpose: convert the technical Claims Accounting audit into plain-language
business decisions that must be approved before WorkPhelo activates Claims
accounting journals.

Finance/Product approved the Phase 1 Claims Accounting policy on 2026-08-05.
Engineering still activates events incrementally; this PR activates only
`CLAIM_PAYABLE_APPROVED`.

## 1. Executive Summary

The Reinsurance Claims operational workflow already exists. Brokers can register
claims, calculate claim allocations from the effective participation as of the
loss date, issue cash calls, record recoveries from reinsurers, approve amounts
payable to cedants, pay cedants, and record reversal corrections.

The accounting integration is intentionally paused. The system has the backend
records needed to support future accounting events, but Finance policy has not
yet approved when those records should become journals.

Engineering will not activate Claims journals from assumptions. The remaining
work is a policy decision exercise first, then an implementation exercise.

The key principle is simple:

Claims accounting must come from approved, durable business records, not from
screen totals, draft records, or workflow guesses.

## 2. Plain-Language Claims Cash Flow

A typical Reinsurance claim flow looks like this:

```text
Claim occurs
  -> Broker reviews and finalizes claim amount
  -> Broker approves the amount payable to the Cedant
  -> Broker may issue cash calls to Reinsurers
  -> Reinsurers pay recoveries to Broker
  -> Broker pays Cedant
  -> Corrections use reversal records
```

There are two separate cash directions:

| Direction           | Plain meaning          | Example                                                            |
| ------------------- | ---------------------- | ------------------------------------------------------------------ |
| Reinsurer -> Broker | Claim recovery receipt | A reinsurer pays GHS 60,000 to the broker after a claim cash call. |
| Broker -> Cedant    | Claim settlement       | The broker pays GHS 100,000 to the cedant for the approved claim.  |

These must never be confused with premium payments. Premium payments are about
policy premium collection and settlement. Claim payments are about loss
settlement and recovery.

## 3. Decisions Required

### CLM-001: Does simply registering a claim create an Accounting entry?

Question: When a claim is first registered, should Accounting create a journal?

Example: A cedant reports a potential loss of GHS 100,000. The broker has not
yet approved the loss or confirmed what is payable.

Why it matters: A claim notification is not necessarily an approved debt. Posting
too early could overstate liabilities.

| Area                  | Detail                                                                                                                                    |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Available options     | No posting; memorandum-only tracking; create a reserve journal.                                                                           |
| Advantages            | No posting avoids premature liabilities. Memorandum tracking improves visibility. Reserve journals support advanced insurance accounting. |
| Disadvantages         | No posting means Finance does not see claim exposure in the ledger. Reserve journals require a reserve policy that does not yet exist.    |
| Recommended option    | No GL posting in Phase 1.                                                                                                                 |
| Operational effect    | Claims teams can register and track claims normally.                                                                                      |
| Accounting effect     | No journal is created from registration alone.                                                                                            |
| Implementation effect | Keep claim registration outside accounting activation.                                                                                    |
| Decision owner        | Finance/Product                                                                                                                           |
| Decision status       | Pending                                                                                                                                   |
| Approval date         |                                                                                                                                           |
| Comments              | Recommended because a claim notification is not an approved payable.                                                                      |

### CLM-002: When does the Broker officially owe the Cedant?

Question: Which business event makes the broker liable to the cedant?

Example: A claim is registered at GHS 100,000, reviewed, and the broker approves
GHS 80,000 as payable to the cedant.

Why it matters: This defines when the cedant payable appears in Accounting.

| Area                  | Detail                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Available options     | When claim is registered; when final loss is entered; when approved payable amount is approved; only when cash is paid. |
| Advantages            | Using approved payable amount matches a deliberate broker approval. Paying-cash-only is simple.                         |
| Disadvantages         | Registration/final loss can post before approval. Cash-only hides liabilities until payment.                            |
| Recommended option    | Recognize the payable when the approved payable amount is approved, subject to approval-history safeguards.             |
| Operational effect    | Claims can be reviewed before liability recognition.                                                                    |
| Accounting effect     | A cedant payable can be recognized before payment.                                                                      |
| Implementation effect | Requires safe handling of later approval changes.                                                                       |
| Decision owner        | Finance                                                                                                                 |
| Decision status       | Pending                                                                                                                 |
| Approval date         |                                                                                                                         |
| Comments              | This is the preferred recognition point but needs Finance approval.                                                     |

### CLM-003: Which amount should be recognized as payable?

Question: Once the broker owes the cedant, which amount should Accounting use?

Example: Estimated loss is GHS 120,000, final loss is GHS 100,000, and approved
payable amount is GHS 80,000.

Why it matters: The selected amount controls the liability recorded in the
ledger.

| Area                  | Detail                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| Available options     | Estimated loss; final loss; approved payable amount; approved payable net of expected reinsurer recoveries. |
| Advantages            | Approved payable amount matches management's approved obligation.                                           |
| Disadvantages         | Netting expected recoveries can hide gross obligations. Estimated loss can overstate liability.             |
| Recommended option    | Use approved payable amount.                                                                                |
| Operational effect    | Claims Operations must approve the payable amount before accounting recognition.                            |
| Accounting effect     | Liability equals the approved amount, not the estimate.                                                     |
| Implementation effect | Accounting event uses the approved payable amount as the source amount.                                     |
| Decision owner        | Finance                                                                                                     |
| Decision status       | Pending                                                                                                     |
| Approval date         |                                                                                                             |
| Comments              | Recommended because it is explicit and approved.                                                            |

### CLM-004: What happens if the approved payable amount changes later?

Question: How should Accounting handle a later change to an already approved
payable amount?

Example: A claim is approved at GHS 80,000, then revised to GHS 100,000.

Why it matters: Changing an approved amount after posting can lose audit history
if not handled through a controlled adjustment.

| Area                  | Detail                                                                                                                            |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Available options     | Block changes after accounting activation; record an immutable amendment; create an additional adjustment; reverse and reapprove. |
| Advantages            | Immutable amendments preserve audit history. Blocking changes is safest but less flexible.                                        |
| Disadvantages         | Silent overwrites can make prior journals impossible to explain. Reverse-and-reapprove can be operationally heavy.                |
| Recommended option    | Require immutable approval/amendment history before later changes can post.                                                       |
| Operational effect    | Claims teams can still request changes, but accounting-impacting changes need a traceable amendment.                              |
| Accounting effect     | Later changes post as adjustments, not mutations.                                                                                 |
| Implementation effect | A future safeguard or amendment record is required before activation.                                                             |
| Decision owner        | Finance/Engineering                                                                                                               |
| Decision status       | Pending                                                                                                                           |
| Approval date         |                                                                                                                                   |
| Comments              | This is the main blocker for activating payable approval safely.                                                                  |

### CLM-005: Does issuing a cash call mean the Reinsurer already owes the Broker in Accounting?

Question: Should an issued cash call immediately create a receivable from the
reinsurer?

Example: The broker issues a GHS 25,000 cash call to a reinsurer. No cash has
been received yet.

Why it matters: This decides whether Accounting recognizes a reinsurer
receivable at issue or waits until cash arrives.

| Area                  | Detail                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Available options     | Recognize receivable immediately; keep it operational until cash arrives; make it tenant-configurable.                                |
| Advantages            | Immediate receivable shows expected recovery. Memo-only avoids posting before cash. Tenant configuration supports different policies. |
| Disadvantages         | Immediate receivable can overstate collectible amounts. Memo-only hides expected recoveries from the ledger.                          |
| Recommended option    | Tenant-configurable, with memo-only as the safest Phase 1 default.                                                                    |
| Operational effect    | Cash calls can still be issued and tracked.                                                                                           |
| Accounting effect     | No default journal from cash-call issue unless Finance approves receivable recognition.                                               |
| Implementation effect | Do not activate cash-call issue posting until policy is approved.                                                                     |
| Decision owner        | Finance                                                                                                                               |
| Decision status       | Pending                                                                                                                               |
| Approval date         |                                                                                                                                       |
| Comments              | This is a policy decision, not a technical limitation.                                                                                |

### CLM-006: If a cash call created a receivable, what happens when it is voided?

Question: If Accounting posts a receivable when a cash call is issued, how should
Accounting treat a later void?

Example: A GHS 25,000 cash call is issued and then voided because the claim was
reallocated.

Why it matters: A void must not leave a stale receivable in the ledger.

| Area                  | Detail                                                                     |
| --------------------- | -------------------------------------------------------------------------- |
| Available options     | Reverse the receivable; no posting; adjustment only if partly recovered.   |
| Advantages            | Reversal keeps Accounting aligned with the voided business record.         |
| Disadvantages         | If issue was memo-only, reversal would create a false accounting event.    |
| Recommended option    | Reverse only if cash-call issue posted a receivable; otherwise no posting. |
| Operational effect    | Voiding remains available when allowed by claim recovery rules.            |
| Accounting effect     | Voids clean up prior receivables only when they exist.                     |
| Implementation effect | Cash-call void event depends on the cash-call issue policy.                |
| Decision owner        | Finance                                                                    |
| Decision status       | Pending                                                                    |
| Approval date         |                                                                            |
| Comments              | This decision follows CLM-005.                                             |

### CLM-007: When a Reinsurer pays a recovery, what does the payment clear?

Question: When cash is received from a reinsurer, which accounting balance does
it reduce or recognize?

Example: A reinsurer pays GHS 10,000 against a GHS 25,000 cash call.

Why it matters: The answer depends on whether a receivable was created when the
cash call was issued.

| Area                  | Detail                                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------- |
| Available options     | Clear earlier cash-call receivable; recognize recovery clearing/income directly; make it tenant-configurable. |
| Advantages            | Clearing a receivable is clean if cash calls post. Direct recognition is simpler if cash calls are memo-only. |
| Disadvantages         | Wrong selection could double count recovery or miss receivable clearing.                                      |
| Recommended option    | Tenant-configurable; depends on the approved cash-call issue policy.                                          |
| Operational effect    | Recovery receipts remain recorded against issued cash calls.                                                  |
| Accounting effect     | Cash receipt posts according to the selected recovery policy.                                                 |
| Implementation effect | Recovery receipt event can be activated after policy approval.                                                |
| Decision owner        | Finance                                                                                                       |
| Decision status       | Pending                                                                                                       |
| Approval date         |                                                                                                               |
| Comments              | This is one of the strongest candidates for Phase 1 after policy approval.                                    |

### CLM-008: How should a recovery receipt reversal behave?

Question: How should Accounting reverse a previously recorded reinsurer recovery
receipt?

Example: A GHS 10,000 recovery receipt was recorded in error and reversed.

Why it matters: Reversals must preserve the original record and create a clear
counter-event.

| Area                  | Detail                                                                       |
| --------------------- | ---------------------------------------------------------------------------- |
| Available options     | Reverse the original receipt; use a correction account; manual journal only. |
| Advantages            | Reversing the original event gives the clearest audit trail.                 |
| Disadvantages         | Manual journals are flexible but can break automated reconciliation.         |
| Recommended option    | Reverse the original recovery event.                                         |
| Operational effect    | Original receipt remains visible; reversal record explains the correction.   |
| Accounting effect     | Accounting creates a linked reversal journal.                                |
| Implementation effect | Activate only after recovery receipt posting is active.                      |
| Decision owner        | Finance                                                                      |
| Decision status       | Pending                                                                      |
| Approval date         |                                                                              |
| Comments              | Recommended to match existing reversal principles.                           |

### CLM-009: When the Broker pays the Cedant, what does the payment clear?

Question: When the broker pays the cedant for a claim, should that payment clear
an approved payable or create expense directly?

Example: Broker approved GHS 80,000 payable and later pays GHS 30,000 to the
cedant.

Why it matters: This defines whether liabilities are visible before cash is paid.

| Area                  | Detail                                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| Available options     | Clear approved cedant claim payable; record claim expense directly at payment; make it tenant-configurable. |
| Advantages            | Clearing a payable gives better liability visibility. Direct expense-at-payment is simple.                  |
| Disadvantages         | Direct expense-at-payment hides unpaid obligations.                                                         |
| Recommended option    | Clear approved cedant claim payable after CLM-002 is approved.                                              |
| Operational effect    | Cedant settlement can be partial or full.                                                                   |
| Accounting effect     | Payment reduces approved payable and bank/cash.                                                             |
| Implementation effect | Settlement event should follow payable approval event.                                                      |
| Decision owner        | Finance                                                                                                     |
| Decision status       | Pending                                                                                                     |
| Approval date         |                                                                                                             |
| Comments              | Recommended Phase 1 path.                                                                                   |

### CLM-010: How should a Cedant settlement reversal behave?

Question: How should Accounting reverse a previously recorded broker-to-cedant
settlement?

Example: A GHS 30,000 cedant settlement is reversed due to bank correction.

Why it matters: Reversal must not overwrite the original settlement record.

| Area                  | Detail                                                                      |
| --------------------- | --------------------------------------------------------------------------- |
| Available options     | Reverse original settlement; use correction account; manual journal only.   |
| Advantages            | Reversing the original settlement keeps source and journal history aligned. |
| Disadvantages         | Manual journal-only correction weakens automated traceability.              |
| Recommended option    | Reverse the original settlement event.                                      |
| Operational effect    | Original settlement remains historical; reversal is linked.                 |
| Accounting effect     | Accounting creates a linked reversal journal.                               |
| Implementation effect | Activate after cedant settlement posting is active.                         |
| Decision owner        | Finance                                                                     |
| Decision status       | Pending                                                                     |
| Approval date         |                                                                             |
| Comments              | Recommended to match the immutable reversal standard.                       |

### CLM-011: Can the Broker pay the Cedant before all Reinsurer recoveries are received?

Question: May the broker settle the cedant before receiving all recovery cash
from reinsurers?

Example: Cedant paid GHS 100,000. Recoveries received are GHS 60,000. Broker
funded exposure is GHS 40,000.

Why it matters: This determines whether the system permits and reports broker
funding exposure.

| Area                  | Detail                                                                                               |
| --------------------- | ---------------------------------------------------------------------------------------------------- |
| Available options     | Yes, allow broker-funded exposure; no, require recoveries first; make it tenant-configurable.        |
| Advantages            | Allowing it supports real claim settlement urgency. Requiring recoveries first reduces funding risk. |
| Disadvantages         | Allowing it creates temporary broker funding exposure. Blocking it may delay cedant settlement.      |
| Recommended option    | Allow it, with broker-funded exposure shown in reporting.                                            |
| Operational effect    | Broker can pay cedant before full reinsurer recovery.                                                |
| Accounting effect     | Settlement posts independently from recoveries.                                                      |
| Implementation effect | Reporting should show recovered, settled and broker-funded exposure separately.                      |
| Decision owner        | Finance/Product                                                                                      |
| Decision status       | Pending                                                                                              |
| Approval date         |                                                                                                      |
| Comments              | Current operations already support settlement independent of recovery.                               |

### CLM-012: Should broker-funded exposure create a separate journal or only appear in reporting?

Question: Should the difference between cedant paid and reinsurer recoveries
received become its own accounting event?

Example: Cedant paid GHS 100,000; recovery received GHS 60,000; exposure is GHS
40,000.

Why it matters: A separate journal could make exposure visible, but may also
double count if not carefully designed.

| Area                  | Detail                                                                                |
| --------------------- | ------------------------------------------------------------------------------------- |
| Available options     | No separate event; create a journal when exposure exists; reporting only.             |
| Advantages            | Reporting-only avoids duplicate accounting. A separate event gives strong visibility. |
| Disadvantages         | Separate event requires a precise accounting policy and reversal behavior.            |
| Recommended option    | Reporting only for Phase 1.                                                           |
| Operational effect    | Teams can monitor funding exposure without extra posting.                             |
| Accounting effect     | No separate broker-funded exposure journal in Phase 1.                                |
| Implementation effect | Exposure appears in claim recovery/settlement reporting.                              |
| Decision owner        | Finance                                                                               |
| Decision status       | Pending                                                                               |
| Approval date         |                                                                                       |
| Comments              | Defer journal treatment until Finance approves a specific policy.                     |

### CLM-013: Are claim reserves part of Version 1?

Question: Should expected claim liabilities before final approval be posted as
reserves?

Example: A claim is reserved at GHS 120,000 while the final payable amount is
still under review.

Why it matters: Reserve accounting is useful but requires a formal reserving
policy and adjustment rules.

| Area                  | Detail                                                                                  |
| --------------------- | --------------------------------------------------------------------------------------- |
| Available options     | Out of scope; post reserves when claim is marked reserved; post reserves on final loss. |
| Advantages            | Out of scope keeps Phase 1 safer. Reserve posting improves financial exposure tracking. |
| Disadvantages         | Reserve posting needs more policy, controls and adjustment handling.                    |
| Recommended option    | Out of scope for Phase 1.                                                               |
| Operational effect    | Claims teams can still mark operational reserve statuses.                               |
| Accounting effect     | No reserve journals in Phase 1.                                                         |
| Implementation effect | Do not activate reserve events yet.                                                     |
| Decision owner        | Finance                                                                                 |
| Decision status       | Pending                                                                                 |
| Approval date         |                                                                                         |
| Comments              | This can become a later Claims Accounting phase.                                        |

### CLM-014: Should claim closure create an Accounting entry?

Question: When a claim is closed, should Accounting create a journal?

Example: A settled claim is marked closed after all operational work is done.

Why it matters: Closure is a workflow milestone, not necessarily a new financial
fact.

| Area                  | Detail                                                                               |
| --------------------- | ------------------------------------------------------------------------------------ |
| Available options     | No posting; write-off only; reserve release only.                                    |
| Advantages            | No posting avoids duplicate accounting if all payments and reversals already posted. |
| Disadvantages         | Closure may hide unresolved write-off needs if not reported elsewhere.               |
| Recommended option    | No GL posting by default.                                                            |
| Operational effect    | Closing a claim remains an operational completion step.                              |
| Accounting effect     | No journal from closure alone.                                                       |
| Implementation effect | Claim close remains non-posting in Phase 1.                                          |
| Decision owner        | Finance                                                                              |
| Decision status       | Pending                                                                              |
| Approval date         |                                                                                      |
| Comments              | Write-offs or reserve releases should be separate records if needed.                 |

### CLM-015: How should claim write-offs be handled?

Question: If a claim balance cannot be recovered or settled as expected, how
should the write-off be recorded?

Example: GHS 5,000 remains unrecovered and Finance approves a write-off.

Why it matters: Write-offs require accountant approval and clear audit history.

| Area                  | Detail                                                                                       |
| --------------------- | -------------------------------------------------------------------------------------------- |
| Available options     | Not supported; future write-off record; manual journal voucher.                              |
| Advantages            | Manual JV works today. A future write-off record gives better operational traceability.      |
| Disadvantages         | Manual JV is less connected to claim workflow. New write-off records require implementation. |
| Recommended option    | Manual JV until a dedicated write-off record exists; future source record later.             |
| Operational effect    | Claims teams should escalate write-offs to Finance.                                          |
| Accounting effect     | Write-off posted manually until automated support exists.                                    |
| Implementation effect | Do not activate automated write-off events in Phase 1.                                       |
| Decision owner        | Finance/Engineering                                                                          |
| Decision status       | Pending                                                                                      |
| Approval date         |                                                                                              |
| Comments              | Needs a separate write-off design.                                                           |

### CLM-016: Is cross-currency Claims accounting supported?

Question: Can a claim be in one currency while recovery or settlement happens in
another currency?

Example: Claim is USD 10,000. Recovery is received in GHS at an agreed rate.

Why it matters: Historical accounting must use the agreed business rate, not a
live rate fetched later.

| Area                  | Detail                                                                                                   |
| --------------------- | -------------------------------------------------------------------------------------------------------- |
| Available options     | Not supported now; supported only with stored agreed FX rate; use live FX rates.                         |
| Advantages            | Stored agreed FX rate creates audit-proof history.                                                       |
| Disadvantages         | Cross-currency support needs additional fields and validation. Live FX is unsafe for historical posting. |
| Recommended option    | Not supported until agreed FX fields are persisted. Never use live FX for historical posting.            |
| Operational effect    | Phase 1 claim cash movements should remain in claim currency.                                            |
| Accounting effect     | No FX journals from claims in Phase 1.                                                                   |
| Implementation effect | Add agreed FX fields before cross-currency activation.                                                   |
| Decision owner        | Finance/Engineering                                                                                      |
| Decision status       | Pending                                                                                                  |
| Approval date         |                                                                                                          |
| Comments              | This follows the broader WorkPhelo financial integration standard.                                       |

### CLM-017: How should bank charges and withholding tax be handled?

Question: Should bank charges and withholding tax on claim recoveries or
settlements be posted from structured transaction fields?

Example: Reinsurer pays GHS 10,000, bank charges GHS 50, net cash received GHS
9,950.

Why it matters: Accounting cannot safely estimate charges or withholding after
the fact.

| Area                  | Detail                                                                             |
| --------------------- | ---------------------------------------------------------------------------------- |
| Available options     | Not supported now; add structured transaction fields; Accounting estimates values. |
| Advantages            | Structured fields preserve facts. Not supporting them avoids invented values.      |
| Disadvantages         | Without fields, Phase 1 cannot automate charges or withholding.                    |
| Recommended option    | Not supported until structured fields are added. Accounting must not estimate.     |
| Operational effect    | Claims teams should not expect automated charge/tax posting in Phase 1.            |
| Accounting effect     | Bank charges and withholding tax remain manual or out of scope.                    |
| Implementation effect | Add fields only if Finance approves automated treatment.                           |
| Decision owner        | Finance/Engineering                                                                |
| Decision status       | Pending                                                                            |
| Approval date         |                                                                                    |
| Comments              | Same rule applies to both recovery receipts and cedant settlements.                |

### CLM-018: Which Accounting subledgers are required?

Question: Which counterparty ledgers are required for claim accounting?

Example: A cedant is paid GHS 100,000 and a reinsurer reimburses GHS 60,000.

Why it matters: Claims involve both cedant obligations and reinsurer recoveries.

| Area                  | Detail                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| Available options     | Cedant and reinsurer subledgers; cedant only; generic claims clearing only.                           |
| Advantages            | Cedant and reinsurer subledgers provide clear counterparty traceability. Generic clearing is simpler. |
| Disadvantages         | More subledgers require better master-data setup. Generic clearing loses detail.                      |
| Recommended option    | Cedant and reinsurer subledgers where posting rules require subledger tracking.                       |
| Operational effect    | Counterparty setup must be accurate.                                                                  |
| Accounting effect     | Journals can be traced to cedants and reinsurers.                                                     |
| Implementation effect | Posting rules should reference correct subledger types.                                               |
| Decision owner        | Finance/Accounting Admin                                                                              |
| Decision status       | Pending                                                                                               |
| Approval date         |                                                                                                       |
| Comments              | Tenant posting rules decide exact account and subledger usage.                                        |

## 4. Recommended Phase 1 Policy

These are recommendations only. They are not approved policies yet.

| Area                                   | Recommended Phase 1 policy                                              |
| -------------------------------------- | ----------------------------------------------------------------------- |
| Claim registration                     | No GL posting.                                                          |
| Claim payable recognition              | Recognize at approved payable amount approval.                          |
| Recognized amount                      | Use approved payable amount.                                            |
| Approval changes                       | Require immutable approval/amendment history before later changes post. |
| Cash-call issue                        | Memo-only by default until Finance approves receivable recognition.     |
| Recovery receipt                       | Financial event when cash is received.                                  |
| Recovery reversal                      | Reverse original recovery event.                                        |
| Cedant settlement                      | Clear approved cedant payable.                                          |
| Cedant settlement reversal             | Reverse original settlement event.                                      |
| Cedant settlement before full recovery | Allowed, with broker-funded exposure reported.                          |
| Broker-funded exposure                 | Reporting only; no separate journal in Phase 1.                         |
| Claim reserves                         | Out of scope for Phase 1.                                               |
| Claim closure                          | No GL posting by default.                                               |
| Write-offs                             | Manual journal voucher until a dedicated write-off record exists.       |
| Cross-currency claims                  | Not supported until agreed FX fields are persisted.                     |
| Bank charges/withholding tax           | Unsupported until structured fields are added.                          |
| Subledgers                             | Cedant and reinsurer subledgers required where posting rules use them.  |

## 5. Risk Assessment

Activating claim accounting without these decisions creates the following risks:

| Risk                             | Business impact                                                                               |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| Overstating claim liabilities    | Finance may report obligations before the broker has approved them.                           |
| Understating claim liabilities   | Finance may miss approved obligations until cash is paid.                                     |
| Recognizing receivables twice    | Cash-call receivable and recovery receipt could both create the same recovery effect.         |
| Incorrect cedant clearing        | Cedant payments may not clear the intended liability.                                         |
| Incorrect recovery income        | Recoveries may be posted as income, receivable clearing, or clearing movement inconsistently. |
| Lost approval history            | Changing approved amounts without amendment records can make journals hard to audit.          |
| Incorrect FX treatment           | Historical claims could be posted using wrong or live exchange rates.                         |
| Inconsistent tenant behavior     | Different tenants may post claims differently without clear policy and posting templates.     |
| Weak reversal and reconciliation | Corrections may not link back to original journals.                                           |
| Future migration complexity      | Activating too early may require difficult cleanup later.                                     |

## 6. Implementation Path After Approval

Recommended sequence:

```text
Finance/Product approval
  -> immutable claim payable approval history/domain safeguard
  -> CLAIM_PAYABLE_APPROVED
  -> CLAIM_CEDANT_SETTLEMENT_RECORDED
  -> CLAIM_CEDANT_SETTLEMENT_REVERSED
  -> cash-call policy approval
  -> CLAIM_CASH_CALL_ISSUED / CLAIM_CASH_CALL_VOIDED if posting
  -> CLAIM_RECOVERY_RECEIPT_RECORDED
  -> CLAIM_RECOVERY_RECEIPT_REVERSED
```

Claim registration and claim closure remain non-posting in Phase 1.

### Phase 1 Claim Payable Approval Scope

Phase 1 records one claim-level payable approval after the broker confirms that
the required reinsurer approvals have been obtained externally:

```text
Claim
  -> Claim Payable Approval
  -> Accounting
```

It does not record one approval per participating reinsurer. Allocation-level
approval remains future work:

```text
Claim
  -> Allocation Approval
  -> Derived Claim Payable Approval
```

## 7. Approval Matrix

| Decision ID | Plain-language decision                                  | Recommended option                                                                                | Owner               | Status             | Approved by     | Approval date | Comments                                          |
| ----------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------- | ------------------ | --------------- | ------------- | ------------------------------------------------- |
| CLM-001     | Does registering a claim create an Accounting entry?     | No GL posting in Phase 1.                                                                         | Finance/Product     | Approved           | Finance/Product | 2026-08-05    | Reinsurance claims only.                          |
| CLM-002     | When does the Broker officially owe the Cedant?          | When the broker confirms the claim-level payable after required reinsurer approvals are obtained. | Finance/Product     | Approved           | Finance/Product | 2026-08-05    | Activates `CLAIM_PAYABLE_APPROVED`.               |
| CLM-003     | Which amount should be recognized as payable?            | Approved payable amount.                                                                          | Finance/Product     | Approved           | Finance/Product | 2026-08-05    | Final loss remains the validation cap.            |
| CLM-004     | What happens if approved payable changes later?          | Require immutable amendment history before later changes post.                                    | Finance/Product     | Approved           | Finance/Product | 2026-08-05    | Phase 1 blocks silent mutation after recognition. |
| CLM-005     | Does issuing a cash call create a reinsurer receivable?  | Deferred; recovery recognition requires formal agreement/approval.                                | Finance/Product     | Deferred           | Finance/Product | 2026-08-05    | Cash-call events are not activated in this PR.    |
| CLM-006     | If a posted cash call is voided, what happens?           | Reverse only if issue posted; otherwise no posting.                                               | Finance/Product     | Approved principle | Finance/Product | 2026-08-05    | Event deferred.                                   |
| CLM-007     | When reinsurer recovery is received, what does it clear? | Recovery recognition occurs when formally agreed/approved.                                        | Finance/Product     | Approved principle | Finance/Product | 2026-08-05    | Event deferred.                                   |
| CLM-008     | How should recovery receipt reversal behave?             | Reverse original recovery event.                                                                  | Finance/Product     | Approved principle | Finance/Product | 2026-08-05    | Event deferred.                                   |
| CLM-009     | When Broker pays Cedant, what does payment clear?        | Approved cedant claim payable after Accounting bank confirmation.                                 | Finance/Product     | Approved principle | Finance/Product | 2026-08-05    | Event deferred.                                   |
| CLM-010     | How should Cedant settlement reversal behave?            | Reverse original settlement event.                                                                | Finance/Product     | Approved principle | Finance/Product | 2026-08-05    | Event deferred.                                   |
| CLM-011     | Can Broker pay Cedant before all recovery is received?   | Yes, with outstanding balances remaining open.                                                    | Finance/Product     | Approved           | Finance/Product | 2026-08-05    | Broker-funded exposure workflow remains separate. |
| CLM-012     | Should broker-funded exposure create a separate journal? | Reporting only in Phase 1.                                                                        | Finance             | Pending            |                 |               |                                                   |
| CLM-013     | Are claim reserves part of Version 1?                    | Out of scope.                                                                                     | Finance             | Pending            |                 |               |                                                   |
| CLM-014     | Should claim closure create an Accounting entry?         | No GL posting by default.                                                                         | Finance             | Pending            |                 |               |                                                   |
| CLM-015     | How should claim write-offs be handled?                  | Manual JV until dedicated write-off record exists.                                                | Finance/Engineering | Pending            |                 |               |                                                   |
| CLM-016     | Is cross-currency Claims accounting supported?           | Use persisted contractual/agreed FX; never live FX.                                               | Finance/Product     | Approved           | Finance/Product | 2026-08-05    | Event activation requires persisted FX facts.     |
| CLM-017     | How should bank charges and withholding tax be handled?  | Bank charges are Accounting-owned; WHT/NIC not applicable.                                        | Finance/Product     | Approved           | Finance/Product | 2026-08-05    | Operations does not allocate GL accounts.         |
| CLM-018     | Which Accounting subledgers are required?                | Cedant and reinsurer subledgers where posting rules use them.                                     | Finance/Product     | Approved           | Finance/Product | 2026-08-05    | Tenant posting rules decide usage.                |

## 8. Quick Approval Form

Finance/Product can complete this section directly.

### CLM-001

Approved option:

Approved by:

Date:

Comments:

### CLM-002

Approved option:

Approved by:

Date:

Comments:

### CLM-003

Approved option:

Approved by:

Date:

Comments:

### CLM-004

Approved option:

Approved by:

Date:

Comments:

### CLM-005

Approved option:

Approved by:

Date:

Comments:

### CLM-006

Approved option:

Approved by:

Date:

Comments:

### CLM-007

Approved option:

Approved by:

Date:

Comments:

### CLM-008

Approved option:

Approved by:

Date:

Comments:

### CLM-009

Approved option:

Approved by:

Date:

Comments:

### CLM-010

Approved option:

Approved by:

Date:

Comments:

### CLM-011

Approved option:

Approved by:

Date:

Comments:

### CLM-012

Approved option:

Approved by:

Date:

Comments:

### CLM-013

Approved option:

Approved by:

Date:

Comments:

### CLM-014

Approved option:

Approved by:

Date:

Comments:

### CLM-015

Approved option:

Approved by:

Date:

Comments:

### CLM-016

Approved option:

Approved by:

Date:

Comments:

### CLM-017

Approved option:

Approved by:

Date:

Comments:

### CLM-018

Approved option:

Approved by:

Date:

Comments:

## 9. Appendix

This pack summarizes, but does not replace, the following engineering
specifications:

- [Reinsurance Claims Accounting Architecture Audit v1](./reinsurance-claims-accounting-architecture-audit-v1.md)
- [Reinsurance Claims Accounting Policy Decision Register v1](./reinsurance-claims-accounting-policy-decision-register-v1.md)
- [Reinsurance Financial Event Catalogue v1](./reinsurance-financial-event-catalogue-v1.md)
- [Reinsurance Posting Policy Register v1](./reinsurance-posting-policy-register-v1.md)
- [WorkPhelo Financial Integration Standard v1](../workphelo-financial-integration-standard-v1.md)
- [WorkPhelo Reinsurance Accounting Integration Specification v1](../workphelo-reinsurance-accounting-integration-spec-v1.md)

## 10. Final Reminder

Recommendations in this pack are not approvals.

Before Engineering activates any Claims accounting event, Finance/Product must
approve the relevant decision rows, and Accounting posting rules must be
configured for the tenant.
