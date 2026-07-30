# WorkPhelo Financial Integration Standard (WFIS) v1.0

Status: Draft 1

Audience: Engineering, Product, Accounting Implementation, QA, DevOps

Applies to: Accounting service and every WorkPhelo module that may publish financial activity into Accounting, including Reinsurance, HR/Payroll, Subscription, Marketing/CRM, Inventory, Projects, and future modules.

Companion profile: [WorkPhelo Reinsurance Accounting Integration Specification v1.0](./workphelo-reinsurance-accounting-integration-spec-v1.md)

---

## 1. Purpose

WFIS defines the canonical integration contract for financial automation in WorkPhelo.

It exists to ensure that:

- Accounting remains a standalone ERP module.
- Operational modules can automate Accounting without owning Accounting records.
- Financial records are posted once, traced clearly, reversed safely, and audited end to end.
- Manual accounting and automated source-module accounting coexist.
- Future modules integrate through the same source-event and posting-rule architecture.

WFIS is normative. Keywords `MUST`, `MUST NOT`, `SHOULD`, `SHOULD NOT`, and `MAY` are to be interpreted as engineering requirements.

---

## 2. Architectural Principles

### 2.1 Accounting independence

Accounting MUST be fully usable without Reinsurance or any other operational module.

Accounting MUST support manual setup and operation of:

- Chart of Accounts
- Fiscal periods
- Currencies and exchange rates
- Cost centres
- Subledger accounts
- Customers
- Vendors
- Manual journal entries
- Journal posting
- Journal reversal
- Financial reports

Operational modules MUST integrate into Accounting for automation and convenience only. No operational module may become a prerequisite for Accounting.

### 2.2 Module independence

Operational modules MUST continue their own business workflows when Accounting is not enabled for a tenant.

If Accounting is disabled:

- The operational transaction MUST complete normally if valid in its own domain.
- The module SHOULD NOT enqueue Accounting source events in Phase 1.
- Historical operational truth MUST remain available for a future explicit backfill or reconciliation process.

### 2.3 Ownership boundaries

Accounting owns:

- GL accounts
- Journal entries
- Journal lines
- Fiscal configuration
- Accounting currencies and exchange rates
- Accounting customers and vendors
- Accounting subledgers
- Posting rules
- Source event inbox
- Financial reports

Source modules own:

- Their operational records
- Their document snapshots
- Their business lifecycle
- Their domain-level reversals, voids, cancellations, and corrections
- Their outbox records, if they publish through an outbox

Source modules MUST NOT directly create Accounting journals or journal lines. They MUST publish business source events. Accounting MUST translate those events using tenant posting rules.

### 2.4 No hidden rewriting

Posted Accounting journals MUST be immutable.

Source-module changes MUST NOT mutate posted Accounting journals. They MUST create new source events, reversal events, correction events, or explicit adjustment events as appropriate.

Manual Accounting records MUST NOT be silently overwritten by source-module sync.

---

## 3. Integration Modes

WFIS defines two accounting entry modes.

### 3.1 Mode A: Manual Accounting

An accountant directly creates Accounting records.

Example:

```text
DR Bank
CR Other Income
```

Manual journals:

- MUST NOT require a source event.
- MUST NOT require posting rules.
- MAY have `sourceModule = MANUAL` or `sourceModule = null`, depending on schema convention.
- SHOULD display as `Source: Manual` in user interfaces.

### 3.2 Mode B: Source-Module Automation

A trusted WorkPhelo module sends a business event into Accounting.

Example:

```text
sourceModule = REINSURANCE
sourceEventType = DEBIT_NOTE_ISSUED
```

Accounting then:

1. Stores the event in `SourceEventInbox`.
2. Resolves an active tenant posting rule.
3. Builds a balanced journal.
4. Posts the journal.
5. Links the source event and journal.

Automated journals MUST indicate:

- Source module
- Source event type
- Source record ID
- Source document ID where available
- Source event inbox ID

---

## 4. Canonical Event Model

Every automated financial integration MUST use a source event envelope.

### 4.1 Envelope

```json
{
  "tenantId": "tenant-uuid",
  "sourceModule": "REINSURANCE",
  "sourceEventType": "DEBIT_NOTE_ISSUED",
  "sourceRecordId": "domain-record-id",
  "sourceDocumentId": "optional-document-or-note-id",
  "idempotencyKey": "module:entity:id:state:v1",
  "occurredAt": "2026-07-30T10:00:00.000Z",
  "currency": "GHS",
  "payload": {}
}
```

### 4.2 Required fields

