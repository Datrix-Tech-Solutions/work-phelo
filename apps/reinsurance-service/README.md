# Reinsurance Service

`reinsurance-service` is the bounded backend for broker-only Reinsurance
Operations. It is intentionally separate from HR and platform Core domains.

## Current Surface

The service foundation currently provides:

- Service bootstrapping on port `4007`.
- Runtime validation for `DATABASE_URL`, `JWT_SECRET` and `RABBITMQ_URL`.
- Prisma migration ownership of PostgreSQL schema `reinsurance`.
- Database-readiness health endpoint at `/api/health` using a lightweight
  PostgreSQL connectivity check.
- Protected access verification endpoint at `/api/access/verify`.
- JWT, tenant module, tenant feature and resource-action guard foundations.
- Tenant-scoped Counterparty, CounterpartyContact and CounterpartyAddress
  persistence for cedants, reinsurers and brokers.
- Tenant-scoped RiskClass, RiskType, RiskTypeField and Currency settings.
- Tenant-scoped facultative Placement, PlacementParticipant and
  PlacementStatusHistory persistence built on active Counterparties.
- Participant workflow, placement lifecycle transitions and capacity
  validation.
- Financial lock policy foundation for direct-edit gating before payments,
  endorsements, claims and accounting records are introduced.
- Read-only offer and closing slip preview endpoints that mirror the current
  frontend formulas.
- Email technical foundation for mailbox connection metadata, provider
  verification, sync proof-of-concept, thread/message metadata, attachment
  metadata and manual placement email links.
- Development-only Swagger/OpenAPI documentation for live contract discovery.

`/api/health` performs only a database connectivity check and is exposed
through `/api/v1/operations/reinsurance/health` for deployment verification.
It does not expose tenant data. `/api/access/verify` is reachable through
`/api/v1/operations/reinsurance/access/verify` only with authenticated,
entitled and authorized tenant context.

## Counterparties API

The gateway forwards these routes under
`/api/v1/operations/reinsurance/counterparties`:

| Method   | Service route             | Permission                                     |
| -------- | ------------------------- | ---------------------------------------------- |
| `GET`    | `/api/counterparties`     | `operations.reinsurance.counterparties:VIEW`   |
| `POST`   | `/api/counterparties`     | `operations.reinsurance.counterparties:CREATE` |
| `GET`    | `/api/counterparties/:id` | `operations.reinsurance.counterparties:VIEW`   |
| `PATCH`  | `/api/counterparties/:id` | `operations.reinsurance.counterparties:EDIT`   |
| `DELETE` | `/api/counterparties/:id` | `operations.reinsurance.counterparties:DELETE` |

List requests support `search`, `type`, `origin`, `country`, `page` and
`limit`. Deletion is a soft archive. Every record lookup and mutation is
scoped by authenticated `tenantId`; the service does not accept tenant
ownership from request bodies. Counterparties default to `LOCAL`. `FOREIGN`
counterparties require a two-letter ISO-style `country` code, normalized to
uppercase. When a `PATCH` body supplies `contacts` or `addresses`, the
supplied child collection replaces the stored collection within the same
tenant-scoped parent update.

## Placements API

The gateway forwards these routes under
`/api/v1/operations/reinsurance/placements`:

| Method   | Service route                                                           | Permission                                 |
| -------- | ----------------------------------------------------------------------- | ------------------------------------------ |
| `GET`    | `/api/placements`                                                       | `operations.reinsurance.placements:VIEW`   |
| `POST`   | `/api/placements`                                                       | `operations.reinsurance.placements:CREATE` |
| `GET`    | `/api/placements/:id`                                                   | `operations.reinsurance.placements:VIEW`   |
| `GET`    | `/api/placements/:id/lock-status`                                       | `operations.reinsurance.placements:VIEW`   |
| `PATCH`  | `/api/placements/:id`                                                   | `operations.reinsurance.placements:EDIT`   |
| `PATCH`  | `/api/placements/:id/status`                                            | `operations.reinsurance.placements:EDIT`   |
| `POST`   | `/api/placements/:id/participants`                                      | `operations.reinsurance.placements:EDIT`   |
| `PATCH`  | `/api/placements/:id/participants/:participantId`                       | `operations.reinsurance.placements:EDIT`   |
| `PATCH`  | `/api/placements/:id/participants/:participantId/status`                | `operations.reinsurance.placements:EDIT`   |
| `DELETE` | `/api/placements/:id/participants/:participantId`                       | `operations.reinsurance.placements:EDIT`   |
| `GET`    | `/api/placements/:id/endorsements`                                      | `operations.reinsurance.placements:VIEW`   |
| `POST`   | `/api/placements/:id/endorsements`                                      | `operations.reinsurance.placements:CREATE` |
| `GET`    | `/api/placements/:id/endorsements/:endorsementId`                       | `operations.reinsurance.placements:VIEW`   |
| `PATCH`  | `/api/placements/:id/endorsements/:endorsementId`                       | `operations.reinsurance.placements:EDIT`   |
| `PATCH`  | `/api/placements/:id/endorsements/:endorsementId/status`                | `operations.reinsurance.placements:EDIT`   |
| `GET`    | `/api/placements/:id/slips/offer-preview`                               | `operations.reinsurance.placements:VIEW`   |
| `GET`    | `/api/placements/:id/participants/:participantId/slips/closing-preview` | `operations.reinsurance.placements:VIEW`   |
| `DELETE` | `/api/placements/:id`                                                   | `operations.reinsurance.placements:DELETE` |

List requests support `search`, `status`, `placementType`, `cedantId`, `page`
and `limit`. Deletion is a soft archive. Every lookup and mutation is scoped
by the authenticated `tenantId`; request bodies cannot choose tenant ownership.

