# Reinsurance Settlement Finance Decision Pack v1

Status: Draft 1

Audience: Finance, Product, Business, Solution Architecture

Purpose: obtain business and accounting policy approval before WorkPhelo activates Reinsurer settlement accounting events.

Related documents:

- [Reinsurance Settlement Architecture Audit v1](./reinsurance-settlement-architecture-audit-v1.md)
- [Reinsurance Settlement Policy Decision Register v1](./reinsurance-settlement-policy-decision-register-v1.md)
- [Reinsurance Posting Policy Register v1](./reinsurance-posting-policy-register-v1.md)
- [Reinsurance Financial Event Catalogue v1](./reinsurance-financial-event-catalogue-v1.md)
- [WorkPhelo Financial Integration Standard v1.0](../workphelo-financial-integration-standard-v1.md)
- [WorkPhelo Reinsurance Accounting Integration Specification v1.0](../workphelo-reinsurance-accounting-integration-spec-v1.md)

## 1. Executive Summary

WorkPhelo has already implemented the core financial integration platform needed for Reinsurance to publish financial business events into Accounting.

Completed capabilities include:

- Accounting source-event ingestion.
- Reinsurance accounting outbox and retry handling.
- HMAC service-to-service transport.
- Posting-rule based journal creation in Accounting.
- Premium debit note recognition.
- Premium credit note recognition.
- Premium payment received recognition.
- Premium payment reversal recognition.
- Endorsement debit and credit note recognition.
- Reconciliation tooling for already-activated events.

Reinsurer settlement implementation has intentionally paused because settlement policy affects real cash, liabilities, subledgers, reversals and audit outcomes. The engineering platform can support a narrow settlement event, but Finance and Product must first approve how the business wants these events recognized.

This document requests decisions on:

- when a payable to a Reinsurer is recognized;
- whether payment clears an existing payable or creates one;
- how payments allocate to obligations;
- how partial, over, under, failed, cancelled and unallocated payments behave;
- whether approvals and bank confirmation are operational states or accounting boundaries;
- how reversals, corrections, FX, bank charges, withholding and write-offs are handled.

No events are activated by this document. Approval of this pack gives Engineering a controlled scope for the next implementation milestone.

### 1.1 Approval Addendum - 2026-07-30

Finance/Product approved the settlement policies below for implementation readiness:

- Reinsurer payable is recognized from issued Credit Notes or Endorsement Credit Notes.
- A reinsurer payment clears an existing payable; it does not create the payable.
- Bank confirmation or successful payment completion is the accounting recognition boundary.
- Bank approval is operational only and does not emit accounting.
- One payment may settle many Credit Notes, and one Credit Note may receive many payments.
- Partial settlement is supported.
- Overpayments are allowed and corrected through Journal Voucher or approved accounting correction; the original payment remains immutable.
- Unallocated reinsurer payments are not allowed.
- Payment currency may differ from Credit Note currency only when the agreed transaction exchange rate is persisted and reused.
- Live FX lookup is prohibited during accounting recognition.
- Bank charges and withholding tax are captured on the transaction for Accounting posting decisions.
- Failed and cancelled payments do not emit accounting events.
- Settlement write-offs require accountant approval and are not automatic.

Engineering MUST first harden the Reinsurance settlement domain to represent these approved facts before activating `REINSURER_DISBURSEMENT_RECORDED`.

## 2. Current Platform Status

### 2.1 Implemented Financial Platform

The financial integration foundation is complete for the currently approved Reinsurance premium flow.

Accounting owns:

- chart of accounts;
- fiscal periods;
- posting rules;
- subledgers;
- journal creation;
- journal posting;
- journal reversal;
- reporting.

Reinsurance owns:

- placements;
- participants;
- closings;
- notes;
- payments;
- endorsements;
- claims records;
- its own accounting outbox.

Reinsurance does not create journals directly. It sends business facts to Accounting. Accounting applies tenant posting rules.

### 2.2 Implemented Premium Events

The following premium events are implemented and are not awaiting this settlement approval:

| Event                            | Business Meaning                            | Status      |
| -------------------------------- | ------------------------------------------- | ----------- |
| `DEBIT_NOTE_ISSUED`              | Cedant premium note issued.                 | Implemented |
| `CREDIT_NOTE_ISSUED`             | Reinsurer credit note issued.               | Implemented |
| `ENDORSEMENT_DEBIT_NOTE_ISSUED`  | Endorsement additional-premium note issued. | Implemented |
| `ENDORSEMENT_CREDIT_NOTE_ISSUED` | Endorsement return-premium note issued.     | Implemented |
| `PREMIUM_PAYMENT_RECEIVED`       | Premium received from Cedant.               | Implemented |
| `PAYMENT_REVERSED`               | Premium payment reversed.                   | Implemented |

