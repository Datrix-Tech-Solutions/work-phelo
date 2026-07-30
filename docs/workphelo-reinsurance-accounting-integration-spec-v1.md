# WorkPhelo Reinsurance Accounting Integration Specification v1.0

Status: Draft 1

Audience: Reinsurance engineering, Accounting engineering, QA, Product, Finance implementation

Parent standard: [WorkPhelo Financial Integration Standard (WFIS) v1.0](./workphelo-financial-integration-standard-v1.md)

---

## 1. Purpose

This document applies WFIS v1.0 to the Reinsurance module.

It defines how Reinsurance will integrate with Accounting while preserving:

- Reinsurance operational independence.
- Accounting module independence.
- Accounting ownership of journals, GL accounts, posting rules, and subledgers.
- Immutable Reinsurance business snapshots as the source of financial truth.

This document intentionally does not duplicate generic WFIS rules. If there is a conflict, WFIS wins unless this profile explicitly tightens a Reinsurance-specific rule.

---

## 2. Current Implementation Baseline

As of this draft, Reinsurance has:

- Accounting event builder.
- Reinsurance Accounting outbox.
- HMAC client to Accounting internal source-event ingestion.
- Live-verified transport to Accounting `SourceEventInbox`.
- Duplicate delivery/idempotency behavior verified.
- Retry behavior verified.
- Accounting readiness/status endpoints.
- Counterparty to Accounting subledger readiness sync/check for Cedants and Reinsurers.
- Operational outbox dispatcher endpoint for already-enqueued rows.
- Activated `DEBIT_NOTE_ISSUED` publishing when placement debit notes are issued and Accounting readiness passes.

No other real financial source-event family is active yet.

---

## 3. Module Independence

Reinsurance MUST remain fully operational without Accounting.

If Accounting is disabled for a tenant:

- Placement, endorsement, claims, recoveries, payments, notes, documents, and close workflows MUST continue according to Reinsurance rules.
- Reinsurance SHOULD NOT enqueue Accounting outbox events in Phase 1.
- Reinsurance MUST preserve enough source truth for future explicit backfill.

If Accounting is enabled:

- Reinsurance SHOULD run counterparty/subledger readiness.
- Reinsurance MAY enqueue Accounting events only after the relevant event family is approved and activated.

---

## 4. Accounting Master Mapping

### 4.1 Counterparties

Reinsurance `Counterparty` records map to Accounting `SubledgerAccount` records.

| Reinsurance counterparty type | Accounting subledger type | External reference                         |
| ----------------------------- | ------------------------- | ------------------------------------------ |
| `CEDANT`                      | `CEDANT`                  | Reinsurance `Counterparty.id`              |
| `REINSURER`                   | `REINSURER`               | Reinsurance `Counterparty.id`              |
| `BROKER`                      | Not required in Phase 1   | Policy decision required before activation |

The mapping key MUST be:

```text
tenantId + subledgerType + externalRef
```

The mapping MUST NOT use the counterparty name as identity.

Counterparty name changes MAY update Accounting subledger display name where safe.

Inactive Accounting subledgers MUST NOT be silently reactivated by Reinsurance sync.

### 4.2 Control accounts

Cedant subledgers SHOULD use Accounting's configured accounts receivable control account.

Reinsurer subledgers SHOULD use Accounting's configured accounts payable control account.

If the required control account is missing, Reinsurance readiness MUST report a clear setup error.

### 4.3 Accounting customers and vendors

Reinsurance Cedants and Reinsurers do not need to become Accounting `Customer` or `Vendor` records in Phase 1.

Accounting `Customer` and `Vendor` masters remain available for Accounting-only workflows and non-insurance business.

Future tenant policy MAY choose to mirror Cedants/Reinsurers into Customers/Vendors for reporting, but that is not required for source-event posting because Accounting supports `CEDANT` and `REINSURER` subledger types directly.

---

## 5. Readiness Workflow

Recommended Phase 1 readiness flow:

```text
Reinsurance Counterparty created/updated
        |
        v
If Accounting module enabled
        |
        v
Ensure Accounting CEDANT/REINSURER subledger
        |
        v
Financial source event may be enqueued later when event family is activated
```

Readiness sync is allowed before real financial event publishing. It MUST NOT create journals.