| Field             | Requirement                                                            |
| ----------------- | ---------------------------------------------------------------------- |
| `tenantId`        | MUST identify the tenant that owns the economic event.                 |
| `sourceModule`    | MUST identify the publishing domain for automated events.              |
| `sourceEventType` | MUST identify the business event, not the journal action.              |
| `sourceRecordId`  | MUST identify the immutable or lifecycle-bearing source record.        |
| `idempotencyKey`  | MUST be deterministic and tenant-unique for the same economic event.   |
| `occurredAt`      | MUST be the business event date/time, not merely the transport time.   |
| `currency`        | MUST be the transaction currency when the event has a monetary amount. |
| `payload`         | MUST contain module-specific business facts only.                      |

### 4.3 Optional fields

| Field                  | Guidance                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `sourceDocumentId`     | SHOULD be supplied for document-backed events such as invoices, notes, receipts, certificates, statements, or claims documents. |
| `payload.counterparty` | SHOULD include source counterparty ID, name, type, and any subledger external reference used for posting.                       |
| `payload.amounts`      | SHOULD group monetary values with clear semantic names.                                                                         |
| `payload.references`   | MAY group placement, claim, payroll, invoice, or project references.                                                            |

### 4.4 Payload rules

Payloads MUST contain business facts, not GL posting instructions.

Payloads MUST NOT include:

- GL account IDs
- Debit/credit line instructions
- Journal line IDs
- Posting rule IDs
- SQL fragments
- Raw private object storage keys
- Provider credentials or tokens

Payloads SHOULD include enough immutable source data to explain the journal later without fetching mutable source records.

---

## 5. Source Module Naming

`sourceModule` MUST be stable and uppercase.

Approved initial values:

- `REINSURANCE`
- `HR`
- `PAYROLL`
- `SUBSCRIPTION`
- `CRM`
- `INVENTORY`
- `PROJECTS`
- `MANUAL` where the schema requires an explicit manual value

New modules SHOULD use a single stable module identifier across all events.

---

## 6. Event Type Naming

`sourceEventType` MUST describe the business event that occurred.

Good examples:

- `DEBIT_NOTE_ISSUED`
- `PREMIUM_PAYMENT_RECEIVED`
- `PAYROLL_RUN_APPROVED`
- `CUSTOMER_INVOICE_ISSUED`
- `GOODS_RECEIVED`
- `PROJECT_COST_RECORDED`

Bad examples:

- `CREATE_JOURNAL`
- `DR_BANK_CR_INCOME`
- `POST_TO_ACCOUNTING`

Event types SHOULD be past-tense business facts.

---

## 7. Idempotency

Every source event MUST have a deterministic `idempotencyKey`.

The key SHOULD follow:

```text
<module>:<record-family>:<record-id>:<business-state>:v<contract-version>
```

Examples:

```text
reinsurance:debit-note:note-123:issued:v1
reinsurance:payment:payment-123:recorded:v1
payroll:run:run-123:approved:v1
subscription:invoice:invoice-123:issued:v1
```

Rules:

- Retrying the same event MUST use the same idempotency key.
- A materially different economic event MUST use a different idempotency key.
- Contract-breaking payload changes MUST increment the version suffix.
- Accounting MUST return the existing source event for duplicate internal deliveries where possible.
- Source modules MUST treat an existing Accounting event response as successful delivery.

---

## 8. Transport Standard

### 8.1 Internal endpoint

Trusted services MUST submit source events through:

```http
POST /internal/source-events
```

The public Accounting API MAY expose tenant-authenticated source-event administration endpoints for support, retry, inspection, and demo processing. Operational services MUST use internal service authentication.

### 8.2 HMAC service authentication

Internal endpoints MUST use the WorkPhelo HMAC service authentication pattern.

Required headers:

| Header                  | Meaning                                                             |
| ----------------------- | ------------------------------------------------------------------- |
| `x-workphelo-service`   | Calling service name from `INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES`. |
| `x-workphelo-timestamp` | Current Unix timestamp in seconds.                                  |
| `x-workphelo-signature` | HMAC-SHA256 signature.                                              |

Signature payload:

```text
<service>:<timestamp>:<HTTP_METHOD>:<path>
```

Example:

```text
reinsurance-service:1785400000:POST:/internal/source-events
```

The HMAC secret MUST be at least 32 characters in local/dev environments and MUST be managed through secrets in deployed environments.

Internal service endpoints MUST reject:

- Missing headers
- Stale timestamps
- Unknown services
- Invalid signatures
- Unsupported service names

### 8.3 Retry classification

Source modules SHOULD classify Accounting delivery failures as:

| Failure                         | Retry?                                     |
| ------------------------------- | ------------------------------------------ |
| Network failure                 | Yes                                        |
| Timeout                         | Yes                                        |
| HTTP 408                        | Yes                                        |
| HTTP 429                        | Yes                                        |
| HTTP 5xx                        | Yes                                        |
| HTTP 400 validation error       | No, until payload/config is fixed          |
| HTTP 401/403 service auth error | No, until configuration is fixed           |
| HTTP 404 tenant/config missing  | No, until tenant Accounting setup is fixed |
| HTTP 409 business conflict      | No, until master data/state is fixed       |

