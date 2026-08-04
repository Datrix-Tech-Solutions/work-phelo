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
- Activated `REINSURER_DISBURSEMENT_RECORDED` and `REINSURER_DISBURSEMENT_REVERSED` capture for bank-confirmed reinsurer settlement lifecycle records.

Endorsement notes are active through issued endorsement-note records.

Note voiding, claims, recoveries and cedant claim settlements remain inactive
until explicitly approved and implemented.

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

| Endpoint                                                                      | Purpose                                                                                                     |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `GET /accounting-integration/status`                                          | Reports entitlement/configuration readiness.                                                                |
| `POST /accounting-integration/counterparties/:counterpartyId/subledger/sync`  | Ensures one Cedant/Reinsurer subledger.                                                                     |
| `POST /accounting-integration/outbox/process-pending`                         | Dispatches already-enqueued outbox rows.                                                                    |
| `POST /accounting-integration/reconciliation/debit-note-issued`               | Dry-runs or explicitly enqueues missing `DEBIT_NOTE_ISSUED` outbox rows for issued placement debit notes.   |
| `POST /accounting-integration/reconciliation/credit-note-issued`              | Dry-runs or explicitly enqueues missing `CREDIT_NOTE_ISSUED` outbox rows for issued placement credit notes. |
| `POST /accounting-integration/reconciliation/endorsement-debit-note-issued`   | Dry-runs or explicitly enqueues missing `ENDORSEMENT_DEBIT_NOTE_ISSUED` outbox rows.                        |
| `POST /accounting-integration/reconciliation/endorsement-credit-note-issued`  | Dry-runs or explicitly enqueues missing `ENDORSEMENT_CREDIT_NOTE_ISSUED` outbox rows.                       |
| `POST /accounting-integration/reconciliation/premium-payment-received`        | Dry-runs or explicitly enqueues missing `PREMIUM_PAYMENT_RECEIVED` outbox rows for premium receipt rows.    |
| `POST /accounting-integration/reconciliation/payment-reversed`                | Dry-runs or explicitly enqueues missing `PAYMENT_REVERSED` outbox rows for premium payment reversal rows.   |
| `POST /accounting-integration/reconciliation/reinsurer-disbursement-recorded` | Dry-runs or explicitly enqueues missing `REINSURER_DISBURSEMENT_RECORDED` outbox rows.                      |
| `POST /accounting-integration/reconciliation/reinsurer-disbursement-reversed` | Dry-runs or explicitly enqueues missing `REINSURER_DISBURSEMENT_REVERSED` outbox rows.                      |

Accounting internal endpoint:

| Endpoint                           | Purpose                                                              |
| ---------------------------------- | -------------------------------------------------------------------- |
| `POST /internal/subledgers/ensure` | Idempotently creates or refreshes an Accounting insurance subledger. |

---

## 6. Source Event Families

Reinsurance source events SHOULD be activated incrementally.

### 6.1 Premium family

| Event                             | Status                  | Source truth                                          |
| --------------------------------- | ----------------------- | ----------------------------------------------------- |
| `DEBIT_NOTE_ISSUED`               | Active first activation | Issued placement debit note snapshot.                 |
| `CREDIT_NOTE_ISSUED`              | Active                  | Issued placement credit note snapshot.                |
| `ENDORSEMENT_DEBIT_NOTE_ISSUED`   | Active                  | Issued endorsement debit note snapshot.               |
| `ENDORSEMENT_CREDIT_NOTE_ISSUED`  | Active                  | Issued endorsement credit note snapshot.              |
| `PREMIUM_PAYMENT_RECEIVED`        | Active                  | Recorded premium payment row.                         |
| `PAYMENT_REVERSED`                | Active                  | Reversal payment row linked to original payment.      |
| `REINSURER_DISBURSEMENT_RECORDED` | Active                  | Bank-confirmed outbound reinsurer payment row.        |
| `REINSURER_DISBURSEMENT_REVERSED` | Active                  | Reversal payment row linked to original disbursement. |

### 6.2 Claims family

