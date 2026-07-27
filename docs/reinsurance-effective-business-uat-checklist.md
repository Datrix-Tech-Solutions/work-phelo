# Reinsurance Effective Business Flow UAT Checklist

Use this checklist for the UAT branch `uat/reinsurance-effective-business-flow`.

Status values to use during testing: `PASS`, `FAIL`, `BLOCKED`, `NOT IMPLEMENTED`, `DEFERRED`.

## Branch Scope

- Includes canonical effective business view.
- Includes frontend current/effective placement state display.
- Includes effective financial position.
- Includes premium receipt and reinsurer disbursement alignment with effective financial position.
- Does not include a full claim recovery receipt/cedant settlement engine.

## Premium And Recovery Semantics

- Premium flow: `Cedant -> Broker -> Reinsurers`.
- Recovery flow: `Reinsurers -> Broker -> Cedant`.
- Premium settlement must not be labelled as recovery.
- Claim recovery obligations must come from backend claim allocations based on loss-date effective participation.

## Master Checklist

| ID | Scenario | Steps | Expected Result | Actual Result | Status | Severity | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A1 | Original placement only | Create placement, add participants, accept/validate closings. | Effective View equals original confirmed placement; no endorsement changes shown. |  |  |  |  |
| A2 | Premium receipt | Record cedant premium receipt after confirmed closings. | Payment is inbound from cedant, capped by effective cedant outstanding premium. |  |  |  |  |
| A3 | Reinsurer disbursement | Record reinsurer premium disbursement against a confirmed original closing. | Payment is outbound to reinsurer, tied to original closing, capped by effective reinsurer outstanding. |  |  |  |  |
| A4 | Payment reversal | Reverse premium receipt or reinsurer disbursement. | History remains visible; outstanding restores using effective payment totals. |  |  |  |  |
| B1 | Draft endorsement ignored | Create endorsement but leave DRAFT. | Current effective state remains original; endorsement appears as pending, not applied. |  |  |  |  |
| B2 | In-market endorsement ignored | Send endorsement to market without closing. | Current effective state remains original; endorsement appears pending. |  |  |  |  |
| B3 | Future-dated closed endorsement | Close endorsement with future effective date. | Current effective state unchanged; endorsement appears scheduled. |  |  |  |  |
| C1 | Capacity increase existing reinsurer | Revise existing participant upward, validate, close endorsement. | Effective participant replaces original line, no double count. |  |  |  |  |
| C2 | Capacity increase new reinsurer | Add new reinsurer for extra capacity, validate, close endorsement. | New reinsurer appears in effective participants; original participants remain immutable. |  |  |  |  |
| C3 | Multiple sequential endorsements | Increase, decrease, then increase again. | Effective state replays closed effective endorsements chronologically. |  |  |  |  |
| D1 | Decrease / return premium | Reduce capacity/premium and close endorsement. | Effective financial state decreases incrementally; return-premium impact is separated from premium receipt. |  |  |  |  |
| E1 | Administrative endorsement | Create no-premium-impact admin endorsement and close. | Effective terms update where supported; no financial note required if no financial impact. |  |  |  |  |
| F1 | Document history | Generate placement/endorsement documents across changes. | Historical documents remain accessible; current/superseded states are clear. |  |  |  |  |
| G1 | Claims allocation | Register claim with loss date before/after endorsements. | Allocations use backend loss-date effective participation, not current frontend rows. |  |  |  |  |
| G2 | Cash calls | Generate/issue/void claim cash calls. | Cash calls show backend status and history after refresh. |  |  |  |  |
| G3 | Claim recovery receipt | Try to record claim recovery payment. | Mark as `DEFERRED`; backend does not yet support claim settlement payment recording. |  |  | P1 | Recovery receipt/cedant settlement requires a later backend lifecycle. |
| H1 | Tenant branding | Generate new official documents after tenant profile/branding is configured. | New documents use snapshot branding; old documents do not change. |  |  |  |  |
| I1 | Audit/history | Perform validation, close, payment and reversal actions. | Backend history remains reconstructable; no hidden frontend-only state. |  |  |  |  |

## Known Deferred Items

| Area | Status | Reason |
| --- | --- | --- |
| Claim recovery receipts | `DEFERRED` | Backend rejects `CLAIM_SETTLEMENT` placement payments until claims settlement is implemented. |
| Cedant claim settlement | `DEFERRED` | No backend settlement-to-cedant lifecycle is implemented yet. |
| Accounting posting for premium/recovery events | `DEFERRED` | Accounting event publishing is intentionally out of scope for this branch. |
| Recovery overpayment/reversal rules | `DEFERRED` | Requires the dedicated claim recovery receipt model or lifecycle. |
