# Endorsement Closing / Credit Note Alignment

Management clarified that, in broker-facing business language, endorsement
closings represent the agreed credit-note position used by the business.

## Current Model

- `PlacementEndorsementClosing` remains the canonical agreed reinsurer closing
  snapshot for an endorsement participant.
- `PlacementNote` records with `ENDORSEMENT_CREDIT_NOTE` or
  `ENDORSEMENT_DEBIT_NOTE` remain the formal financial note/document records.
- Existing database model names are intentionally preserved to avoid a broad
  migration and API rename.

## Behavioural Rule

Endorsement force close and validation must create or reuse
`PlacementEndorsementClosing` snapshots from agreed endorsement participant
lines. Those snapshots are the source for downstream credit/debit note
generation and document rendering.

## Future Refactor Candidate

If the business permanently standardizes on "Credit Note" terminology for these
records, revisit API labels and UI copy separately. Do not rename database
models without a planned compatibility migration.