| Event                              | Status              | Source truth                                             |
| ---------------------------------- | ------------------- | -------------------------------------------------------- |
| `CLAIM_REGISTERED`                 | Planned non-posting | Claim registration record.                               |
| `CLAIM_PAYABLE_APPROVED`           | Policy pending      | Broker-approved cedant payable on `PlacementClaim`.      |
| `CLAIM_CASH_CALL_ISSUED`           | Policy pending      | Issued `PlacementClaimCashCall`.                         |
| `CLAIM_CASH_CALL_VOIDED`           | Policy pending      | Voided issued `PlacementClaimCashCall`.                  |
| `CLAIM_CEDANT_SETTLEMENT_RECORDED` | Policy pending      | `PlacementClaimCedantSettlement` record.                 |
| `CLAIM_CEDANT_SETTLEMENT_REVERSED` | Policy pending      | linked reversal `PlacementClaimCedantSettlement` record. |
| `CLAIM_RECOVERY_RECEIPT_RECORDED`  | Policy pending      | `PlacementClaimRecoveryReceipt` record.                  |
| `CLAIM_RECOVERY_RECEIPT_REVERSED`  | Policy pending      | linked reversal `PlacementClaimRecoveryReceipt` record.  |
| `CLAIM_CLOSED`                     | Planned non-posting | Claim lifecycle record.                                  |

### 6.3 Endorsement family

Most endorsement accounting should flow through endorsement note and payment events, not generic endorsement lifecycle events.

Lifecycle events such as `ENDORSEMENT_CLOSED` MAY be useful for audit or reporting but SHOULD NOT post financial journals unless Accounting policy explicitly requires them.

---

## 7. Source Records and Business Dates

| Event                              | Immutable source record                      | Business date             | Idempotency key                                                          |
| ---------------------------------- | -------------------------------------------- | ------------------------- | ------------------------------------------------------------------------ |
| `DEBIT_NOTE_ISSUED`                | `PlacementNote.id`                           | `issuedAt`                | `reinsurance:debit-note:<noteId>:issued:v1`                              |
| `CREDIT_NOTE_ISSUED`               | `PlacementNote.id`                           | `issuedAt`                | `reinsurance:credit-note:<noteId>:issued:v1`                             |
| `ENDORSEMENT_DEBIT_NOTE_ISSUED`    | `PlacementNote.id`                           | `issuedAt`                | `reinsurance:endorsement-debit-note:<noteId>:issued:v1`                  |
| `ENDORSEMENT_CREDIT_NOTE_ISSUED`   | `PlacementNote.id`                           | `issuedAt`                | `reinsurance:endorsement-credit-note:<noteId>:issued:v1`                 |
| `PREMIUM_PAYMENT_RECEIVED`         | `PlacementPayment.id`                        | `paymentDate`             | `reinsurance:payment:<paymentId>:recorded:v1`                            |
| `PAYMENT_REVERSED`                 | reversal `PlacementPayment.id`               | reversal `paymentDate`    | `reinsurance:payment:<reversalPaymentId>:reversal:v1`                    |
| `REINSURER_DISBURSEMENT_RECORDED`  | `PlacementPayment.id`                        | `bankConfirmedAt`         | `reinsurance:reinsurer-disbursement:<paymentId>:recorded:v1`             |
| `REINSURER_DISBURSEMENT_REVERSED`  | reversal `PlacementPayment.id`               | reversal `paymentDate`    | `reinsurance:reinsurer-disbursement:<reversalPaymentId>:reversal:v1`     |
| `CLAIM_PAYABLE_APPROVED`           | `PlacementClaim.id`                          | `approvedAt`              | `reinsurance:claim-payable:<claimId>:approved:v1`                        |
| `CLAIM_CASH_CALL_ISSUED`           | `PlacementClaimCashCall.id`                  | `issuedAt`                | `reinsurance:claim-cash-call:<cashCallId>:issued:v1`                     |
| `CLAIM_CASH_CALL_VOIDED`           | `PlacementClaimCashCall.id`                  | `voidedAt`                | `reinsurance:claim-cash-call:<cashCallId>:voided:v1`                     |
| `CLAIM_RECOVERY_RECEIPT_RECORDED`  | `PlacementClaimRecoveryReceipt.id`           | `paymentDate`             | `reinsurance:claim-recovery-receipt:<receiptId>:recorded:v1`             |
| `CLAIM_RECOVERY_RECEIPT_REVERSED`  | reversal `PlacementClaimRecoveryReceipt.id`  | reversal `paymentDate`    | `reinsurance:claim-recovery-receipt:<reversalReceiptId>:reversal:v1`     |
| `CLAIM_CEDANT_SETTLEMENT_RECORDED` | `PlacementClaimCedantSettlement.id`          | `settlementDate`          | `reinsurance:claim-cedant-settlement:<settlementId>:recorded:v1`         |
| `CLAIM_CEDANT_SETTLEMENT_REVERSED` | reversal `PlacementClaimCedantSettlement.id` | reversal `settlementDate` | `reinsurance:claim-cedant-settlement:<reversalSettlementId>:reversal:v1` |

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