---

## 9. Source Event Inbox

Accounting MUST persist incoming automated events in `SourceEventInbox`.

Required lifecycle statuses:

| Status       | Meaning                                           |
| ------------ | ------------------------------------------------- |
| `RECEIVED`   | Accepted but not processed.                       |
| `PROCESSING` | Claimed by processor.                             |
| `POSTED`     | Journal created and posted.                       |
| `FAILED`     | Processing failed with stored reason.             |
| `IGNORED`    | Event intentionally ignored by Accounting policy. |

Accounting MUST preserve:

- Original payload
- Idempotency key
- Failure reason
- Linked journal ID when posted
- Created timestamp
- Processed timestamp

Accounting MUST NOT create partial journals for failed source events.

---

## 10. Posting Rules

Posting rules are the translation layer from business events to journals.

Accounting MUST resolve posting rules by:

```text
tenantId + sourceModule + sourceEventType + effective date
```

Posting rules SHOULD be versioned and effective-dated.

Posting rule lines MUST specify:

- Debit or credit direction
- GL account
- Amount source
- Currency source
- Optional subledger type
- Optional subledger external reference path
- Optional description template

Posting rules MUST NOT live in source modules.

Source modules MUST NOT know which GL accounts are used for posting.

---

## 11. Journal Integrity

Accounting MUST enforce:

- Debit total equals credit total before posting.
- Posting into open fiscal periods only.
- Posted journals are immutable.
- Reversals create linked reversal journals.
- Reversed journals are not repeatedly reversed unless explicitly and safely supported.
- Parent/summary GL accounts cannot receive postings.
- Inactive GL accounts cannot receive postings.
- Subledger postings must respect configured control-account rules.

Manual and automated journals MUST obey the same ledger integrity rules.

---

## 12. Currency and Amounts

Source events MUST carry transaction currency.

Accounting MUST store:

- Transaction currency amounts
- Base currency amounts
- Exchange rate snapshots where applicable

Accounting MUST NOT recalculate base amounts from mutable exchange rates after posting.

Source modules SHOULD publish amounts as positive business magnitudes with explicit event type/direction unless the source domain already has a canonical signed financial-impact snapshot. If signed values are supplied, payload semantics MUST clearly state which fields are signed and which are display absolutes.

---

## 13. Subledger Standard

Subledger accounts are Accounting-owned master data.

Source modules MAY map their counterparties to Accounting subledgers using:

```text
tenantId + subledgerType + externalRef
```

`externalRef` SHOULD be the source module's immutable record ID. It MUST NOT be the display name.

Example:

```text
tenantId = tenant-1
subledgerType = CEDANT
externalRef = reinsurance Counterparty.id
```

Accounting MUST support manual creation of subledgers without source modules.

Integration sync MUST NOT silently overwrite posted journals or manual adjustments.

If an integrated subledger already exists and is inactive, source-module sync SHOULD fail with a clear diagnostic rather than silently reactivating it.

---

## 14. Source Module Outbox

Source modules SHOULD use a local outbox for financial source events.

The outbox SHOULD store:

- Tenant ID
- Source event type
- Source record type
- Source record ID
- Source document ID
- Idempotency key
- Occurred-at timestamp
- Currency
- Payload
- Status
- Attempt count
- Last attempt timestamp
- Next attempt timestamp
- Last error
- Accounting source event ID
- Delivered timestamp

Recommended statuses:

| Status       | Meaning                 |
| ------------ | ----------------------- |
| `PENDING`    | Ready to deliver.       |
| `PROCESSING` | Claimed by dispatcher.  |
| `DELIVERED`  | Accepted by Accounting. |
| `FAILED`     | Last delivery failed.   |

Outbox dispatchers MUST be idempotent and concurrency safe.

Outbox dispatchers MUST NOT create new business events. They only deliver already-enqueued events.

---

## 15. Module Entitlement Rules

Accounting integration MUST be conditional.

If Accounting is enabled for the tenant:

- Source modules SHOULD run readiness checks before enqueueing financial events.
- Source modules MAY enqueue source events according to approved integration policy.

If Accounting is not enabled:

- Source modules MUST complete valid business operations without Accounting.
- Source modules SHOULD NOT enqueue Accounting events in Phase 1.
- Source modules MAY expose diagnostics that Accounting is disabled.

Backfill after enabling Accounting MUST be an explicit reconciliation workflow, not an automatic replay of historical events.

---

## 16. Operational Runbook

### 16.1 Required environment