### 2.3 Posting Rules

Accounting posting rules are tenant-owned. Reinsurance sends business facts only. It does not select debit or credit accounts.

This is important because Reinsurer settlement may be handled differently by different tenants or jurisdictions.

### 2.4 Outbox and Reconciliation

Reinsurance has a durable outbox. If Accounting is temporarily unavailable, approved events are preserved and retried later.

Reconciliation tools exist for implemented events so support teams can identify and recover missing source-event rows.

These platform capabilities are complete. The remaining settlement question is policy, not transport.

## 3. Decisions Required

### Decision 1: When is a Reinsurer payable recognized?

**Question**

At what point does WorkPhelo recognize that the broker owes money to a Reinsurer?

**Business Context**

A Reinsurer payable can arise from a credit note, premium clearing process, settlement approval, or actual payment. Choosing the wrong boundary can duplicate liabilities or delay them until cash movement.

**Current System Evidence**

The platform already recognizes issued credit notes and endorsement credit notes. Reinsurer disbursement records can be captured operationally, but their accounting events are not active.

**Available Options**

| Option              | Description                                                                |
| ------------------- | -------------------------------------------------------------------------- |
| Credit Note         | Recognize payable when a credit note or endorsement credit note is issued. |
| Settlement Approval | Recognize payable when Finance approves settlement.                        |
| Payment Recording   | Recognize payable only when payment is recorded.                           |
| Other               | Tenant-defined boundary approved by Finance.                               |

**Advantages**

Credit Note provides an auditable document-backed boundary. Settlement Approval supports stronger Finance control. Payment Recording is simple and cash-aligned.

**Disadvantages**

Credit Note may recognize liability before operational settlement approval. Settlement Approval requires a new approval workflow. Payment Recording can hide liabilities until cash leaves.

**Operational Impact**

The selected boundary determines when teams see a payable as due and what actions are required before settlement.

**Accounting Impact**

The selected boundary determines whether disbursement clears an existing payable or creates the liability at payment time.

**Recommended Option**

Credit Note for documented return premiums, with Settlement Approval deferred until an approval workflow exists.

**Reasoning**

Issued notes already provide immutable, auditable source records. This keeps the payment event focused on cash settlement rather than liability creation.

**Decision Owner**

Finance.

**Decision Status**

Pending approval.

**Implementation Impact**

Engineering can activate disbursement as payable clearing only after this is approved.

### Decision 2: Does payment clear an existing payable or create the liability itself?

**Question**

Should Reinsurer payment reduce a payable that already exists, or should payment itself create the liability and clear cash in one event?

**Business Context**

Settlement can be treated as payment of an obligation or as the first recognized liability event.

**Current System Evidence**

Current notes can already represent obligations. Settlement payment rows currently represent cash movement but do not create Accounting events.

**Available Options**

| Option                  | Description                                                                     |
| ----------------------- | ------------------------------------------------------------------------------- |
| Clear Existing Payable  | Payment debits payable or clearing and credits bank.                            |
| Create Liability Itself | Payment records expense/liability treatment and cash movement at the same time. |
| Tenant Policy           | Different tenant posting profiles decide.                                       |

**Advantages**

Clearing existing payable prevents cash events from duplicating obligation recognition. Tenant policy allows flexibility.

**Disadvantages**

Clearing existing payable requires reliable prior payable recognition. Tenant policy needs careful setup.

**Operational Impact**

Users need clarity on whether notes, approvals or payments drive the Finance position.

**Accounting Impact**

This determines whether posting rules target payable clearing accounts or expense/clearing accounts directly.

**Recommended Option**

Payment should clear an existing payable or clearing balance.

**Reasoning**

This aligns with the current event model where official notes establish financial obligations and payments settle them.

**Decision Owner**

Finance.

**Decision Status**

Pending approval.

**Implementation Impact**

Posting-rule templates should assume settlement clearing, not new liability creation.

### Decision 3: Can one payment settle multiple obligations?

**Question**

Can a single Reinsurer payment settle multiple closings, credit notes or endorsement obligations?

**Business Context**