## 10.0.2 Endorsement Note Issued Activation

Endorsement note accounting is recognized only when an official endorsement
note is issued. Endorsement creation, participant response, closing
confirmation, document preview and endorsement closure are not accounting
boundaries by themselves.

`ENDORSEMENT_DEBIT_NOTE_ISSUED` is recognized when:

- `PlacementNote.type = ENDORSEMENT_DEBIT_NOTE`
- `PlacementNote.direction = CEDANT_TO_BROKER`
- `PlacementNote.endorsementId` is present
- `PlacementNote.status` transitions from `DRAFT` to `ISSUED`
- `PlacementNote.issuedAt` is populated

`ENDORSEMENT_CREDIT_NOTE_ISSUED` is recognized when:

- `PlacementNote.type = ENDORSEMENT_CREDIT_NOTE`
- `PlacementNote.direction = BROKER_TO_REINSURER`
- `PlacementNote.endorsementId` is present
- `PlacementNote.endorsementClosingId` is present
- `PlacementNote.status` transitions from `DRAFT` to `ISSUED`
- `PlacementNote.issuedAt` is populated

The issued `PlacementNote` is the immutable source financial record for both
events. Payloads include placement, endorsement, note and, for credit notes,
endorsement-closing references where available.

Event identity:

```text
ENDORSEMENT_DEBIT_NOTE_ISSUED
sourceRecordType = PlacementNote
sourceRecordId = <endorsement-debit-note-id>
sourceDocumentId = <endorsement-debit-note-id>
idempotencyKey = reinsurance:endorsement-debit-note:<noteId>:issued:v1
occurredAt = PlacementNote.issuedAt

ENDORSEMENT_CREDIT_NOTE_ISSUED
sourceRecordType = PlacementNote
sourceRecordId = <endorsement-credit-note-id>
sourceDocumentId = <endorsement-credit-note-id>
idempotencyKey = reinsurance:endorsement-credit-note:<noteId>:issued:v1
occurredAt = PlacementNote.issuedAt
```

Endorsement debit-note payloads are Cedant-facing and expose additional-premium
facts:

```json
{
  "counterparty": {
    "id": "<cedant-counterparty-id>",
    "type": "CEDANT",
    "subledgerExternalRef": "<cedant-counterparty-id>"
  },
  "amounts": {
    "adjustmentMagnitude": 2250,
    "signedReceivableImpact": 2250,
    "signedPayableImpact": 0
  }
}
```

Endorsement credit-note payloads are Reinsurer-facing and expose return-premium
facts. Raw signed source-note values are preserved where useful, while
Accounting rules can use positive magnitudes:

```json
{
  "counterparty": {
    "id": "<reinsurer-counterparty-id>",
    "type": "REINSURER",
    "subledgerExternalRef": "<reinsurer-counterparty-id>"
  },
  "amounts": {
    "rawNetPremiumAdjustment": -1620,
    "returnPremiumMagnitude": 1620,
    "adjustmentMagnitude": 1620,
    "signedReceivableImpact": 0,
    "signedPayableImpact": 1620
  }
}
```

