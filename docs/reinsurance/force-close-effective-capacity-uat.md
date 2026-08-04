# Endorsement Force Close Effective Capacity UAT

Version: 1.0
Date: 2026-08-04
Branch: `fix/reinsurance-force-close-effective-capacity`

## Purpose

Verify that an endorsement force close behaves like original placement force close:
the effective business position is based on confirmed closing snapshots, not the
proposed endorsement target capacity.

## Scenario

1. Create or use a placement with original confirmed placement capacity of 70%.
2. Create a capacity-increase endorsement with proposed target capacity of 80%.
3. Add/accept endorsement participant lines totaling only 5%.
4. Force close the endorsement.
5. Confirm the endorsement closes and creates confirmed endorsement closing
   snapshots totaling 5%.

Expected effective capacity:

- Original confirmed placement capacity: 70%
- Confirmed endorsement closing capacity: 5%
- Current effective capacity: 75%
- Remaining capacity: 0%

The proposed 80% target must not be displayed as current effective capacity once
force close has completed.

## Screens to Verify

| Screen / Consumer | Expected result |
| --- | --- |
| Placement Overview | Fac. Offer shows 75%, not 80%. |
| Placement Overview | Fac. Premium uses confirmed effective closing snapshots where available. |
| Effective View | `effectiveTotals.facultativeOfferPercent` is 75%. |
| Effective View | `capacityBreakdown.effectiveTotalCapacityPercent` is 75%. |
| Effective View | `effectiveTerms.facultativeOfferPercent` is 75%. |
| Current Effective Position | Participant rows total 75%. |
| Claims allocation | Generated allocations use 70% original snapshots plus 5% endorsement snapshots. |
| Premium calculations | Any capacity-derived premium uses 75% effective capacity or backend snapshot totals. |

## Non-Regression Checks

- Confirmed endorsement closing snapshots remain immutable.
- Original placement rows are not mutated by endorsement force close.
- Original placement force-close behavior remains unchanged.
- Accounting outbox/event behavior is unchanged.
- Payment workflows are unchanged.
- Draft, issued, void, cancelled, or future-dated endorsement closings do not
  contribute to current effective capacity.