Placements currently support the broker-only facultative lifecycle. See the
[Placement Lifecycle Reference](#placement-lifecycle-reference) section below
for the full status reference, transition matrix, edit rules, participant
workflow and auto-recalculation rules.

When a `PATCH /placements/:id` body supplies `participants`, the supplied array
replaces the complete stored participant collection. Omit `participants` when
editing only placement header fields. Prefer the participant-specific endpoints
(`POST /participants`, `PATCH /participants/:id`,
`PATCH /participants/:id/status`, `DELETE /participants/:id`) so adding,
updating, removing and changing participant workflow status does not replace the
whole market snapshot.

Participant role validation is tied to Counterparty type:

| Participant role                              | Required counterparty type |
| --------------------------------------------- | -------------------------- |
| `BROKER`                                      | `BROKER`                   |
| `REINSURER`, `LEAD_REINSURER`, `CO_REINSURER` | `REINSURER`                |

## Placement Lifecycle Reference

### Placement status meanings

| Status             | Description                                                                                                          |
| ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `DRAFT`            | Being prepared. Not yet submitted to market. Fully editable.                                                         |
| `MARKETING`        | Submitted to the facultative market. No accepted capacity yet.                                                       |
| `PARTIALLY_PLACED` | At least one reinsurer has accepted a signed line but total accepted capacity is below the facultative offer target. |
| `PLACED`           | Total accepted signed capacity has reached or exceeded the facultative offer target.                                 |
| `CLOSING`          | Fully placed and entering the formal bind/close process. Avoid major structural edits.                               |
| `CLOSED`           | Formally closed. Direct edits blocked; may reopen to `CLOSING` only when no financial lock exists.                   |
| `DECLINED`         | All approached markets declined. Can return to `MARKETING` if re-marketed.                                           |
| `CANCELLED`        | Cancelled before close. Terminal — no edits.                                                                         |

### Allowed placement transitions

The backend enforces a strict transition matrix. An invalid transition returns
`400 Bad Request`.

| From               | Allowed next statuses                                 |
| ------------------ | ----------------------------------------------------- |
| `DRAFT`            | `MARKETING`, `CANCELLED`                              |
| `MARKETING`        | `PARTIALLY_PLACED`, `PLACED`, `DECLINED`, `CANCELLED` |
| `PARTIALLY_PLACED` | `MARKETING`, `PLACED`, `DECLINED`, `CANCELLED`        |
| `PLACED`           | `PARTIALLY_PLACED`, `CLOSING`, `CANCELLED`            |
| `CLOSING`          | `PLACED`, `CLOSED`, `CANCELLED`                       |
| `CLOSED`           | `CLOSING` when no financial lock exists               |
| `DECLINED`         | `MARKETING`                                           |
| `CANCELLED`        | — (terminal)                                          |

Transitions between `MARKETING`, `PARTIALLY_PLACED` and `PLACED` are also
triggered automatically by participant capacity recalculation. The
`PATCH /placements/:id/status` endpoint can advance these statuses manually
when needed (for example, to manually mark `DECLINED` after all markets have
declined before any participant status has been updated).

Every status change is recorded in `PlacementStatusHistory` with the actor,
timestamp, from/to status and an optional note.

`CLOSED` placements remain directly non-editable. If a closed placement has no
actual payment or settlement activity, reopen it to `CLOSING` through
`PATCH /placements/:id/status`, then apply edits through normal placement or
participant endpoints. If payment activity exists, reopening returns `409` and
the future endorsement workflow is required.

### Edit validation by placement status

| Status             | Header edit (`PATCH /placements/:id`)                         | Participant edits     |
| ------------------ | ------------------------------------------------------------- | --------------------- |
| `DRAFT`            | Full edit allowed                                             | Full edit allowed     |
| `MARKETING`        | Full edit allowed                                             | Full edit allowed     |
| `PARTIALLY_PLACED` | Full edit allowed; accepted shares must remain valid          | Full edit allowed     |
| `PLACED`           | Full edit allowed; accepted capacity should remain consistent | Full edit allowed     |
| `CLOSING`          | Structurally editable — avoid major capacity changes          | Structurally editable |
| `CLOSED`           | **Blocked — 400**                                             | **Blocked — 400**     |
| `DECLINED`         | Full edit allowed                                             | Full edit allowed     |
| `CANCELLED`        | **Blocked — 400**                                             | **Blocked — 400**     |

`CLOSED` placements cannot be archived either. Archive is only permitted when
the placement is not `CLOSED`.

### Financial lock policy

The financial lock policy answers whether a placement can still be directly
edited or whether a future endorsement workflow is required. It is exposed on
placement detail responses and through:

```http
GET /api/v1/operations/reinsurance/placements/:id/lock-status
```

Response shape:

```json
{
  "editable": true,
  "locked": false,
  "endorsementRequired": false,
  "reason": "Placement has no financial activity and can be edited.",
  "lockSource": "NONE"
}
```

Lifecycle locks and financial locks are intentionally separate:

- `CLOSED` and `CANCELLED` block direct edits. `CLOSED` can reopen to
  `CLOSING` only when no financial lock exists.
- The first recorded placement payment financially locks a placement.
- Debit note issuance alone is not a hard lock in the MVP policy; issued notes
  may be cancelled/reissued before payment.
- Reversal records do not unlock a placement; they preserve financial history.
- Offer and closing slip previews are read-only and remain available even when
  mutation actions are blocked.
- When `locked=true`, direct placement and participant mutations return `409`
  with `Placement is financially locked. Changes require endorsement.`

Payment records now provide the lock source. Debit/credit notes, endorsement
foundation, endorsement participants and endorsement closings are available;
receivable, payable, endorsement notes/payments and claims remain deferred.

## Placement Endorsement API

Endorsements are versioned child adjustment records linked to an original
placement. They may be created once at least one placement closing exists. Before
payment, direct placement edits are still allowed but a broker may create an
endorsement to formally version/document a change. After first payment, direct
edits are financially locked and endorsement becomes mandatory for business
changes. Endorsements do not add notes, payments, claims, accounting, PDFs,
emails or frontend changes.

PR2 adds endorsement-scoped participants. These are separate market response
records for the endorsement only; they do not alter original placement
participants.

PR3 adds endorsement-scoped closings created from accepted endorsement
participants. These closings snapshot endorsement version values and never
mutate original placement closings, participants, payments or notes.

```text
GET   /api/v1/operations/reinsurance/placements/:id/endorsements
POST  /api/v1/operations/reinsurance/placements/:id/endorsements
GET   /api/v1/operations/reinsurance/placements/:id/endorsements/:endorsementId
PATCH /api/v1/operations/reinsurance/placements/:id/endorsements/:endorsementId
PATCH /api/v1/operations/reinsurance/placements/:id/endorsements/:endorsementId/status
```

Core rules:

- At least one placement closing must exist before an endorsement can be
  created.
- Endorsements never mutate the original placement, participants, closings,
  payments or notes.
- The backend captures `originalSnapshot` when the endorsement is created.
- `proposedSnapshot` and `changeSummary` are stored as JSON for workflow and
  frontend review. Endorsement closings snapshot financial values from
  `proposedSnapshot` with fallback to `originalSnapshot.placement` for
  unchanged fields.
- Endorsement numbers use `END-001`, `END-002`, etc. scoped to the placement.
- Only `DRAFT` endorsements can be edited directly.
- `CLOSED`, `DECLINED` and `VOID` endorsements are terminal.

`targetPercent` is optional on the endorsement. When supplied, accepted
endorsement participant signed lines cannot exceed that target. When omitted,
the backend does not enforce a total accepted endorsement cap yet.

Lifecycle:

| Status               | Meaning                                      | Allowed next statuses                                |
| -------------------- | -------------------------------------------- | ---------------------------------------------------- |
| `DRAFT`              | Broker is preparing endorsement terms.       | `MARKETING`, `DECLINED`, `VOID`                      |
| `MARKETING`          | Endorsement is being offered to markets.     | `PARTIALLY_ACCEPTED`, `ACCEPTED`, `DECLINED`, `VOID` |
| `PARTIALLY_ACCEPTED` | Some endorsement capacity is accepted.       | `ACCEPTED`, `CLOSING`, `DECLINED`, `VOID`            |
| `ACCEPTED`           | Required endorsement terms are accepted.     | `CLOSING`, `DECLINED`, `VOID`                        |
| `CLOSING`            | Endorsement is moving toward formal closing. | `CLOSED`, `VOID`                                     |
| `CLOSED`             | Endorsement is complete.                     | terminal                                             |
| `DECLINED`           | Endorsement will not proceed.                | terminal                                             |
| `VOID`               | Endorsement was cancelled administratively.  | terminal                                             |

## Placement Endorsement Participants API

Endorsement participants represent reinsurer responses to a specific
endorsement. They are endorsement-scoped child records. They never mutate the
original `PlacementParticipant` rows captured on the placement.

```text
GET    /api/v1/operations/reinsurance/placements/:id/endorsements/:endorsementId/participants
POST   /api/v1/operations/reinsurance/placements/:id/endorsements/:endorsementId/participants
GET    /api/v1/operations/reinsurance/placements/:id/endorsements/:endorsementId/participants/:participantId
PATCH  /api/v1/operations/reinsurance/placements/:id/endorsements/:endorsementId/participants/:participantId
PATCH  /api/v1/operations/reinsurance/placements/:id/endorsements/:endorsementId/participants/:participantId/status
DELETE /api/v1/operations/reinsurance/placements/:id/endorsements/:endorsementId/participants/:participantId
```

Existing reinsurer flow:

- Use `originalParticipantId` when the reinsurer already has a participant row
  on the original placement.
- The `originalParticipantId` must belong to the same placement and the same
  counterparty as the endorsement participant.
- The original participant is read for validation only; it is not updated.

New reinsurer flow:

- Omit `originalParticipantId` when introducing a reinsurer that did not
  participate in the original placement.
- `counterpartyId` must still point to an active same-tenant `REINSURER`.
- New reinsurers remain endorsement-scoped until future endorsement closing and
  application workflows are implemented.

Endorsement participant duplicate rule:

- Only one active endorsement participant is allowed for a reinsurer in the same
  endorsement.
- `DECLINED` is inactive for duplicate checks, so a reinsurer can be re-added
  after declining if the broker needs to remarket revised terms.
- `CLOSED` remains historical and cannot be duplicated in this PR.

Capacity aggregates returned by the list endpoint:

```text
totalOfferedPercent  = sum of sharePercent for all endorsement participants
totalAcceptedPercent = sum of signedLinePercent for ACCEPTED/CLOSED participants
remainingPercent     = targetPercent - totalAcceptedPercent when targetPercent exists, otherwise null
declinedPercent      = sum of sharePercent for DECLINED participants
```

Validation rules:

- `sharePercent`, when supplied, must be greater than `0` and at most `100`.
- `ACCEPTED` requires `signedLinePercent > 0`.
- `signedLinePercent` cannot exceed `sharePercent` when both are supplied.
- If endorsement `targetPercent` is set, total accepted signed lines cannot
  exceed it.
- `DECLINED` participants do not contribute to accepted capacity.
- Participant mutations are blocked when the endorsement status is `CLOSED`,
  `DECLINED` or `VOID`.

### Participant status meanings

| Status       | Description                                                            |
| ------------ | ---------------------------------------------------------------------- |
| `INVITED`    | Reinsurer identified but not yet formally approached.                  |
| `OFFER_SENT` | Slip or offer terms sent to the reinsurer.                             |
| `QUOTED`     | Reinsurer has returned an indication or quote.                         |
| `ACCEPTED`   | Reinsurer accepted a signed line. Requires `signedLinePercent > 0`.    |
| `DECLINED`   | Reinsurer declined. Does not contribute to accepted capacity.          |
| `CLOSED`     | Participant's line formally closed. Terminal — no further transitions. |

### Participant status transitions

| From         | Allowed next statuses                |
| ------------ | ------------------------------------ |
| `INVITED`    | `OFFER_SENT`, `DECLINED`             |
| `OFFER_SENT` | `QUOTED`, `ACCEPTED`, `DECLINED`     |
| `QUOTED`     | `OFFER_SENT`, `ACCEPTED`, `DECLINED` |
| `ACCEPTED`   | `QUOTED`, `DECLINED`, `CLOSED`       |
| `DECLINED`   | `OFFER_SENT`                         |
| `CLOSED`     | — (terminal)                         |

## Placement Endorsement Closings API

Endorsement closings represent accepted endorsement business. They are separate
endorsement-scoped snapshots and do not mutate original `PlacementClosing`,
`PlacementParticipant`, `PlacementPayment` or `PlacementNote` records.

```text
GET   /api/v1/operations/reinsurance/placements/:id/endorsements/:endorsementId/closings
GET   /api/v1/operations/reinsurance/placements/:id/endorsements/:endorsementId/closings/:closingId
POST  /api/v1/operations/reinsurance/placements/:id/endorsements/:endorsementId/participants/:participantId/closings
PATCH /api/v1/operations/reinsurance/placements/:id/endorsements/:endorsementId/closings/:closingId/status
```

Creation rules:

- The endorsement must belong to the placement and authenticated tenant.
- `VOID` endorsements cannot create endorsement closings.
- The endorsement participant must belong to the same endorsement and placement.
- The endorsement participant must be `ACCEPTED`.
- `signedLinePercent` must be greater than `0`.
- Only one active endorsement closing is allowed per endorsement participant.
  Active means status is not `VOID`; after VOID, a new closing can be issued.

Snapshot rules:

- Endorsement closings use endorsement snapshot values, not live placement
  values.
- `proposedSnapshot` takes precedence, with fallback to
  `originalSnapshot.placement` for unchanged values.
- `premiumSnapshot` is the accepted participant allocation:
  `(signedLinePercent / 100) × endorsementPremiumSnapshot`.
- `commissionAmount`, `brokerageAmount` and `netPremium` follow the same
  closing math used by placement closings.
- No PDF, document storage, email, endorsement notes or endorsement payments are
  created in this foundation.

Numbering and lifecycle:

- Closing numbers use `ENC-001`, `ENC-002`, etc. scoped to the placement.
- Numbers are never reused. `VOID` closings keep their number.
- Lifecycle: `DRAFT → ISSUED → CONFIRMED`; `DRAFT`/`ISSUED → VOID`.
- `CONFIRMED` and `VOID` are terminal.

### Participant capacity validation rules

**Offered share (`sharePercent`) vs accepted/signed line (`signedLinePercent`)
are separate concepts.**

`sharePercent` is the percentage of the available offer being extended to a
participant. During the marketing phase the broker may extend the same available
share to multiple reinsurers simultaneously — for example, if `facultativeOffer`
is 30%, three separate reinsurers can each be offered 30% while only one (or a
combination) will ultimately accept. The aggregate `totalOfferedPercent` can
therefore exceed 100% and that is expected.

`signedLinePercent` is the amount a reinsurer actually agrees to take. Only
`ACCEPTED` participants' signed lines count against the facultative offer cap.

**Rules enforced on every participant write:**

- `ACCEPTED` participants **must** have `signedLinePercent > 0`.
- `signedLinePercent` cannot exceed `sharePercent` when both are explicitly
  provided.
- Total `signedLinePercent` of **ACCEPTED-only** participants must not exceed
  `facultativeOffer` (or `100` when `facultativeOffer` is not set). Attempting
  to add or accept beyond the cap returns `400 Bad Request`.
- `DECLINED` participants never contribute to the accepted capacity cap,
  regardless of their `signedLinePercent`.
- No global cap on `totalOfferedPercent` — the same share can be offered to as
  many participants as needed.

The three computed aggregates returned on every placement response are
authoritative — treat them as the source of truth, not derived values:

```
totalOfferedPercent  = sum of sharePercent for ALL participants (may exceed 100)
totalAcceptedPercent = sum of signedLinePercent for ACCEPTED participants only
remainingPercent     = max(0, (facultativeOffer ?? 0) − totalAcceptedPercent)
```

When `facultativeOffer` is absent, accepted-capacity validation and automatic
status derivation use `100` as the temporary maximum so brokers can record
market acceptances before the final facultative offer is known. Preview and
display calculations intentionally use `facultativeOffer ?? 0`; therefore
`remainingPercent` in API responses is calculated as
`max(0, (facultativeOffer ?? 0) - totalAcceptedPercent)`.

### Auto-recalculation rules

When any participant is added, updated or deleted on a placement whose current
status is `MARKETING`, `PARTIALLY_PLACED` or `PLACED`, the backend derives the
new placement status automatically from `totalAcceptedPercent`:

| `totalAcceptedPercent` condition                                    | Derived placement status |
| ------------------------------------------------------------------- | ------------------------ |
| `<= 0`                                                              | `MARKETING`              |
| `> 0` and below `facultativeOffer` (or temporary `100` when absent) | `PARTIALLY_PLACED`       |
| `>= facultativeOffer` (or temporary `100` when absent)              | `PLACED`                 |

Auto-recalculation is **skipped** for `DRAFT`, `CLOSING`, `CLOSED`,
`DECLINED` and `CANCELLED` placements. Participant changes on these statuses
are persisted normally; only the placement status derivation is skipped.

When recalculation changes the placement status a `PlacementStatusHistory`
entry is written automatically with note
`"Participant capacity recalculated placement status"`.

### Known follow-ups

The following items are documented so the frontend does not build assumptions
that conflict with future enforcement, and to serve as tracked follow-ups.

**`CANCELLED` placements can currently be archived.**
`assertArchivable()` guards against archiving `CLOSED` placements but not
`CANCELLED` ones. Since `CANCELLED` is also terminal, archiving it is
unintended. Recommended fix: add `CANCELLED` to the archive guard alongside
`CLOSED`. Impact: low-blast-radius edge case. Target: follow-up PR.

### Frontend integration guidance

- Use backend enum values directly in API calls (`DRAFT`, `MARKETING`, etc.).
  Map to display labels in the view layer only. Do not use old placeholder
  values like `Open`, `Closed`, `Pending` or `Expired` as API values.
- Display backend validation errors (`400` response `message` field) directly
  to the user for status transition and capacity errors — they are written for
  end-user readability.
- Use `PATCH /placements/:id/participants/:participantId/status` for participant
  workflow state changes. Do not store workflow status in `notes` JSON.
- Treat `totalOfferedPercent`, `totalAcceptedPercent` and `remainingPercent`
  from the placement response as the authoritative source — do not recompute
  them in the frontend.
- After a participant mutation the response already contains the updated
  placement (including the auto-recalculated status). No extra `GET` is needed.
- For `CLOSED` and `CANCELLED` placements, hide or disable all edit and archive
  actions entirely; do not rely on backend rejection as the first gate.
- A `409` on placement create or update means a duplicate `reference` already
  exists for this tenant — surface field-level feedback.

## Slip Preview API

Slip preview endpoints are read-only and do not create PDFs, persist document
records or send email. They return server-side preview data using the same
formulas that the current frontend modals use.

```text
GET /api/v1/operations/reinsurance/placements/:id/slips/offer-preview
GET /api/v1/operations/reinsurance/placements/:id/participants/:participantId/slips/closing-preview
```

Offer preview returns:

- Placement summary and cedant details.
- Dynamic `businessEntries` and `offerEntries`.
- Debit/guarantee-note financials.
- Participant preview rows with each participant's brokerage fee.
- `totalOfferedPercent`, `totalAcceptedPercent` and `remainingPercent`.

Closing preview returns:

- Placement summary, cedant and participant details.
- Dynamic `businessEntries` and `offerEntries`.
- Participant-specific slip financials.
- Closing row values.
- Credit-note financials.
- Debit/guarantee-note financials.

Closing preview requires:

- Participant status is `ACCEPTED` or `CLOSED`.
- Participant `signedLinePercent > 0`.

If `facultativeOffer` is omitted, preview calculations use
`facultativeOffer ?? 0`.

## Placement Closing API

Placement closings persist participant-specific financial snapshots after a
participant has accepted a signed line. They are not PDFs and they do not create
document registry entries, emails, payments, debit notes or credit notes.

```text
GET    /api/v1/operations/reinsurance/placements/:id/closings
GET    /api/v1/operations/reinsurance/placements/:id/closings/:closingId
POST   /api/v1/operations/reinsurance/placements/:id/participants/:participantId/closings
PATCH  /api/v1/operations/reinsurance/placements/:id/closings/:closingId/status
```

Closing creation rules:

- `placement.premium` is required because premium values are snapshotted.
- Participant status must be `ACCEPTED`.
- Participant `signedLinePercent` must be greater than `0`.
- Only one active closing is allowed per participant per placement.
- Active means `status !== VOID`; a new closing can be created after the
  previous one is voided.
- Closing numbers use `CLO-001`, `CLO-002`, etc. scoped to the placement.

## Placement Debit/Credit Note API

Placement notes persist debit and credit note records generated from confirmed
closing snapshots. Notes are not PDFs, do not create document registry entries,
do not send emails, and do not financially lock a placement.

```text
GET   /api/v1/operations/reinsurance/placements/:id/notes
GET   /api/v1/operations/reinsurance/placements/:id/notes/:noteId
POST  /api/v1/operations/reinsurance/placements/:id/notes/debit
POST  /api/v1/operations/reinsurance/placements/:id/closings/:closingId/notes/credit
PATCH /api/v1/operations/reinsurance/placements/:id/notes/:noteId/status
POST  /api/v1/operations/reinsurance/placements/:id/notes/:noteId/void
```

Debit notes:

- Use `DEBIT_NOTE` and `CEDANT_TO_BROKER`.
- Are generated at placement level for the placement cedant.
- Require at least one `CONFIRMED` closing.
- Use all confirmed closings as the source of truth.
- `grossAmount` is the sum of confirmed closing `grossPremium`.
- `commissionAmount` is the sum of confirmed closing `commissionAmount`.
- `brokerageAmount` is `null` for the MVP debit note.
- NIC levy and withholding tax are fixed at `0` in the MVP.
- `netAmount = grossAmount - commissionAmount - nicLevyAmount - withholdingTaxAmount`.

Credit notes:

- Use `CREDIT_NOTE` and `BROKER_TO_REINSURER`.
- Are generated per confirmed closing and reinsurer participant.
- Use the `PlacementClosing` snapshot as the source of truth.
- Copy `grossPremium`, `commissionPercent`, `commissionAmount`,
  `brokeragePercent`, `brokerageAmount`, `netPremium` and `currency` from the
  closing snapshot.
- Do not recalculate from live placement or participant values.

Note lifecycle:

| Status   | Meaning                          | Allowed next statuses |
| -------- | -------------------------------- | --------------------- |
| `DRAFT`  | Note created but not issued.     | `ISSUED`, `VOID`      |
| `ISSUED` | Note issued to the counterparty. | `VOID`                |
| `VOID`   | Note voided and inactive.        | terminal              |

Numbering:

- Debit notes use `DN-001`, `DN-002`, etc. scoped to the placement.
- Credit notes use `CN-001`, `CN-002`, etc. scoped to the placement.
- Numbers are never reused; voided notes retain their numbers.
- Only one active debit note is allowed per placement.
- Only one active credit note is allowed per closing.
- Active means `status !== VOID`; a new note can be generated after the
  previous note is voided.

Settlement is deferred. Payment remains the only hard financial lock trigger.
Locked placements may still list, view and generate notes from immutable
closing snapshots.

## Placement Claims API

Claims represent loss events first, not settlements. The current foundation
captures occurrence details, estimated loss, optional final loss, reinsurer
liability allocations and one-allocation-per-cash-call records. It does not
create claim debit/credit notes, settlement payments, recoveries, accounting
records, documents, PDFs or email workflows.

```text
GET   /api/v1/operations/reinsurance/placements/:id/claims
GET   /api/v1/operations/reinsurance/placements/:id/claims/:claimId
POST  /api/v1/operations/reinsurance/placements/:id/claims
PATCH /api/v1/operations/reinsurance/placements/:id/claims/:claimId
PATCH /api/v1/operations/reinsurance/placements/:id/claims/:claimId/status

GET   /api/v1/operations/reinsurance/placements/:id/claims/:claimId/allocations
POST  /api/v1/operations/reinsurance/placements/:id/claims/:claimId/allocations/generate

GET   /api/v1/operations/reinsurance/placements/:id/claims/:claimId/cash-calls
GET   /api/v1/operations/reinsurance/placements/:id/claims/:claimId/cash-calls/:cashCallId
POST  /api/v1/operations/reinsurance/placements/:id/claims/:claimId/allocations/:allocationId/cash-calls
PATCH /api/v1/operations/reinsurance/placements/:id/claims/:claimId/cash-calls/:cashCallId/status
POST  /api/v1/operations/reinsurance/placements/:id/claims/:claimId/cash-calls/:cashCallId/void
```

Claim fields:

- `claimNumber` uses `CLM-001`, `CLM-002`, etc. scoped to the placement.
- `occurrenceDate` is the loss event date.
- `reportedDate` is when the broker records/receives the claim.
- `claimCause` and `occurrenceDetails` describe the loss event.
- `estimatedLossAmount` captures the initial 100% loss estimate.
- `finalLossAmount` can be set later while the claim is `DRAFT`, `NOTIFIED` or
  `RESERVED`; setting it stamps `finalizedAt` and `finalizedByUserId`.

Claim lifecycle:

| Status              | Meaning                                        | Allowed next statuses           |
| ------------------- | ---------------------------------------------- | ------------------------------- |
| `DRAFT`             | Claim recorded but not notified.               | `NOTIFIED`, `DECLINED`, `VOID`  |
| `NOTIFIED`          | Claim has been notified internally/externally. | `RESERVED`, `DECLINED`, `VOID`  |
| `RESERVED`          | Claim reserve/liability review is underway.    | `PARTIALLY_SETTLED`, `DECLINED` |
| `PARTIALLY_SETTLED` | Reserved for future partial settlement flow.   | `SETTLED`                       |
| `SETTLED`           | Reserved for future settlement completion.     | `CLOSED`                        |
| `DECLINED`          | Claim declined.                                | terminal                        |
| `CLOSED`            | Claim fully closed.                            | terminal                        |
| `VOID`              | Claim voided and inactive.                     | terminal                        |

Claim allocations:

- Are generated explicitly with
  `POST /placements/:id/claims/:claimId/allocations/generate`.
- Use only `CONFIRMED` `PlacementClosing` and `PlacementEndorsementClosing`
  snapshots.
- Are generated once per claim. Existing allocations are not automatically
  recalculated if `finalLossAmount` changes later; future cash call or
  settlement workflows should add explicit adjustment/reissue behavior.
- Exclude `DRAFT`, `ISSUED` and `VOID` closings.
- Do not use live participant or endorsement participant values.
- Do not mutate placements, participants, closings, notes, payments or
  endorsements.
- Use exactly one source per allocation: `placementClosingId` or
  `endorsementClosingId`.
- `basisAmount = finalLossAmount ?? estimatedLossAmount`.
- `allocatedEstimatedLossAmount = estimatedLossAmount * signedLinePercent / 100`.
- `allocatedFinalLossAmount = finalLossAmount * signedLinePercent / 100` when a
  final loss amount exists.
- `cashCallAmount` and `paidAmount` are reserved on the allocation row for
  future settlement tracking. Cash-call generation does not mutate them.

Claim cash calls:

- Are generated explicitly with
  `POST /placements/:id/claims/:claimId/allocations/:allocationId/cash-calls`.
- Use the claim allocation as the source of truth. They do not recalculate from
  live participants, placement closings or endorsement closings.
- Use `allocatedFinalLossAmount` when present; otherwise they use
  `allocatedEstimatedLossAmount`.
- Snapshot `basisAmount`, `signedLinePercent`, `currency` and `counterpartyId`
  from the allocation.
- Use `CCL-001`, `CCL-002`, etc. scoped to the placement. Numbers are never
  reused; voided cash calls retain their numbers.
- Allow one active cash call per allocation. Active means status is not `VOID`.
  After a cash call is voided, the same allocation can be reissued with the next
  `CCL-*` number.
- Do not mutate claim allocations, closings, notes, payments, placements or
  endorsements.
- Do not financially lock or unlock placements. Payment remains the only hard
  financial lock trigger.

Claim cash call lifecycle:

| Status   | Meaning                                             | Allowed next statuses |
| -------- | --------------------------------------------------- | --------------------- |
| `DRAFT`  | Cash call created but not issued.                   | `ISSUED`, `VOID`      |
| `ISSUED` | Cash call has been issued externally.               | `VOID`                |
| `PAID`   | Reserved for future claim settlement payment links. | terminal              |
| `VOID`   | Cash call was voided and may be reissued.           | terminal              |

Claim creation, allocation generation and cash-call issuance do not financially
lock placements. Payment remains the only hard financial lock trigger.
`CLAIM_SETTLEMENT` payments remain deferred and guarded until explicit claim
settlement APIs are implemented.

## Placement Payment API

Placement payments record the first MVP financial activity for a placement.
Payments are immutable after creation: there is no `PATCH` or `DELETE`.
Corrections are represented with reversal records.

```text
GET  /api/v1/operations/reinsurance/placements/:id/payments
GET  /api/v1/operations/reinsurance/placements/:id/payments/:paymentId
POST /api/v1/operations/reinsurance/placements/:id/payments
POST /api/v1/operations/reinsurance/placements/:id/payments/:paymentId/reverse
```

Supported payment types:

- `PREMIUM_RECEIVED` — inbound premium received from the placement cedant.
- `REINSURER_DISBURSEMENT` — outbound premium paid to a reinsurer participant.
- `CLAIM_SETTLEMENT` — reserved until the claims domain is implemented.

Payment creation rules:

- The placement must be active in the authenticated tenant.
- At least one `CONFIRMED` closing must exist before payment can be recorded.
- `amount` must be greater than `0`.
- `currency` is required and must match the placement currency for MVP.
- `PREMIUM_RECEIVED` must use `direction=INBOUND`, the placement cedant as
  `counterpartyId`, and no `closingId` or `participantId`.
- `REINSURER_DISBURSEMENT` must use `direction=OUTBOUND`, a reinsurer
  counterparty, and matching `closingId` plus `participantId` for a
  `CONFIRMED` closing.

Financial locking behavior:

- The first recorded payment locks the placement.
- Payment creation remains allowed after lock so additional receipts or
  disbursements can be recorded.
- Placement updates, archive, participant add/update/delete and participant
  status changes return `409` after lock.
- Read-only endpoints remain available, including placement detail, closings,
  slip previews, lock status and payments list/detail.
- Reversing a payment creates an auditable negative reversal record, may mark
  the original as `REVERSED`, and does not unlock the placement.

Closing lifecycle:

| Status      | Meaning                                     | Allowed next statuses |
| ----------- | ------------------------------------------- | --------------------- |
| `DRAFT`     | Snapshot created, not issued.               | `ISSUED`, `VOID`      |
| `ISSUED`    | Closing has been issued to the participant. | `CONFIRMED`, `VOID`   |
| `CONFIRMED` | Closing is confirmed by the participant.    | terminal              |
| `VOID`      | Closing was voided and is no longer active. | terminal              |

Closing responses include participant and reinsurer summaries plus decimal-safe
snapshot values as strings: `signedLinePercent`, `sharePercent`,
`grossPremium`, `commissionPercent`, `commissionAmount`, `brokeragePercent`,
`brokerageAmount`, `netPremium` and `currency`. These values are captured at
creation time and should be displayed as the closing record, not recomputed from
the current placement or participant.

## Risk Settings API

Frontend integrations should use the explicit Risk Class and Risk Type routes:

```text
GET    /api/v1/operations/reinsurance/settings/risk-classes
POST   /api/v1/operations/reinsurance/settings/risk-classes
GET    /api/v1/operations/reinsurance/settings/risk-classes/:id
PATCH  /api/v1/operations/reinsurance/settings/risk-classes/:id
DELETE /api/v1/operations/reinsurance/settings/risk-classes/:id

GET    /api/v1/operations/reinsurance/settings/risk-types
POST   /api/v1/operations/reinsurance/settings/risk-types
GET    /api/v1/operations/reinsurance/settings/risk-types/:id
PATCH  /api/v1/operations/reinsurance/settings/risk-types/:id
DELETE /api/v1/operations/reinsurance/settings/risk-types/:id

POST   /api/v1/operations/reinsurance/settings/risk-types/:id/fields
PATCH  /api/v1/operations/reinsurance/settings/risk-types/:id/fields/:fieldId
DELETE /api/v1/operations/reinsurance/settings/risk-types/:id/fields/:fieldId
GET    /api/v1/operations/reinsurance/settings/risk-types/:id/form-schema
```

The storage model has moved from BusinessClass/BusinessClassField to
RiskClass/RiskType/RiskTypeField. Frontend integrations should use the explicit
Risk Class and Risk Type routes listed above.

Recommended setup flow:

1. Create a risk class with `POST /settings/risk-classes`.
2. Create one or more risk types with `POST /settings/risk-types`.
3. Add dynamic fields with `POST /settings/risk-types/:riskTypeId/fields`.
4. Fetch the dynamic form schema with
   `GET /settings/risk-types/:riskTypeId/form-schema`.
5. Create placements with `riskTypeId` plus `businessDetails` and
   `offerDetails`.

Example create risk class payload:

```json
{
  "name": "Marine",
  "description": "Marine insurance risks",
  "isActive": true,
  "displayOrder": 0
}
```

Example create risk type payload:

```json
{
  "riskClassId": "5af43f8f-ec68-41c4-9096-1a89c9fcb23b",
  "name": "Marine Cargo",
  "description": "Cargo transported by sea",
  "isActive": true,
  "displayOrder": 0
}
```

Example create risk type field payload:

```json
{
  "section": "BUSINESS_DETAILS",
  "fieldKey": "vessel_name",
  "label": "Vessel Name",
  "fieldType": "TEXT",
  "required": true,
  "placeholder": "e.g. MV Ocean Pioneer",
  "displayOrder": 0,
  "isActive": true
}
```

## OpenAPI Documentation

Swagger is enabled only when `ENABLE_SWAGGER=true`. The dev deployment writes
that flag for the gateway and Reinsurance service; production does not.

| Access path          | URL                                                        |
| -------------------- | ---------------------------------------------------------- |
| Direct local service | `http://localhost:4007/api/docs`                           |
| Local gateway        | `http://localhost:4000/api/v1/operations/reinsurance/docs` |
| Dev gateway          | `/api/v1/operations/reinsurance/docs`                      |

The Swagger UI exposes both a gateway server and a direct-service server.
Select the gateway server when testing browser-facing integration. Protected
endpoints accept the HTTP-only `access_token` cookie established by login, or
a Bearer token for API tooling. Documentation routes and their assets are
public through the gateway only when `ENABLE_SWAGGER=true`; the dev deployment
sets that flag and the production deployment does not. For local development,
set `ENABLE_SWAGGER=true` in both `apps/reinsurance-service/.env` and
`apps/api-gateway/.env`.

## Frontend Integration Handoff

The Next.js application should call only the gateway surface:

```ts
const COUNTERPARTIES_PATH = '/operations/reinsurance/counterparties';
const PLACEMENTS_PATH = '/operations/reinsurance/placements';
const RISK_CLASSES_PATH = '/operations/reinsurance/settings/risk-classes';
const RISK_TYPES_PATH = '/operations/reinsurance/settings/risk-types';
const CURRENCIES_PATH = '/operations/reinsurance/settings/currencies';
```

The existing Axios instance in `apps/web/work-phelo-web/src/lib/api.ts`
already uses `baseURL: '/api/v1'` and `withCredentials: true`, so the
HTTP-only access cookie is sent automatically. Do not read or store tokens in
frontend code.

### Authorization Flow

A tenant user can use Counterparties only when all of the following are true:

- The tenant has `moduleConfig.operations` enabled.
- The tenant has `featureConfig.operations.reinsurance` enabled.
- The user has the relevant action permission:
  `operations.reinsurance.counterparties:VIEW`, `CREATE`, `EDIT` or `DELETE`.

Frontend handling expectations:

| HTTP status | Meaning                                          | UI behavior                                       |
| ----------- | ------------------------------------------------ | ------------------------------------------------- |
| `401`       | Session is missing or expired                    | Let the shared refresh/login flow handle it       |
| `403`       | Entitlement or permission is unavailable         | Show access-denied state; hide disallowed actions |
| `404`       | Record is absent, archived or outside the tenant | Return to list or show unavailable record         |
| `409`       | Active type/name combination already exists      | Show field-level duplicate feedback               |

### Counterparty Contract Examples

List active records:

```http
GET /api/v1/operations/reinsurance/counterparties?search=ghana&type=REINSURER&origin=FOREIGN&country=NG&page=1&limit=20
```

```ts
type CounterpartyType = 'CEDANT' | 'REINSURER' | 'BROKER';
type CounterpartyOrigin = 'LOCAL' | 'FOREIGN';

interface CounterpartiesResponse {
  items: Counterparty[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
```

Create payload:

```json
{
  "type": "CEDANT",
  "origin": "LOCAL",
  "name": "Acme Insurance Ltd",
  "registrationNumber": "C-00123",
  "taxId": "TIN-0042024",
  "licenseNumber": "NIC/2024/001",
  "email": "operations@acme.example",
  "contacts": [
    {
      "fullName": "Ama Mensah",
      "jobTitle": "Treaty Manager",
      "email": "ama@example.com",
      "isPrimary": true
    }
  ],
  "addresses": [
    {
      "label": "Head Office",
      "line1": "1 Independence Avenue",
      "city": "Accra",
      "country": "GH",
      "isPrimary": true
    }
  ]
}
```

For foreign counterparties, include `country`:

```json
{
  "type": "REINSURER",
  "origin": "FOREIGN",
  "name": "Continental Re Nigeria",
  "country": "NG",
  "licenseNumber": "NAICOM/2024/001"
}
```

`POST` and `PATCH` return the stored counterparty including nested
`contacts` and `addresses`. `DELETE /counterparties/:id` soft-archives and
returns the archived record; archived records are excluded from regular list
and detail requests. A `PATCH` request that includes `contacts` or `addresses`
replaces that entire child collection, so edit forms should submit the full
current collection or omit that property.

### Recommended React Query Shape

Use an Operations-specific API/type/hooks boundary rather than placing new
domain calls in HR hooks:

```text
src/
├── hooks/operations/reinsurance/useCounterparties.ts
├── lib/operations/reinsurance/counterparties-api.ts
├── types/operations/reinsurance.ts
└── app/[tenantSlug]/operations/reinsurance/counterparties/
```

Recommended query keys and mutations:

```ts
const counterpartyKeys = {
  all: ['operations', 'reinsurance', 'counterparties'] as const,
  list: (params: CounterpartyQuery) =>
    [...counterpartyKeys.all, 'list', params] as const,
  detail: (id: string) => [...counterpartyKeys.all, 'detail', id] as const,
};
```

- Use `useQuery` for paginated/searchable lists and individual detail pages.
- Debounce search input before updating query parameters.
- Use `useMutation` for create, update and archive, then invalidate list and
  affected detail keys after success.
- Prefer refetch/invalidation over optimistic archive or child replacement
  until the UI is stable; replacement semantics make optimistic rollback
  unnecessarily fragile for the MVP.
- Render an archive confirmation dialog instead of a destructive-delete label.

### Placement Contract Examples

List active placements:

```http
GET /api/v1/operations/reinsurance/placements?search=FAC-2026&status=MARKETING&placementType=FACULTATIVE&page=1&limit=20
```

Create payload:

```json
{
  "reference": "FAC-2026-0001",
  "title": "Acme Energy Facultative Placement",
  "cedantId": "7c2d7cae-1dd2-4a7c-9332-4a23f2e1b9a9",
  "riskTypeId": "5f28e76c-35b0-4bf2-95e3-7cf143feef15",
  "businessDetails": {
    "projectType": "Offshore drilling",
    "equipmentValue": 12000000,
    "contractorDetails": "Kente Engineering Ltd"
  },
  "offerDetails": {
    "offeredShare": 45,
    "proposedRate": 12.5,
    "leader": "Acme Re"
  },
  "inceptionDate": "2026-06-01T00:00:00.000Z",
  "expiryDate": "2027-05-31T23:59:59.000Z",
  "currency": "USD",
  "sumInsured": 5000000,
  "participants": [
    {
      "counterpartyId": "2ee7957a-5a47-472b-95d1-983c2d86be16",
      "role": "LEAD_REINSURER",
      "sharePercent": 45
    }
  ]
}
```

Change status:

```http
PATCH /api/v1/operations/reinsurance/placements/:id/status
```

```json
{
  "status": "MARKETING",
  "note": "Submitted to selected markets."
}
```

Add a participant without replacing the full participant list:

```http
POST /api/v1/operations/reinsurance/placements/:id/participants
```

```json
{
  "counterpartyId": "2ee7957a-5a47-472b-95d1-983c2d86be16",
  "role": "REINSURER",
  "sharePercent": 30,
  "brokerageFee": 7.5
}
```

Record a participant's accepted/taken line:

```http
PATCH /api/v1/operations/reinsurance/placements/:id/participants/:participantId
```

```json
{
  "signedLinePercent": 20
}
```

Then move the participant to accepted:

```http
PATCH /api/v1/operations/reinsurance/placements/:id/participants/:participantId/status
```

```json
{
  "status": "ACCEPTED",
  "note": "Accepted by email."
}
```

Decimal values such as `sumInsured`, `sharePercent` and
`signedLinePercent` are accepted as numbers in requests and are returned by
Prisma as JSON strings. Frontend types should model them as `string | null`
on responses and convert only at display/form boundaries.

`facultativeOffer` is optional in create and update payloads. If omitted, the
placement can still be created and preview endpoints still return data. The
backend uses `facultativeOffer ?? 0` for preview/display calculations and uses
temporary `100` as the acceptance cap until an offer value is known.

Placement fields are split into:

- Fixed fields: `cedantId`, `placementType`, `riskTypeId`, `classOfBusiness`, `status`,
  `currency`, `sumInsured`, `inceptionDate`, `expiryDate`, `participants`.
- Dynamic fields: `businessDetails` and `offerDetails` (JSON objects) that are
  driven by `riskTypeId` and should be rendered from the risk type form schema.
  When `riskTypeId` is supplied, the backend validates these JSON keys against
  active RiskTypeField definitions and denormalizes `classOfBusiness` from the
  selected RiskType name.

Recommended placement frontend structure:

```text
src/
├── hooks/operations/reinsurance/usePlacements.ts
├── lib/operations/reinsurance/placements-api.ts
├── types/operations/reinsurance.ts
└── app/[tenantSlug]/operations/reinsurance/placements/
```

Use placement query keys parallel to Counterparties:

```ts
const placementKeys = {
  all: ['operations', 'reinsurance', 'placements'] as const,
  list: (params: PlacementQuery) =>
    [...placementKeys.all, 'list', params] as const,
  detail: (id: string) => [...placementKeys.all, 'detail', id] as const,
};
```

Prefer mutation success invalidation over optimistic updates for the first UI
pass because participant replacement and status history make optimistic
rollback more complex than the MVP needs.

Current frontend note: the initial Facultative UI uses placeholder labels like
`Pending`, `Active`, `Expired` and `Cancelled`. When wiring it to this API,
use the backend lifecycle statuses directly in API calls and map labels in the
view layer, for example `DRAFT`/`MARKETING` as open work-in-progress states,
`PARTIALLY_PLACED`/`PLACED`/`CLOSING` as active placement states, `CLOSED` as
closed, `DECLINED` as declined and `CANCELLED` as cancelled.
The backend does not expose split `/cedants`, `/reinsurers` or `/brokers`
placement endpoints; retrieve those through `/counterparties?type=...`.

Frontend mapping guidance:

- Use `GET /settings/risk-types/:riskTypeId/form-schema` to render
  class-specific `businessDetails` and `offerDetails` sections.
- Submit the values from those dynamic sections under `businessDetails` and
  `offerDetails` respectively, together with the selected `riskTypeId`.
- Keep search/reportable fields in fixed columns; do not push UI labels into
  backend status enums.

### Current Frontend Catch-up Checklist

- Replace old placement statuses (`QUOTED`, `BOUND`) with the current backend
  placement lifecycle values.
- Add a mutation for `PATCH /placements/:id/status`.
- Drive participant action buttons from persisted participant status, not
  local-only mail state.
- Add hooks for `offer-preview` and `closing-preview` and hydrate the preview
  modals from backend responses.
- Treat `facultativeOffer` as optional where the product flow allows draft
  placements before the offer is known.
- Add or restore a Risk Class selector before Risk Type selection, or fetch
  risk types without an empty class filter.
- Use backend `totalOfferedPercent`, `totalAcceptedPercent` and
  `remainingPercent` instead of recomputing placement aggregates client-side.

## Reinsurance UAT Guide

Use this path to validate the current broker-only MVP before adding document,
email distribution or endorsement work.

1. Create setup data:
   - Currency.
   - Cedant.
   - Reinsurers.
   - Broker if needed.
   - Risk Class.
   - Risk Type.
   - Risk Type Fields.
2. Create a placement without `facultativeOffer`.
   - Expected: placement is accepted.
   - Expected: preview values use `facultativeOffer ?? 0`.
3. Create or update a placement with `facultativeOffer`.
   - Expected: capacity target uses the supplied offer value.
4. Move placement from `DRAFT` to `MARKETING`.
5. Add multiple reinsurer participants.
   - Expected: total offered capacity may exceed 100.
6. Mark one participant `OFFER_SENT`, then record a `signedLinePercent` and
   move that participant to `ACCEPTED`.
   - Expected: placement recalculates to `PARTIALLY_PLACED` when accepted
     capacity is below the target.
7. Accept enough signed lines to reach the offer target.
   - Expected: placement recalculates to `PLACED`.
8. Generate offer preview.
   - Expected: no PDF/document/email is created.
9. Generate closing preview for an accepted participant.
   - Expected: accepted/closed participant with signed line succeeds.
   - Expected: non-accepted participant or zero signed line returns `400`.
10. Move placement from `PLACED` to `CLOSING`, then `CLOSED`.
    - Expected: closed placements are read-only.

## Future Roadmap

Current:

- Core broker-only placement workflow complete.
- Counterparties complete for cedants, reinsurers and brokers.
- Risk Classes, Risk Types, Risk Type Fields and Currency Settings complete.
- Participant workflow and placement lifecycle complete.
- Capacity validation complete.
- Slip Preview MVP complete.
- Email technical foundation complete.
- Endorsement foundation complete.
- Endorsement participants and endorsement closings complete.

Deferred:

- Slip/document generation and storage.
- Offer slip distribution.
- Closing slip distribution.
- Full send/reply/forward email workflow.
- Endorsement notes and payments.
- Payments & Covers.
- Claims.

Endorsements must not be modeled as direct silent mutations of a closed or
financially locked placement. UAT should continue capturing examples such as
sum insured changes, premium adjustments, participant share changes,
participant additions/removals, risk detail amendments and coverage amendments
before endorsement notes, payments and application workflows are implemented.

## Email Foundation API

This phase establishes the technical base for embedded Reinsurance mailbox
workflows. It is intentionally not the full email workflow MVP yet.

Implemented now:

- Mailbox connection metadata and encrypted OAuth token storage.
- Microsoft Graph provider abstraction and connection verification.
- Manual sync proof-of-concept for recent message metadata.
- Email threads, messages and attachment metadata persistence.
- Manual placement-to-thread/message links.

Deferred:

- Sending, replying and forwarding.
- Attachment file downloads.
- AI parsing or OCR.
- Automatic placement/counterparty updates.
- Webhook subscriptions and background schedulers.

Microsoft Graph is the recommended first production provider because most
broker operations teams use Outlook/Exchange and Graph gives clean OAuth,
thread/message metadata and attachment metadata APIs. Gmail remains reserved
in the enum for future provider support but is not enabled yet.

Mailbox token encryption uses `REINSURANCE_MAILBOX_TOKEN_ENCRYPTION_KEY`.
This variable is not required for service boot, but it is required before any
mailbox token can be stored or decrypted. Use a 32-byte key encoded as 64 hex
characters or base64. Never expose encrypted tokens through API responses.

The gateway forwards these routes:

| Method   | Gateway route                                                                         | Permission                                   |
| -------- | ------------------------------------------------------------------------------------- | -------------------------------------------- |
| `GET`    | `/api/v1/operations/reinsurance/email/mailboxes`                                      | `operations.reinsurance.email-settings:VIEW` |
| `POST`   | `/api/v1/operations/reinsurance/email/mailboxes/connect`                              | `operations.reinsurance.email-settings:EDIT` |
| `POST`   | `/api/v1/operations/reinsurance/email/mailboxes/:id/verify`                           | `operations.reinsurance.email-settings:EDIT` |
| `POST`   | `/api/v1/operations/reinsurance/email/mailboxes/:id/sync`                             | `operations.reinsurance.email-settings:EDIT` |
| `DELETE` | `/api/v1/operations/reinsurance/email/mailboxes/:id`                                  | `operations.reinsurance.email-settings:EDIT` |
| `GET`    | `/api/v1/operations/reinsurance/email/threads`                                        | `operations.reinsurance.email:VIEW`          |
| `GET`    | `/api/v1/operations/reinsurance/email/threads/:id`                                    | `operations.reinsurance.email:VIEW`          |
| `GET`    | `/api/v1/operations/reinsurance/email/messages`                                       | `operations.reinsurance.email:VIEW`          |
| `POST`   | `/api/v1/operations/reinsurance/email/threads/:threadId/placements/:placementId/link` | `operations.reinsurance.email:EDIT`          |
| `DELETE` | `/api/v1/operations/reinsurance/email/links/:id`                                      | `operations.reinsurance.email:EDIT`          |

Connect payload:

```json
{
  "provider": "MICROSOFT_GRAPH",
  "emailAddress": "placements@broker.example",
  "displayName": "Reinsurance Placements",
  "accessToken": "oauth-access-token",
  "refreshToken": "oauth-refresh-token",
  "tokenExpiresAt": "2026-05-28T12:00:00.000Z"
}
```

The access and refresh tokens are write-only inputs. Responses return mailbox
metadata only. `sync` stores provider message metadata and attachment metadata
only; it does not download attachment content.

Email frontend integration should follow the same route/key style as
Counterparties and Placements:

```text
src/
├── hooks/operations/reinsurance/useEmail.ts
├── lib/operations/reinsurance/email-api.ts
├── types/operations/reinsurance-email.ts
└── app/[tenantSlug]/operations/reinsurance/email/
```

Recommended query keys:

```ts
const emailKeys = {
  all: ['operations', 'reinsurance', 'email'] as const,
  mailboxes: (params: MailboxQuery) =>
    [...emailKeys.all, 'mailboxes', params] as const,
  threads: (params: EmailThreadQuery) =>
    [...emailKeys.all, 'threads', params] as const,
  messages: (params: EmailMessageQuery) =>
    [...emailKeys.all, 'messages', params] as const,
};
```

Prefer refetch/invalidation after mailbox sync and manual link mutations.
Avoid optimistic updates for sync because provider state and local persistence
can diverge during the foundation phase.

## Boundary Rules

- Use authenticated tenant context for every business query.
- Require `moduleConfig.operations`, `featureConfig.operations.reinsurance`
  and endpoint-specific `operations.reinsurance.*` actions for tenant-facing
  routes.
- Trust dynamic permission headers only when signed by the API gateway.
- Do not query Core service database schemas.
- Use Core notification and audit contracts instead of owning those records.
- Store broker workflow records only in the `reinsurance` schema.
- Publish `reinsurance.counterparty.*`, `reinsurance.placement.*` and
  `reinsurance.email.*` lifecycle events to Auth for central audit
  persistence; event failure is logged after a successful domain write.

## Development Deployment

The dev deployment builds and runs `reinsurance-service`, applies its Prisma
migrations, validates its runtime environment and checks direct and gateway
health reachability. Production activation is intentionally deferred until
the dev access verification step has been exercised with an entitled tenant.
Prisma Client generation now runs before builds, type checks, linting and
tests because Counterparties is the first persisted Reinsurance domain.

Detailed Reinsurance planning documentation is maintained internally/local-only
and is intentionally not tracked in Git.