Accounting posting rules own the final GL treatment. Finance may configure
endorsement debit notes as additional receivables and endorsement credit notes
as payable, contra-receivable, clearing or another approved tenant treatment.
Reinsurance MUST NOT hardcode those GL policies.

Reconciliation endpoints:

```http
POST /api/v1/operations/reinsurance/accounting-integration/reconciliation/endorsement-debit-note-issued?dryRun=true&limit=50
POST /api/v1/operations/reinsurance/accounting-integration/reconciliation/endorsement-credit-note-issued?dryRun=true&limit=50
```

The endpoints are tenant scoped, duplicate safe and preserve original
`PlacementNote.issuedAt` as the event business date.

---

## 10.1 Premium Payment and Reversal Activation

`PREMIUM_PAYMENT_RECEIVED` is recognized when a valid
`PlacementPayment` premium receipt row is officially recorded with:

- `type = PREMIUM_RECEIVED`
- `direction = INBOUND`
- `status = RECORDED`
- `reversalOfPaymentId = null`
- a valid `paymentDate`

Current Product/Finance classification: **A. The user records an already
completed bank/cash receipt.** Immediate recognition remains intentional for
the current workflow. If the product later changes this screen to record
expected receipts before bank completion, Reinsurance MUST introduce a separate
confirmation adapter rather than reusing this event boundary silently.

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

## 10.2 Reinsurer Disbursement Recognition

`REINSURER_DISBURSEMENT_RECORDED` is active for bank-confirmed Reinsurer
settlement payments.

Eligibility:

- `PlacementPayment.type = REINSURER_DISBURSEMENT`
- `PlacementPayment.direction = OUTBOUND`
- `PlacementPayment.status = BANK_CONFIRMED`
- `PlacementPayment.reversalOfPaymentId = null`
- `PlacementPayment.bankConfirmedAt` is present
- the counterparty is a Reinsurer
- optional `PlacementPaymentAllocation` rows MAY exist
- when allocations exist, they MUST reference issued `CREDIT_NOTE` or
  `ENDORSEMENT_CREDIT_NOTE`
- when allocations exist, allocated payment-currency amount MUST equal the
  payment amount
- cross-currency allocations MUST carry a persisted agreed exchange rate
- cross-currency original or endorsement closing settlement MUST carry a
  persisted agreed or confirmed exchange rate
- confirmation MUST include a settlement method. Supported values are
  `BANK_TRANSFER`, `CHEQUE`, `CASH`, `MOBILE_MONEY`, `INTERNAL_OFFSET`,
  `JOURNAL` and `OTHER`.

Recorded event:

```text
sourceEventType = REINSURER_DISBURSEMENT_RECORDED
sourceRecordType = PlacementPayment
sourceRecordId = <paymentId>
sourceDocumentId = <paymentId>
idempotencyKey = reinsurance:reinsurer-disbursement:<paymentId>:recorded:v1
occurredAt = PlacementPayment.bankConfirmedAt
```

Payloads use `allocation.model = CREDIT_NOTE_ALLOCATIONS` and include:

- placement and payment references;
- Reinsurer counterparty and `subledgerExternalRef`;
- payment date, confirmation date, settlement method, settlement currency and
  settlement reference/bank reference where required;
- settlement reference where present;
- positive `paymentAmount`, `allocatedAmount` and `bankCharges` execution
  facts;
- source-owned NIC levy and contractual withholding-tax facts from issued
  Credit Note / Endorsement Credit Note snapshots where available;
- `unallocatedAmount = paymentAmount - allocatedAmount`;
- `signedCashImpact < 0` only when the settlement method is cash-affecting
  (`BANK_TRANSFER`, `CHEQUE`, `CASH`, `MOBILE_MONEY`);