Source modules that publish to Accounting MUST configure:

- `ACCOUNTING_SERVICE_URL`
- `INTERNAL_SERVICE_AUTH_SECRET`
- `ACCOUNTING_SERVICE_TIMEOUT_MS` where supported

Accounting internal endpoints MUST configure:

- `INTERNAL_SERVICE_AUTH_SECRET`
- `INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES`
- `INTERNAL_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS` where supported

### 16.2 Readiness checks

Before activating financial event publishing for a tenant, support or automation SHOULD verify:

1. Accounting module is enabled.
2. Accounting tenant config exists.
3. Base currency is set.
4. Required control accounts exist.
5. Required subledgers exist.
6. Required posting rules exist and are active.
7. Fiscal period for event date is open.
8. Source module outbox dispatcher is configured.

### 16.3 Failed source event handling

When a source event fails:

1. Inspect `SourceEventInbox.failureReason`.
2. Confirm whether the failure is master-data, posting-rule, fiscal-period, payload, or transient transport.
3. Fix configuration or source payload if needed.
4. Retry the source event through Accounting's controlled retry endpoint.
5. Do not manually edit posted journals to "fix" a failed source event that never posted.

### 16.4 Failed outbox delivery handling

When a source-module outbox row fails:

1. Inspect outbox `lastError`.
2. Confirm `ACCOUNTING_SERVICE_URL` and HMAC configuration.
3. Confirm Accounting service is reachable.
4. Confirm tenant Accounting setup exists.
5. Retry only through the outbox dispatcher or supported retry operation.

---

## 17. Observability

Implementations SHOULD expose:

- Integration status endpoint
- Outbox pending count
- Outbox failed count
- Last successful delivery timestamp
- Last failure reason
- Accounting source event ID linkage
- Posting failure reason
- Journal linkage

User interfaces SHOULD show:

- `Source: Manual` for manual journals
- `Source Module: <module>` for automated journals
- `Source Record: <human reference>` where available
- Linked source document where available

---

## 18. Duplicate Risk and Reconciliation

Manual and automated accounting can represent the same business event if users manually post before automation posts.

WFIS does not ban legitimate manual adjustments. It requires provenance.

Automated journals MUST carry source references. Manual journals SHOULD allow optional reference fields.

Accounting UI and reports SHOULD help users identify:

- Automated journals
- Manual journals
- Source module and source record
- Potential duplicate external references

Future reconciliation tools MAY warn about likely duplicates but MUST NOT delete or mutate posted manual journals automatically.

---

## 19. Security

Internal financial endpoints MUST be service-authenticated.

Services MUST NOT expose:

- HMAC secrets
- Provider tokens
- Private object storage keys
- Raw signing secrets
- Unmasked sensitive bank data except where explicitly required for internal document rendering or posting

All records MUST be tenant scoped.

Cross-tenant source events MUST be rejected or fail safely.

---

## 20. Extending WFIS to New Modules

For a new source module, engineering MUST define:

1. Source module name.
2. Event family and event types.
3. Immutable source records.
4. Business dates.
5. Idempotency-key format.
6. Payload schema.
7. Counterparty/subledger mapping, if any.
8. Posting-rule templates or examples.
9. Reversal/correction semantics.
10. Module entitlement behavior.
11. Operational runbook.
12. Tests for idempotency, duplicate delivery, missing configuration, and posting failure.

Examples:

| Module      | Example event              | Notes                                                                 |
| ----------- | -------------------------- | --------------------------------------------------------------------- |
| Payroll     | `PAYROLL_RUN_APPROVED`     | Usually posts salary expense, statutory liabilities, payroll payable. |
| Inventory   | `GOODS_RECEIVED`           | Usually posts inventory/GRNI depending policy.                        |
| CRM/Billing | `CUSTOMER_INVOICE_ISSUED`  | Usually posts receivable and revenue/deferred revenue.                |
| Projects    | `PROJECT_COST_RECORDED`    | Usually posts project cost and payable/accrual.                       |
| Reinsurance | `PREMIUM_PAYMENT_RECEIVED` | Domain profile defines premium/cash-call/recovery semantics.          |

---

## 21. Compliance Checklist

A module integration is WFIS-compliant only if:

- Accounting can still operate manually without the module.
- Source events use the canonical envelope.
- HMAC transport is used for internal delivery.
- Idempotency keys are deterministic.
- Posting rules remain Accounting-owned.
- Source payloads do not include GL instructions.
- Tenant isolation is enforced.
- Missing Accounting entitlement does not block source-module operations.
- Outbox delivery is retryable and auditable.
- Duplicate deliveries do not create duplicate Accounting source events.
- Posted journals are immutable.
- Reversals are additive, not mutative.
- Operational diagnostics exist for missing config and failed deliveries.