Finance teams may batch payments, but accounting traceability requires knowing which obligation each amount settled.

**Current System Evidence**

The current settlement model supports one payment linked to one original closing or one endorsement closing. There is no allocation table for one payment across many obligations.

**Available Options**

| Option                    | Description                                                      |
| ------------------------- | ---------------------------------------------------------------- |
| No for v1                 | One payment settles one obligation source.                       |
| Yes with Allocation Table | One payment can settle many obligations with allocation amounts. |
| Yes by Reference Only     | Users enter references without system allocation.                |

**Advantages**

No for v1 is simple and auditable. Allocation table is flexible and production-grade for batches.

**Disadvantages**

No for v1 limits bulk payment workflows. Allocation table requires more design and testing. Reference-only creates weak audit evidence.

**Operational Impact**

If no for v1, users record separate payments per obligation.

**Accounting Impact**

Single-obligation settlement produces clearer journal traceability and easier reconciliation.

**Recommended Option**

No for v1.

**Reasoning**

The current model is safe for single-obligation settlement. Multi-obligation settlement should wait for an allocation model.

**Decision Owner**

Product and Finance.

**Decision Status**

Pending approval.

**Implementation Impact**

Settlement event payloads should state `SINGLE_CLOSING` allocation.

### Decision 4: Can one obligation receive multiple payments?

**Question**

Can a single closing or obligation receive multiple partial payments?

**Business Context**

Reinsurer settlements may be paid in tranches.

**Current System Evidence**

Multiple payment rows can reference the same closing. The system checks outstanding amount before accepting another payment.

**Available Options**

| Option | Description                                             |
| ------ | ------------------------------------------------------- |
| Yes    | Allow multiple payments until outstanding reaches zero. |
| No     | Require one full payment per obligation.                |

**Advantages**

Yes supports real payment behavior. No simplifies reconciliation.

**Disadvantages**

Yes requires accurate outstanding calculations. No is operationally restrictive.

**Operational Impact**

Users can record partial settlements without workarounds.

**Accounting Impact**

Each payment produces a separate settlement event and journal.

**Recommended Option**

Yes.

**Reasoning**

The current platform already supports this safely with overpayment prevention.

**Decision Owner**

Product and Finance.

**Decision Status**

Pending approval.

**Implementation Impact**

Accounting events should use the payment amount, not assume full obligation settlement.

### Decision 5: Are partial settlements supported?

**Question**

Should WorkPhelo allow a settlement below the outstanding amount?

**Business Context**

Partial payments are common when cash is remitted in stages or when deductions are pending review.

**Current System Evidence**

The operational service allows payment amounts below outstanding.

**Available Options**

| Option               | Description                                  |
| -------------------- | -------------------------------------------- |
| Allow Partial        | Record each actual payment.                  |
| Full Settlement Only | Require payment equal to outstanding amount. |

**Advantages**

Allow Partial reflects real cash movement. Full Settlement Only simplifies closeout.

**Disadvantages**

Allow Partial leaves open balances requiring monitoring. Full Settlement Only may force inaccurate records.

**Operational Impact**

Partial settlement requires clear outstanding balance display.

**Accounting Impact**

Each partial payment clears part of the payable.

**Recommended Option**

Allow partial settlements.

**Reasoning**

Accounting should reflect actual payments, not force a clean business state before cash is fully settled.

**Decision Owner**

Finance.

**Decision Status**

Pending approval.

**Implementation Impact**

Settlement events should include payment amount and remaining balance should remain a reporting concern.

### Decision 6: How should overpayments be treated?

**Question**

Should WorkPhelo allow payment above the outstanding Reinsurer amount?

**Business Context**

Overpayments create accounting and recovery complexity.

**Current System Evidence**

The current service rejects payments above outstanding effective Reinsurer premium.

**Available Options**

| Option              | Description                                      |
| ------------------- | ------------------------------------------------ |
| Reject              | Prevent overpayment recording.                   |
| Allow as Advance    | Record excess as an advance or suspense balance. |
| Allow with Approval | Require Finance approval before recording.       |

**Advantages**

Reject prevents accidental overpayment. Advance supports real-world exceptional cases.

**Disadvantages**

Reject may block genuine advances. Advance requires a new model and policy.

**Operational Impact**

Users must correct the payment amount or wait for an advance workflow.

**Accounting Impact**

Reject avoids suspense accounting in v1.

**Recommended Option**

Reject overpayments in v1.