Operational endpoints:

| Endpoint                                                                     | Purpose                                      |
| ---------------------------------------------------------------------------- | -------------------------------------------- |
| `GET /accounting-integration/status`                                         | Reports entitlement/configuration readiness. |
| `POST /accounting-integration/counterparties/:counterpartyId/subledger/sync` | Ensures one Cedant/Reinsurer subledger.      |
| `POST /accounting-integration/outbox/process-pending`                        | Dispatches already-enqueued outbox rows.     |

Accounting internal endpoint:

| Endpoint                           | Purpose                                                              |
| ---------------------------------- | -------------------------------------------------------------------- |
| `POST /internal/subledgers/ensure` | Idempotently creates or refreshes an Accounting insurance subledger. |

---

## 6. Source Event Families

Reinsurance source events SHOULD be activated incrementally.

### 6.1 Premium family

| Event                             | Status                  | Source truth                                     |
| --------------------------------- | ----------------------- | ------------------------------------------------ |
| `DEBIT_NOTE_ISSUED`               | Active first activation | Issued placement debit note snapshot.            |
| `CREDIT_NOTE_ISSUED`              | Proposed                | Issued placement credit note snapshot.           |
| `ENDORSEMENT_DEBIT_NOTE_ISSUED`   | Proposed                | Issued endorsement debit note snapshot.          |
| `ENDORSEMENT_CREDIT_NOTE_ISSUED`  | Proposed                | Issued endorsement credit note snapshot.         |
| `PREMIUM_PAYMENT_RECEIVED`        | Proposed                | Recorded premium payment row.                    |
| `PAYMENT_REVERSED`                | Proposed                | Reversal payment row linked to original payment. |
| `REINSURER_DISBURSEMENT_RECORDED` | Proposed                | Recorded outbound reinsurer payment row.         |

### 6.2 Claims family

| Event                              | Status | Source truth               |
| ---------------------------------- | ------ | -------------------------- |
| `CLAIM_REGISTERED`                 | Future | Claim registration record. |
| `CLAIM_CASH_CALL_ISSUED`           | Future | Issued cash-call snapshot. |
| `CLAIM_CEDANT_SETTLEMENT_RECORDED` | Future | Cedant settlement record.  |
| `CLAIM_RECOVERY_RECEIPT_RECORDED`  | Future | Recovery receipt record.   |
| `CLAIM_CLOSED`                     | Future | Claim lifecycle record.    |

### 6.3 Endorsement family

Most endorsement accounting should flow through endorsement note and payment events, not generic endorsement lifecycle events.

Lifecycle events such as `ENDORSEMENT_CLOSED` MAY be useful for audit or reporting but SHOULD NOT post financial journals unless Accounting policy explicitly requires them.

---

## 7. Source Records and Business Dates

| Event                             | Immutable source record        | Business date          | Idempotency key                                          |
| --------------------------------- | ------------------------------ | ---------------------- | -------------------------------------------------------- |
| `DEBIT_NOTE_ISSUED`               | `PlacementNote.id`             | `issuedAt`             | `reinsurance:debit-note:<noteId>:issued:v1`              |
| `CREDIT_NOTE_ISSUED`              | `PlacementNote.id`             | `issuedAt`             | `reinsurance:credit-note:<noteId>:issued:v1`             |
| `ENDORSEMENT_DEBIT_NOTE_ISSUED`   | `PlacementNote.id`             | `issuedAt`             | `reinsurance:endorsement-debit-note:<noteId>:issued:v1`  |
| `ENDORSEMENT_CREDIT_NOTE_ISSUED`  | `PlacementNote.id`             | `issuedAt`             | `reinsurance:endorsement-credit-note:<noteId>:issued:v1` |
| `PREMIUM_PAYMENT_RECEIVED`        | `PlacementPayment.id`          | `paymentDate`          | `reinsurance:payment:<paymentId>:recorded:v1`            |
| `PAYMENT_REVERSED`                | reversal `PlacementPayment.id` | reversal `paymentDate` | `reinsurance:payment:<reversalPaymentId>:reversal:v1`    |
| `CLAIM_CASH_CALL_ISSUED`          | `ClaimCashCall.id`             | `issuedAt`             | `reinsurance:claim-cash-call:<cashCallId>:issued:v1`     |
| `CLAIM_RECOVERY_RECEIPT_RECORDED` | `RecoveryReceipt.id`           | `receiptDate`          | `reinsurance:recovery-receipt:<receiptId>:recorded:v1`   |