- `signedCashImpact = 0` for `INTERNAL_OFFSET` and `JOURNAL`;
- `signedPayableImpact < 0`;
- allocation IDs, Credit Note IDs/numbers/types, obligation currency,
  obligation amount, payment-currency amount and persisted agreed FX rate where
  applicable.

Reinsurance MUST NOT publish GL account IDs or journal directions. Accounting
posting rules clear the existing payable and resolve cash, non-cash offsets,
bank charges, NIC levy, withholding tax and FX treatment per tenant. Bank-charge
account selection remains Accounting-owned tenant configuration or a future
Accounting confirmation extension; Reinsurance stores only the factual bank
charge amount.

Operational payment ownership:

- Reinsurance creates the `PlacementPayment` and owns amount, currency,
  Reinsurer, original/endorsement closing source, payment date, payment
  reference, settlement method, settlement currency, notes and any source
  allocation facts.
- Accounting confirms financial completion and MUST NOT overwrite those
  source-owned fields.
- For cheque settlements, Reinsurance stores the cheque/payment reference on the
  operational payment (for example `reference = CHQ-001`). Accounting confirms
  clearance/completion using confirmation date and notes, and does not ask the
  accountant to re-enter `CHQ-001`.
- For bank transfers, mobile money and cash, Accounting may add missing
  confirmation evidence only when the operational payment did not already carry
  a reference.
- For `INTERNAL_OFFSET` and `JOURNAL`, Accounting confirms completion/linkage
  without representing the event as a bank/cash movement.

FX source hierarchy:

1. Use allocation-level persisted agreed FX where Credit Note allocations prove
   the obligation/payment currency relationship.
2. Otherwise use payment-level confirmed/agreed FX persisted on
   `PlacementPayment`.
3. If a future model explicitly links a Cedant premium receipt to a downstream
   Reinsurer settlement, its persisted payment FX may be exposed as settlement
   basis. The current domain does not infer that relationship.
4. If currencies differ and no persisted FX fact exists, confirmation MUST be
   blocked. Reinsurance and Accounting MUST NOT fetch live FX rates.

Failed payments, cancelled payments, approval-only states and reversal rows
MUST NOT emit this event. Unallocated-by-note disbursements MAY emit this event
after bank confirmation; Accounting uses the payment-level business facts and
tenant posting rules.

Active reversal event:

```text
sourceEventType = REINSURER_DISBURSEMENT_REVERSED
sourceRecordType = PlacementPayment
sourceRecordId = <reversalPaymentId>
sourceDocumentId = <reversalPaymentId>
idempotencyKey = reinsurance:reinsurer-disbursement:<reversalPaymentId>:reversal:v1
occurredAt = reversal PlacementPayment.paymentDate
```

`REINSURER_DISBURSEMENT_REVERSED` is recognized from the linked reversal
payment row. Reinsurance MUST NOT publish this event from the original payment
status mutation alone.

### 10.3 Active Premium Event AR/AP Matrix

This matrix documents the active Reinsurance premium-event family. It separates
business meaning from tenant posting configuration. Accounting posting rules
remain tenant owned; the rows below are recommended defaults and test-backed
examples, not hardcoded universal journals.