**Reasoning**

The current model has no advance/suspense allocation support.

**Decision Owner**

Finance and Product.

**Decision Status**

Pending approval.

**Implementation Impact**

No change needed for current overpayment guard; Accounting event should only publish accepted payments.

### Decision 7: How should underpayments be treated?

**Question**

What should happen when payment is less than the outstanding obligation?

**Business Context**

Underpayment can mean a legitimate partial settlement, a dispute, deduction, bank charge or error.

**Current System Evidence**

The system supports partial payment but does not classify the reason for underpayment.

**Available Options**

| Option                       | Description                             |
| ---------------------------- | --------------------------------------- |
| Treat as Partial             | Outstanding balance remains open.       |
| Treat as Disputed            | Require reason and workflow.            |
| Treat as Write-Off Candidate | Route difference to write-off approval. |

**Advantages**

Treat as Partial is simple. Disputed or write-off handling gives more business control.

**Disadvantages**

Treat as Partial may not explain why balance remains. Dispute/write-off workflows require new design.

**Operational Impact**

Users need visibility of remaining outstanding balance.

**Accounting Impact**

Only the amount paid should post. Remaining amount stays payable or clearing balance.

**Recommended Option**

Treat underpayment as partial settlement in v1.

**Reasoning**

This matches current platform capability and avoids premature dispute/write-off automation.

**Decision Owner**

Finance and Product.

**Decision Status**

Pending approval.

**Implementation Impact**

No special event is needed for underpayment in v1.

### Decision 8: How should unallocated payments be treated?

**Question**

Can a Reinsurer payment be recorded without linking it to a confirmed closing?

**Business Context**

Some businesses record advances or suspense payments before allocation.

**Current System Evidence**

Current Reinsurer disbursement requires exactly one confirmed original or endorsement closing source.

**Available Options**

| Option                 | Description                                                           |
| ---------------------- | --------------------------------------------------------------------- |
| Not Supported in v1    | Payment must link to a confirmed closing.                             |
| Suspense/Advance       | Payment can sit unallocated until matched later.                      |
| Manual Accounting Only | Finance posts advances manually outside automated Reinsurance events. |

**Advantages**

Not Supported in v1 keeps automated settlement traceable. Manual Accounting allows exceptions.

**Disadvantages**

Not Supported in v1 limits advance workflows. Manual Accounting requires reconciliation discipline.

**Operational Impact**

Users must select a settlement source before recording a Reinsurer payment.

**Accounting Impact**

Avoids automated suspense balances without allocation controls.

**Recommended Option**

Not supported in v1; use manual Accounting for exceptions.

**Reasoning**

The current source model cannot prove what an unallocated payment settles.

**Decision Owner**

Finance and Product.

**Decision Status**

Pending approval.

**Implementation Impact**

Settlement payloads should not include unallocated allocation types.

### Decision 9: Is bank approval operational or financial?

**Question**

Should payment approval by Finance or management create an accounting journal?

**Business Context**

Approval may authorize payment but may not prove cash has moved.

**Current System Evidence**

The current payment model has no approval status or approval actor.

**Available Options**

| Option             | Description                                   |
| ------------------ | --------------------------------------------- |
| Operational Only   | Approval controls workflow but does not post. |
| Financial Boundary | Approval creates payable/cash movement entry. |
| Future Policy      | Defer until approval workflow exists.         |

**Advantages**

Operational Only avoids premature cash recognition. Future Policy avoids designing against non-existent records.

**Disadvantages**

Operational Only may not satisfy businesses that accrue at approval. Future Policy delays automation.

**Operational Impact**

If approval is added later, users need clear labels separating approval from payment recording.

**Accounting Impact**

Approval should not affect cash unless Finance explicitly defines it as a financial event.

**Recommended Option**

Operational only for v1.

**Reasoning**

No approval source record exists today, and approval does not prove settlement.

**Decision Owner**

Finance and Product.

**Decision Status**

Pending approval.

**Implementation Impact**

Do not add approval-based accounting events in the settlement milestone.

### Decision 10: Is bank confirmation operational or financial?

**Question**

Should bank confirmation be the point at which settlement accounting is recognized?

**Business Context**

Some finance teams consider payment recorded when instructed; others wait for bank confirmation.

**Current System Evidence**

The model has a payment reference field, but no bank-confirmed status, bank statement match or confirmation date.

**Available Options**