Reinsurance MUST use business dates from source records, not outbox creation timestamps, for Accounting event `occurredAt`.

---

## 8. Payload Standards

### 8.1 Common payload

Every Reinsurance financial event SHOULD include:

```json
{
  "references": {
    "placementId": "placement-id",
    "placementReference": "FAC-2026-001",
    "policyNumber": "POL-2026-001",
    "endorsementId": "endorsement-id-if-any",
    "claimId": "claim-id-if-any"
  },
  "counterparty": {
    "id": "counterparty-id",
    "type": "CEDANT",
    "name": "Acme Insurance"
  },
  "amounts": {},
  "documents": {}
}
```

### 8.2 Counterparty reference

`payload.counterparty.id` SHOULD equal the Reinsurance `Counterparty.id`.

Posting rules that require subledgers SHOULD use:

```text
counterparty.id
```

as the `subledgerExternalRefSource`.

### 8.3 Amounts

Amount fields MUST be semantically named.

Examples:

```json
{
  "amounts": {
    "grossPremium": 10000,
    "commission": 1000,
    "brokerage": 500,
    "taxes": 250,
    "netPremium": 8750
  }
}
```

For return-premium or negative financial-impact cases, payload MUST distinguish:

- Signed ledger impact values
- Absolute display values

Recommended shape:

```json
{
  "amounts": {
    "displayCreditAmount": 1500,
    "signedPremiumImpact": -1500,
    "signedNetImpact": -1350
  }
}
```

---

## 9. Premium Accounting Policy Decision Pack

These decisions remain open and MUST be approved before activating real financial event publishing.

| Question                       | Recommended default                                                 | Notes                                                                                 |
| ------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Broker model                   | Intermediary/pass-through                                           | Matches broker handling of cedant premium and reinsurer settlement in many workflows. |
| Gross premium treatment        | Clearing/liability model with brokerage/commission income separated | Avoids overstating broker revenue.                                                    |
| Premium receivable recognition | Debit note issued                                                   | Creates clear receivable when official note is issued.                                |
| Reinsurer payable recognition  | Debit note issued or premium receipt, tenant policy dependent       | Needs finance approval.                                                               |
| Return premium recognition     | Credit note issued                                                  | Credit note is the formal liability/offset document.                                  |
| Claim payable recognition      | Approved payable amount                                             | Needs claims policy approval.                                                         |
| Cash-call recognition          | Issued cash call creates receivable, or memo-only until receipt     | Needs broker business model decision.                                                 |
| Posting dates                  | Business document/payment date                                      | Do not use transport/outbox date.                                                     |
| Posting rule ownership         | Accounting tenant admin/accountant, with seeded templates           | Source modules do not own GL mappings.                                                |

---

## 10. First Activation: Debit Note Issued

The first real Reinsurance event is `DEBIT_NOTE_ISSUED`, because:

- It has an issued immutable source note.
- It has a clear business date.
- It has a Cedant counterparty.
- It can be demonstrated through existing Accounting posting rules.
- It does not require payment reversal complexity.

Activation prerequisites:

1. Accounting module enabled for tenant.
2. Accounting tenant config complete.
3. AR control account configured.
4. Cedant subledger synced.
5. Posting rule exists for `REINSURANCE + DEBIT_NOTE_ISSUED`.
6. Fiscal period open for note issue date.
7. Outbox dispatcher available.
8. Duplicate event tests passing.

If Accounting is disabled or integration readiness cannot be established at the
moment of issue, Reinsurance MUST still issue the valid debit note and MUST NOT
create a partial Accounting journal. Operational support can reconcile/backfill
explicitly once Accounting readiness is restored.

Example posting rule:

```text
DR Cedant Premium Receivable
CR Premium Clearing or Premium Income
```

Exact GL accounts remain tenant-configured in Accounting.

---

## 11. Reversal and Correction Semantics

Reinsurance MUST NOT ask Accounting to mutate posted journals.

If a source business record is reversed, voided, cancelled, or corrected after posting:

- Reinsurance MUST emit a new reversal/correction source event.
- Accounting MUST create a linked or logically traceable reversal/correction journal.
- Original source event and journal MUST remain auditable.

Examples:

| Business action                  | Accounting integration behavior                                               |
| -------------------------------- | ----------------------------------------------------------------------------- |
| Payment reversed                 | Emit `PAYMENT_REVERSED` from reversal payment row.                            |
| Debit note voided after posting  | Emit a note-void/reversal event if policy says issued note was posted.        |
| Credit note voided after posting | Emit a note-void/reversal event if policy says issued credit note was posted. |
| Endorsement changes premium      | Emit debit/credit note events from endorsement note snapshots.                |

---

## 12. Claims and Recoveries

Claims integration MUST use backend-confirmed claim financial records, not frontend calculations.

Claim allocation percentages and recovery amounts MUST use effective confirmed participation snapshots according to Reinsurance claim allocation rules.

Cash-call and recovery accounting MUST NOT be activated until Product/Finance decides:

- Whether cash calls create receivables immediately.
- Whether recoveries reduce claim receivable or clear cash-call receivable.
- Whether claim settlement postings are gross or net.
- Whether cedant settlement and reinsurer recovery use separate subledger types.

---

## 13. Operational Runbook

### 13.1 Tenant readiness

Before enabling Reinsurance financial events:

1. Confirm tenant has Accounting enabled.
2. Confirm Reinsurance remains enabled.
3. Confirm `ACCOUNTING_SERVICE_URL` is configured in Reinsurance.
4. Confirm `INTERNAL_SERVICE_AUTH_SECRET` matches between Reinsurance and Accounting.
5. Confirm Accounting allows `reinsurance-service`.
6. Confirm Accounting tenant config exists.
7. Confirm AR/AP control accounts.
8. Sync Cedant/Reinsurer subledgers.
9. Confirm posting rules.
10. Confirm fiscal period is open.

### 13.2 Missing subledger

If Accounting posting fails due to missing `CEDANT` or `REINSURER` subledger:

1. Run Reinsurance counterparty subledger sync.
2. Confirm Accounting subledger is active.
3. Confirm subledger external reference equals Reinsurance `Counterparty.id`.
4. Retry the Accounting source event.

### 13.3 Outbox failure

If Reinsurance outbox delivery fails:

1. Inspect outbox `lastError`.
2. Check Accounting service reachability.
3. Check HMAC configuration.
4. Check tenant Accounting setup.
5. Retry through outbox dispatcher.

---

## 14. UI Guidance

Reinsurance UI SHOULD eventually show:

- Accounting integration status.
- Counterparty subledger sync status for Cedants/Reinsurers.
- Outbox failed count for tenant admins/support.
- Source-event delivery status for financial documents/payments.

Accounting UI SHOULD show:

- `Source: Manual` for manual journals.
- `Source Module: Reinsurance` for automated journals.
- Source record/document references.
- Linked Reinsurance note/payment/claim identifiers where available.

No UI should imply that Reinsurance is required for Accounting.

---

## 15. Tests Required Before Activating Each Event

For every Reinsurance event type:

- Event payload shape test.
- Deterministic idempotency-key test.
- Outbox enqueue idempotency test.
- Delivery retry test.
- Accounting duplicate source event test.
- Missing posting rule test.
- Missing subledger test where applicable.
- Closed fiscal period test.
- Tenant isolation test.
- Reversal/correction test where applicable.

---

## 16. Non-Goals for This Profile

This specification does not:

- Define tenant-specific chart of accounts.
- Dictate statutory accounting treatment.
- Replace accountant policy decisions.
- Require Reinsurance for Accounting-only customers.
- Activate real financial event publishing by itself.
- Define full UI screens for Accounting operations.

---

## 17. Activation Sequence

Recommended incremental rollout:

1. Readiness only: config diagnostics, subledger sync, dispatcher.
2. Activate `DEBIT_NOTE_ISSUED`.
3. Activate `PREMIUM_PAYMENT_RECEIVED`.
4. Activate payment reversal.
5. Activate endorsement debit/credit notes.
6. Activate reinsurer disbursements.
7. Activate claim cash calls and recoveries after claims policy approval.
8. Add reconciliation/backfill tooling.