| Event                             | Source record                  | Recognition boundary                             | Business meaning                                 | AR effect                      | AP effect                      | Bank/cash effect                                                    | Recommended default posting                                                | Code-active? |
| --------------------------------- | ------------------------------ | ------------------------------------------------ | ------------------------------------------------ | ------------------------------ | ------------------------------ | ------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------ |
| `DEBIT_NOTE_ISSUED`               | Issued `PlacementNote`         | Official placement debit note issue time         | Cedant owes premium to broker                    | Increases Cedant receivable    | Unaffected                     | Unaffected                                                          | DR Cedant Premium Receivable / CR Premium Income                           | Yes          |
| `CREDIT_NOTE_ISSUED`              | Issued `PlacementNote`         | Official placement credit note issue time        | Broker owes premium share to Reinsurer           | Unaffected                     | Increases Reinsurer payable    | Unaffected                                                          | DR Premium Clearing or Expense / CR Reinsurer Payable                      | Yes          |
| `ENDORSEMENT_DEBIT_NOTE_ISSUED`   | Issued endorsement debit note  | Official endorsement debit note issue time       | Additional premium due from Cedant               | Increases Cedant receivable    | Unaffected                     | Unaffected                                                          | DR Cedant Premium Receivable / CR Endorsement Premium                      | Yes          |
| `ENDORSEMENT_CREDIT_NOTE_ISSUED`  | Issued endorsement credit note | Official endorsement credit note issue time      | Return premium / payable adjustment to Reinsurer | Unaffected                     | Increases Reinsurer payable    | Unaffected                                                          | DR Return Premium or Clearing / CR Reinsurer Payable                       | Yes          |
| `PREMIUM_PAYMENT_RECEIVED`        | `PlacementPayment` receipt row | User records completed inbound bank/cash receipt | Cedant payment clears receivable                 | Decreases Cedant receivable    | Unaffected                     | Increases bank/cash                                                 | DR Bank/Cash / CR Cedant Premium Receivable                                | Yes          |
| `PAYMENT_REVERSED`                | Reversal `PlacementPayment`    | Reversal row creation time                       | Premium receipt reversal                         | Re-increases Cedant receivable | Unaffected                     | Decreases bank/cash                                                 | DR Cedant Premium Receivable / CR Bank/Cash                                | Yes          |
| `REINSURER_DISBURSEMENT_RECORDED` | `PlacementPayment` row         | Accounting confirmation time (`bankConfirmedAt`) | Confirmed Reinsurer settlement                   | Unaffected                     | Decreases Reinsurer payable    | Decreases bank/cash only for cash-affecting settlement methods      | DR Reinsurer Payable / CR Bank/Cash or tenant-configured non-cash clearing | Yes          |
| `REINSURER_DISBURSEMENT_REVERSED` | Reversal `PlacementPayment`    | Reversal row creation time                       | Reinsurer disbursement reversal                  | Unaffected                     | Re-increases Reinsurer payable | Increases bank/cash only when reversing a cash-affecting settlement | DR Bank/Cash or tenant-configured clearing / CR Reinsurer Payable          | Yes          |

Actual posting behavior depends on active `PostingRule` rows in Accounting.
Tenants MAY route through clearing accounts, income accounts, expense accounts,
tax accounts, FX accounts or bank-charge accounts according to approved policy.
Source modules MUST publish business facts only and MUST NOT choose GL accounts.

Manual Accounting remains supported for source-module gaps. Today this means
manual journals, manual posting/reversal and tenant-configured reports. Dedicated
AR receipt, AP payment and cashbook sub-ledger workflow screens are separate
future capabilities and MUST NOT be implied by this integration.

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

Claims accounting MUST NOT be activated from claim lifecycle status alone. Claim
registration, reserve status and claim closure are non-posting in v1 unless
Finance approves a reserve, write-off or memorandum accounting policy.

The canonical claims accounting audit is
[Reinsurance Claims Accounting Architecture Audit v1](./accounting/reinsurance-claims-accounting-architecture-audit-v1.md).

The claims policy approval gate is
[Reinsurance Claims Accounting Policy Decision Register v1](./accounting/reinsurance-claims-accounting-policy-decision-register-v1.md).

Cash-call, payable, settlement and recovery accounting MUST NOT be activated until Product/Finance decides:

- Whether approved claim payable creates a cedant payable immediately.
- How later claim payable approval amendments are represented.
- Whether cash calls create receivables immediately.
- Whether recoveries reduce claim receivable or clear cash-call receivable.
- Whether cedant settlements clear a prior payable or recognize expense at payment.
- Whether cedant settlement and reinsurer recovery use separate subledger types.
- Whether cross-currency claims, bank charges and withholding tax are in scope.

If claim receipt or settlement currency differs from claim currency in a future
workflow, Reinsurance MUST persist the agreed FX rate before publishing an
Accounting event. Accounting MUST NOT fetch live FX rates for historical claim
events.

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