| Option                     | Description                                                  |
| -------------------------- | ------------------------------------------------------------ |
| Operational Metadata       | Bank reference supports audit but does not drive accounting. |
| Financial Boundary         | Journal posts only after bank confirmation.                  |
| Future Bank Reconciliation | Defer until bank statement matching exists.                  |

**Advantages**

Operational Metadata fits the current model. Financial Boundary is more conservative for cash reporting.

**Disadvantages**

Operational Metadata may post before bank confirmation. Financial Boundary requires new fields and workflow.

**Operational Impact**

Users need clear wording if recorded settlement is treated as cash movement.

**Accounting Impact**

Using payment recording as the accounting boundary affects cash/bank immediately.

**Recommended Option**

Operational metadata in v1, with future bank confirmation deferred.

**Reasoning**

The current system cannot reliably distinguish payment instruction from bank-confirmed payment.

**Decision Owner**

Finance and Product.

**Decision Status**

Pending approval.

**Implementation Impact**

Settlement activation should use recorded payment date unless Finance requires a bank-confirmation workflow first.

### Decision 11: When should payment become irreversible?

**Question**

At what point should users be prevented from editing or deleting a payment directly?

**Business Context**

Cash records need strong audit control.

**Current System Evidence**

Payments are not edited in place. Reversal creates a linked reversal row and marks the original reversed.

**Available Options**

| Option                   | Description                       |
| ------------------------ | --------------------------------- |
| Immediately on Recording | Corrections require reversal.     |
| After Approval           | Editable before approval.         |
| After Bank Confirmation  | Editable until confirmed by bank. |

**Advantages**

Immediate irreversibility gives the strongest audit trail. Later irreversibility allows correction before approval or bank confirmation.

**Disadvantages**

Immediate irreversibility may create more reversal records for data-entry mistakes.

**Operational Impact**

Users must reverse and re-record incorrect settlement entries.

**Accounting Impact**

Accounting receives separate reversal events, not silent edits.

**Recommended Option**

Immediately on recording for v1.

**Reasoning**

This matches the current immutable payment/reversal pattern and WFIS.

**Decision Owner**

Finance and Solution Architecture.

**Decision Status**

Pending approval.

**Implementation Impact**

Disbursement reversal events should mirror premium payment reversal design.

### Decision 12: Must corrections use reversal entries instead of editing existing payments?

**Question**

Should incorrect payments be corrected through reversal entries?

**Business Context**

Auditors need to see what happened, who corrected it and when.

**Current System Evidence**

The current reversal path creates a linked reversal row. Existing premium payment reversal accounting uses the reversal row as the source event.

**Available Options**

| Option            | Description                                        |
| ----------------- | -------------------------------------------------- |
| Reversal Only     | Never edit financial facts; reverse and re-record. |
| Controlled Edit   | Allow edits before accounting delivery.            |
| Manual Correction | Use manual accounting journals for corrections.    |

**Advantages**

Reversal Only is auditable and consistent. Controlled Edit is convenient but riskier.

**Disadvantages**

Reversal Only creates more records. Controlled Edit can obscure audit history.

**Operational Impact**

Users need clear correction workflows.

**Accounting Impact**

Original journals remain unchanged; corrections create linked reversal journals.

**Recommended Option**

Reversal only.

**Reasoning**

This aligns with WFIS and the existing payment reversal model.

**Decision Owner**

Finance and Solution Architecture.

**Decision Status**

Pending approval.

**Implementation Impact**

Add `REINSURER_DISBURSEMENT_REVERSED` before or alongside recorded disbursement activation.

### Decision 13: How should FX differences be recognized?

**Question**

How should foreign-exchange differences be handled when settlement currency differs from placement or base currency?

**Business Context**

FX differences can create gains or losses and affect cash reporting.

**Current System Evidence**

Current settlement validation requires placement currency. There is no bank currency, exchange rate, base amount or FX gain/loss snapshot.

**Available Options**

| Option             | Description                                       |
| ------------------ | ------------------------------------------------- |
| Defer FX           | Only same-currency settlement is automated in v1. |
| Manual FX          | Finance records FX differences manually.          |
| Full FX Automation | Add exchange-rate and realized gain/loss model.   |

**Advantages**

Defer FX is safe and matches current capability. Full FX automation is more complete.

**Disadvantages**

Defer FX limits multi-currency automation. Manual FX creates operational workload.

**Operational Impact**

Users cannot automate cross-currency settlement in v1.

**Accounting Impact**

