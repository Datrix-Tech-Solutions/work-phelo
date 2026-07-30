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
- Activated `DEBIT_NOTE_ISSUED` capture when placement debit notes are issued for Accounting-enabled tenants.
- Activated `CREDIT_NOTE_ISSUED` capture when placement credit notes are issued for Accounting-enabled tenants.
- Activated `PREMIUM_PAYMENT_RECEIVED` and `PAYMENT_REVERSED` capture for premium receipt lifecycle records.

Endorsement notes, note voiding, reinsurer disbursements, claims, recoveries and
settlements remain inactive until explicitly approved and implemented.

---

## 3. Module Independence

Reinsurance MUST remain fully operational without Accounting.

If Accounting is disabled for a tenant:

- Placement, endorsement, claims, recoveries, payments, notes, documents, and close workflows MUST continue according to Reinsurance rules.
- Reinsurance SHOULD NOT enqueue Accounting outbox events in Phase 1.
- Reinsurance MUST preserve enough source truth for future explicit backfill.

If Accounting is enabled:

- Reinsurance MUST durably capture activated source events in its outbox at the financial recognition boundary.
- Reinsurance SHOULD run counterparty/subledger readiness as a setup and support workflow.
- Delivery and posting readiness failures MUST NOT silently discard activated source events.

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

| Endpoint                                                                     | Purpose                                                                                                     |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `GET /accounting-integration/status`                                         | Reports entitlement/configuration readiness.                                                                |
| `POST /accounting-integration/counterparties/:counterpartyId/subledger/sync` | Ensures one Cedant/Reinsurer subledger.                                                                     |
| `POST /accounting-integration/outbox/process-pending`                        | Dispatches already-enqueued outbox rows.                                                                    |
| `POST /accounting-integration/reconciliation/debit-note-issued`              | Dry-runs or explicitly enqueues missing `DEBIT_NOTE_ISSUED` outbox rows for issued placement debit notes.   |
| `POST /accounting-integration/reconciliation/credit-note-issued`             | Dry-runs or explicitly enqueues missing `CREDIT_NOTE_ISSUED` outbox rows for issued placement credit notes. |
| `POST /accounting-integration/reconciliation/premium-payment-received`       | Dry-runs or explicitly enqueues missing `PREMIUM_PAYMENT_RECEIVED` outbox rows for premium receipt rows.    |
| `POST /accounting-integration/reconciliation/payment-reversed`               | Dry-runs or explicitly enqueues missing `PAYMENT_REVERSED` outbox rows for premium payment reversal rows.   |

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
| `CREDIT_NOTE_ISSUED`              | Active                  | Issued placement credit note snapshot.           |
| `ENDORSEMENT_DEBIT_NOTE_ISSUED`   | Proposed                | Issued endorsement debit note snapshot.          |
| `ENDORSEMENT_CREDIT_NOTE_ISSUED`  | Proposed                | Issued endorsement credit note snapshot.         |
| `PREMIUM_PAYMENT_RECEIVED`        | Active                  | Recorded premium payment row.                    |
| `PAYMENT_REVERSED`                | Active                  | Reversal payment row linked to original payment. |
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

Delivery/posting prerequisites:

1. Accounting module enabled for tenant.
2. Accounting tenant config complete.
3. AR control account configured.
4. Cedant subledger synced.
5. Posting rule exists for `REINSURANCE + DEBIT_NOTE_ISSUED`.
6. Fiscal period open for note issue date.
7. Outbox dispatcher available.
8. Duplicate event tests passing.

Capture readiness is intentionally narrower than posting readiness.

For `DEBIT_NOTE_ISSUED`, Reinsurance MUST capture the event when:

1. Accounting is enabled for the tenant.
2. The source record is an issued placement debit note.
3. The event can be built from immutable Reinsurance note, placement and Cedant data.

The capture step MUST NOT require:

- `ACCOUNTING_SERVICE_URL`
- HMAC service secret
- Accounting service reachability
- Accounting tenant config
- Cedant subledger
- Posting rule
- Fiscal period status

Those are delivery/posting readiness concerns handled by the dispatcher and
Accounting `SourceEventInbox` processing. If Accounting is disabled,
Reinsurance MUST still issue the valid debit note and SHOULD NOT create an
outbox row in Phase 1.

Example posting rule:

```text
DR Cedant Premium Receivable
CR Premium Clearing or Premium Income
```

Exact GL accounts remain tenant-configured in Accounting.

---

## 10.0.1 Credit Note Issued Activation

`CREDIT_NOTE_ISSUED` is recognized when a placement credit note is officially
issued:

- `PlacementNote.type = CREDIT_NOTE`
- `PlacementNote.direction = BROKER_TO_REINSURER`
- `PlacementNote.status` transitions from `DRAFT` to `ISSUED`
- `PlacementNote.issuedAt` is populated

The issued `PlacementNote` is the immutable source financial record.
Recognition MUST NOT occur from draft note creation, closing confirmation,
payments, document previews or frontend-only actions.

The event uses:

```text
sourceRecordType = PlacementNote
sourceRecordId = <credit-note-id>
sourceDocumentId = <credit-note-id>
idempotencyKey = reinsurance:credit-note:<credit-note-id>:issued:v1
occurredAt = PlacementNote.issuedAt
```

Credit-note payloads use the Reinsurer counterparty from the note:

```json
{
  "counterparty": {
    "id": "<reinsurer-counterparty-id>",
    "type": "REINSURER",
    "subledgerExternalRef": "<reinsurer-counterparty-id>"
  }
}
```

Current Reinsurance credit-note amount fields are positive source-note
magnitudes. Payloads therefore expose positive display values plus explicit
signed impact facts:

```json
{
  "amounts": {
    "creditMagnitude": 3712.5,
    "netAmount": 3712.5,
    "signedReceivableImpact": 0,
    "signedPayableImpact": 3712.5
  }
}
```

Accounting posting rules own the final GL treatment. Finance may configure this
event as a receivable reduction, reinsurer payable, clearing-liability movement
or another approved tenant treatment. Reinsurance MUST NOT hardcode that policy.

Reconciliation endpoint:

```http
POST /api/v1/operations/reinsurance/accounting-integration/reconciliation/credit-note-issued?dryRun=true&limit=50
```

The endpoint is tenant scoped and targets only issued placement credit notes
missing `reinsurance:credit-note:<noteId>:issued:v1`.

---

## 10.1 Premium Payment and Reversal Activation

`PREMIUM_PAYMENT_RECEIVED` is recognized when a valid
`PlacementPayment` premium receipt row is officially recorded with:

- `type = PREMIUM_RECEIVED`
- `direction = INBOUND`
- `status = RECORDED`
- `reversalOfPaymentId = null`
- a valid `paymentDate`

Current Reinsurance payment allocation is placement-level. The payment create
workflow does not allocate a premium receipt to one or more specific
`PlacementNote` records. Therefore, payloads MUST state:

```json
{
  "allocation": {
    "model": "PLACEMENT_LEVEL_RECEIVABLE",
    "noteAllocationSupported": false
  }
}
```

Accounting posting rules MAY use `amounts.paymentAmount` with tenant-configured
accounts. A typical conceptual rule is:

```text
DR Bank / Cash / Undeposited Funds
CR Cedant Premium Receivable
```

`PAYMENT_REVERSED` is recognized when Reinsurance creates the reversal
`PlacementPayment` row and links it to the original payment through
`reversalOfPaymentId`.

The reversal event uses the reversal row as its source record, not the original
payment row:

```text
sourceRecordId = <reversal PlacementPayment.id>
idempotencyKey = reinsurance:payment:<reversalPaymentId>:reversal:v1
```

Reversal payloads expose both a positive display magnitude and signed impact
facts:

```json
{
  "amounts": {
    "paymentAmount": 1000,
    "signedCashImpact": -1000,
    "signedReceivableImpact": 1000
  }
}
```

Accounting posting rules SHOULD still use the positive `paymentAmount` path and
reverse the DR/CR lines through tenant configuration:

```text
DR Cedant Premium Receivable
CR Bank / Cash / Undeposited Funds
```

Reinsurance MUST capture premium payment and reversal events atomically with
the payment transaction when Accounting is enabled. The capture step MUST NOT
require Accounting URL/HMAC configuration, service reachability, posting rules,
subledger readiness or fiscal-period status. Those remain delivery/posting
readiness concerns.

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

### 13.4 Missing debit-note outbox row

If support finds an issued placement debit note without a matching
`DEBIT_NOTE_ISSUED` outbox row:

1. Run the debit-note reconciliation endpoint with `dryRun=true`.
2. Confirm the note is genuinely missing the deterministic idempotency key.
3. Run the endpoint with `dryRun=false` only for explicit recovery.
4. Dispatch the created outbox row.
5. Process the Accounting source event after delivery.

### 13.5 Missing credit-note outbox row

If support finds an issued placement credit note without a matching
`CREDIT_NOTE_ISSUED` outbox row:

1. Run the credit-note reconciliation endpoint with `dryRun=true`.
2. Confirm the note is genuinely missing
   `reinsurance:credit-note:<noteId>:issued:v1`.
3. Run the endpoint with `dryRun=false` only for explicit recovery.
4. Dispatch the created outbox row.
5. Process the Accounting source event after delivery.

The credit-note source event remains a business-fact event. Posting treatment is
resolved by the tenant's Accounting posting rule.

### 13.6 Missing premium payment or reversal outbox row

If support finds a recorded premium receipt without a matching
`PREMIUM_PAYMENT_RECEIVED` outbox row:

1. Run the premium-payment reconciliation endpoint with `dryRun=true`.
2. Confirm the payment is genuinely missing
   `reinsurance:payment:<paymentId>:recorded:v1`.
3. Run the endpoint with `dryRun=false` only for explicit recovery.
4. Dispatch the created outbox row.
5. Process the Accounting source event after delivery.

If support finds a reversal payment row without a matching `PAYMENT_REVERSED`
outbox row:

1. Run the payment-reversal reconciliation endpoint with `dryRun=true`.
2. Confirm the reversal row is genuinely missing
   `reinsurance:payment:<reversalPaymentId>:reversal:v1`.
3. Run the endpoint with `dryRun=false` only for explicit recovery.
4. Dispatch the created outbox row.
5. Process the Accounting source event after delivery.

The original premium-payment event and original Accounting journal MUST remain
auditable. Reversal recovery creates or recovers a separate reversal event; it
must not mutate the original event.

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
5. Activate `CREDIT_NOTE_ISSUED`.
6. Activate endorsement debit/credit notes.
7. Activate reinsurer disbursements.
8. Activate claim cash calls and recoveries after claims policy approval.
9. Add reconciliation/backfill tooling.