No automated FX gain/loss journals are created.

**Recommended Option**

Defer FX for v1.

**Reasoning**

The current source records do not contain enough immutable FX evidence.

**Decision Owner**

Finance and Product.

**Decision Status**

Pending approval.

**Implementation Impact**

Settlement event payloads must not claim FX support.

### Decision 14: How should bank charges be recognized?

**Question**

How should bank fees deducted from settlement payments be recorded?

**Business Context**

Bank charges may reduce cash received/paid or appear as separate bank fees.

**Current System Evidence**

The payment model has one amount and no bank-charge fields.

**Available Options**

| Option              | Description                                   |
| ------------------- | --------------------------------------------- |
| Defer Bank Charges  | Record settlement gross amount only.          |
| Manual Bank Charges | Finance records charges manually.             |
| Automated Charges   | Add explicit charge fields and posting rules. |

**Advantages**

Defer Bank Charges avoids unsupported assumptions. Manual charges preserves accuracy if needed.

**Disadvantages**

Defer Bank Charges may not reconcile bank statements exactly where charges apply.

**Operational Impact**

Finance may need manual bank-fee entries.

**Accounting Impact**

No automated bank-charge journals are created in v1.

**Recommended Option**

Defer automated bank charges; use manual Accounting entries where required.

**Reasoning**

There is no durable source field for bank charges today.

**Decision Owner**

Finance.

**Decision Status**

Pending approval.

**Implementation Impact**

Do not include bank-charge fields in v1 settlement events.

### Decision 15: Are withholding taxes supported?

**Question**

Should settlement payment events include withholding tax deducted at payment?

**Business Context**

Some jurisdictions require withholding or statutory deductions at settlement.

**Current System Evidence**

Note events already snapshot configured taxes and levies. Payment records do not contain withholding-at-payment fields.

**Available Options**

| Option                | Description                                     |
| --------------------- | ----------------------------------------------- |
| Not in Payment v1     | Tax/levy values remain note-level only.         |
| Manual Withholding    | Finance posts payment withholding manually.     |
| Automated Withholding | Add payment-level withholding fields and rules. |

**Advantages**

Not in Payment v1 avoids duplicate tax recognition. Automated Withholding supports future statutory workflows.

**Disadvantages**

Not in Payment v1 may be insufficient for jurisdictions where withholding happens at payment.

**Operational Impact**

Users should not expect settlement forms to calculate withholding in v1.

**Accounting Impact**

Payment event should not post withholding unless a payment-level source field exists.

**Recommended Option**

Not supported in payment v1.

**Reasoning**

Existing note snapshots cover note-level charges; payment-level withholding needs separate source data.

**Decision Owner**

Finance and Product.

**Decision Status**

Pending approval.

**Implementation Impact**

Do not add withholding payload fields to v1 disbursement events.

### Decision 16: Should cancelled payments produce journals?

**Question**

If a payment is cancelled, should Accounting receive a journal?

**Business Context**

Cancelled payments may represent an instruction that never became a financial fact.

**Current System Evidence**

The current payment status model does not include `CANCELLED`.

**Available Options**

| Option           | Description                                       |
| ---------------- | ------------------------------------------------- |
| No Journal       | Cancelled payment is operational only.            |
| Reversal Journal | If already posted, cancellation creates reversal. |
| Future Policy    | Decide when cancellation state exists.            |

**Advantages**

No Journal avoids posting non-events. Reversal Journal is appropriate if money was already recognized.

**Disadvantages**

No Journal requires clear distinction between cancellation and reversal.

**Operational Impact**

Users need different actions for cancel before financial fact and reverse after financial fact.

**Accounting Impact**

No journal should be created unless a prior accounting event exists.

**Recommended Option**

No journal for cancelled payment instructions; use reversal only for recorded payments.

**Reasoning**

Cancellation status is not currently modeled, and non-financial intent should not post.

**Decision Owner**

Finance and Product.

**Decision Status**

Pending approval.

**Implementation Impact**

No cancelled-payment event in v1.

### Decision 17: Should failed payments produce journals?

**Question**

If a payment fails, should Accounting receive a journal?

**Business Context**

Failed payments normally indicate cash did not move.

**Current System Evidence**

The current payment status model does not include `FAILED`.

**Available Options**

| Option               | Description                                           |
| -------------------- | ----------------------------------------------------- |
| No Journal           | Failed payment is operational only.                   |
| Reversal Journal     | If cash was already posted, failure creates reversal. |
| Future Bank Workflow | Decide after bank confirmation workflow exists.       |

**Advantages**

No Journal keeps accounting aligned to actual financial facts.

**Disadvantages**

Requires good operational reporting for failed attempts.

**Operational Impact**

Failed attempts should be tracked operationally when that workflow exists.

**Accounting Impact**

No cash or liability impact should be posted for failed attempts.

**Recommended Option**

No journal for failed payments in v1.

**Reasoning**

No durable failed-payment source record exists, and failed cash movement should not post.

**Decision Owner**

Finance and Product.

**Decision Status**

Pending approval.

**Implementation Impact**

No failed-payment event in v1.

### Decision 18: How should settlement write-offs work?

**Question**

How should remaining differences be written off when settlement does not fully clear an obligation?

**Business Context**

Write-offs may result from disputes, rounding, commercial agreements, bank charges or irrecoverable balances.

**Current System Evidence**

The current settlement model supports partial payment but has no write-off model, reason, approval or posting event.

**Available Options**

| Option                       | Description                                  |
| ---------------------------- | -------------------------------------------- |
| Defer Write-Off Automation   | Outstanding remains until manually resolved. |
| Manual Accounting Write-Off  | Finance posts write-off manually.            |
| Automated Write-Off Workflow | Add approval, reason and posting event.      |

**Advantages**

Defer Write-Off Automation keeps v1 safe. Manual Accounting supports exceptions.

**Disadvantages**

Deferral leaves balances open until manually handled.

**Operational Impact**

Users need visibility of unresolved outstanding balances.

**Accounting Impact**

No automated write-off journals are created in v1.

**Recommended Option**

Defer automated write-offs; allow manual Accounting handling.

**Reasoning**

Write-offs require explicit approval and reason tracking that do not exist in the current settlement source model.

**Decision Owner**

Finance and Product.

**Decision Status**

Pending approval.

**Implementation Impact**

Do not include write-off events in the Reinsurer settlement activation.

## 4. Risk Assessment

Implementing Reinsurer settlement accounting without policy approval creates the following risks:

| Risk                        | Description                                                                                            | Impact                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| Duplicate recognition       | Payable may be recognized at credit note and again at payment.                                         | Liabilities and expenses may be overstated.           |
| Incorrect liabilities       | Payment may create or clear the wrong obligation.                                                      | Balance sheet may show inaccurate Reinsurer balances. |
| Incorrect cash reporting    | Payment may post before actual bank confirmation if business treats recorded payments as instructions. | Bank and cash reports may be misleading.              |
| Incorrect audit trail       | Editing or cancelling payment intent may be confused with reversing financial facts.                   | Audit review becomes harder.                          |
| Tenant inconsistency        | Different tenants may expect different payable policies.                                               | Posting-rule templates may be wrong for some tenants. |
| Future migration complexity | Activating too broad a model now may require data repair later.                                        | Migration and reconciliation costs increase.          |
| FX misstatement             | Cross-currency payments cannot be represented with current source data.                                | FX gains/losses may be missing or incorrect.          |
| Allocation ambiguity        | One payment across many obligations cannot be proven today.                                            | Reconciliation and audit trails may be weak.          |

## 5. Recommended Implementation Path

Recommended path:

```text
Finance approval
        |
        v
REINSURER_DISBURSEMENT_RECORDED
        |
        v
REINSURER_DISBURSEMENT_REVERSED
        |
        v
Claims architecture
        |
        v
Claims implementation
```

Why this order minimizes risk:

- Finance approval prevents engineering from hardcoding an accounting policy.
- Recorded disbursement comes before reversal because it is the source event being corrected.
- Reversal should be implemented immediately after recorded disbursement so corrections are audit-safe from day one.
- Claims architecture should follow settlement policy because claims also involve payables, recoveries, cash calls and reversals.
- Claims implementation should wait until its recognition boundaries are documented as clearly as premium and settlement events.

## 6. Approval Matrix

| Decision                                                           | Recommended Option                                                           | Owner                             | Status   | Approval Date | Comments |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------------- | --------------------------------- | -------- | ------------- | -------- |
| When is a Reinsurer payable recognized?                            | Credit Note or Endorsement Credit Note issued.                               | Finance                           | Approved | 2026-07-30    |          |
| Does payment clear an existing payable or create liability itself? | Clear existing payable or clearing balance.                                  | Finance                           | Approved | 2026-07-30    |          |
| Can one payment settle multiple obligations?                       | Yes, via explicit allocation records.                                        | Product and Finance               | Approved | 2026-07-30    |          |
| Can one obligation receive multiple payments?                      | Yes.                                                                         | Product and Finance               | Approved | 2026-07-30    |          |
| Are partial settlements supported?                                 | Yes.                                                                         | Finance                           | Approved | 2026-07-30    |          |
| How should overpayments be treated?                                | Allow and correct through Journal Voucher or approved accounting correction. | Finance and Product               | Approved | 2026-07-30    |          |
| How should underpayments be treated?                               | Treat as partial settlement.                                                 | Finance and Product               | Approved | 2026-07-30    |          |
| How should unallocated payments be treated?                        | Not supported.                                                               | Finance and Product               | Approved | 2026-07-30    |          |
| Is bank approval operational or financial?                         | Operational only.                                                            | Finance and Product               | Approved | 2026-07-30    |          |
| Is bank confirmation operational or financial?                     | Financial recognition boundary.                                              | Finance and Product               | Approved | 2026-07-30    |          |
| When should payment become irreversible?                           | Once bank-confirmed/successful and recorded.                                 | Finance and Solution Architecture | Approved | 2026-07-30    |          |
| Must corrections use reversal entries?                             | Reversal and/or Journal Voucher; never edit posted payments.                 | Finance and Solution Architecture | Approved | 2026-07-30    |          |
| How should FX differences be recognized?                           | Use agreed persisted transaction exchange rate; never live FX.               | Finance and Product               | Approved | 2026-07-30    |          |
| How should bank charges be recognized?                             | Capture on transaction; Accounting determines posting.                       | Finance                           | Approved | 2026-07-30    |          |
| Are withholding taxes supported?                                   | Capture transaction withholding tax for Accounting posting decisions.        | Finance and Product               | Approved | 2026-07-30    |          |
| Should cancelled payments produce journals?                        | No accounting event.                                                         | Finance and Product               | Approved | 2026-07-30    |          |
| Should failed payments produce journals?                           | No accounting event.                                                         | Finance and Product               | Approved | 2026-07-30    |          |
| How should settlement write-offs work?                             | Accountant-approved write-off or JV workflow; not automatic.                 | Finance and Product               | Approved | 2026-07-30    |          |

## 7. Appendix

This decision pack summarizes business policy choices and deliberately avoids technical implementation detail.

For implementation detail, refer to:

- [Reinsurance Settlement Architecture Audit v1](./reinsurance-settlement-architecture-audit-v1.md)
- [Reinsurance Settlement Policy Decision Register v1](./reinsurance-settlement-policy-decision-register-v1.md)
- [Reinsurance Financial Event Catalogue v1](./reinsurance-financial-event-catalogue-v1.md)
- [Reinsurance Posting Policy Register v1](./reinsurance-posting-policy-register-v1.md)
- [WorkPhelo Financial Integration Standard v1.0](../workphelo-financial-integration-standard-v1.md)
- [WorkPhelo Reinsurance Accounting Integration Specification v1.0](../workphelo-reinsurance-accounting-integration-spec-v1.md)

## 8. Facts, Recommendations, Assumptions and Pending Decisions

### Facts

- Premium and endorsement-note accounting events are already implemented.
- Reinsurer settlement accounting events are not active.
- The prior operational system supported recorded Reinsurer disbursements linked to one confirmed closing source.
- The approved policy requires explicit credit-note allocation, bank confirmation, persisted agreed FX, bank charges and withholding tax before accounting event activation.
- The current operational system supports linked payment reversals.
- Payment approvals and payment batches remain out of scope for this milestone.

### Recommendations

- Treat Reinsurer disbursement as settlement of an existing payable or clearing balance.
- Use explicit Credit Note allocation rows as settlement truth.
- Implement recorded disbursement only after the domain can represent bank confirmation, agreed FX, bank charges and withholding tax.
- Defer payment batches, automatic write-offs, claim settlement accounting and partial reversals.

### Assumptions

- Finance wants automated journals to follow actual, auditable business records.
- Tenants may later need different posting rules, but the source-event meaning should remain stable.
- Payment recording in v1 means the business accepts that cash movement has occurred or should be recognized.

### Pending Decisions

All 18 decisions in this pack are approved as of 2026-07-30. Accounting event activation remains blocked until the Reinsurance domain readiness changes are implemented and validated.
