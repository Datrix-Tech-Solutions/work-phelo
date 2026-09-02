/**
 * Any-of permission rule lists that gate the reinsurance workflow UI.
 *
 * FACULTATIVE OFFER lists mirror the controllers exactly:
 *   @RequireAnyPermission(<granular>:RUN, placements:<ACTION>)
 * — holding either the granular RUN permission or the coarse placements action
 * passes, so the UI gates the same way.
 *
 * CLAIM and PREMIUM lists deliberately DROP the coarse `placements:*` fallback
 * the backend still accepts. Every operations role holds `placements:VIEW` (via
 * OPERATIONS_BASE_RESOURCES) and offer roles hold `placements:CREATE/EDIT`, so
 * mirroring the backend would show every claim/premium control to any
 * offer-only role. These lists require a claims-domain / premiums-domain
 * permission instead. NOTE: this makes the UI stricter than the API — the
 * backend still accepts `placements:*` on those routes, so the complete fix is
 * to drop `PlacementPermission.*` from the claim/payment controller decorators.
 *
 * Keep in sync with:
 *  - apps/reinsurance-service/src/placements/placements.controller.ts
 *  - apps/reinsurance-service/src/placements/controllers/placement-claims.controller.ts
 *  - apps/reinsurance-service/src/placements/controllers/placement-endorsements.controller.ts
 *  - apps/reinsurance-service/src/placements/placement.permissions.ts
 */

const P = 'operations.reinsurance.placements';
const C = 'operations.reinsurance.claims';
const FO = 'operations.reinsurance.facultative-offers';
const PR = 'operations.reinsurance.premiums';

export const RiPerm = {
  // ── Facultative offer workflows (placements.controller.ts) ──────────────────
  /** POST /placements — also covers renewals (a renewal is a new offer). */
  createOffer: [`${FO}.create-offer:RUN`, `${P}:CREATE`],
  /** PATCH /placements/:id — material edit / Edit Slip. */
  editOffer: [`${FO}.edit-offer:RUN`, `${P}:EDIT`],
  /** PATCH /placements/:id — non-material edit (policy number etc.). */
  partialEdit: [`${FO}.partial-edit:RUN`, `${FO}.edit-offer:RUN`, `${P}:EDIT`],
  /** PATCH /placements/:id/status — reopen an unpaid closed offer. */
  reopenOffer: [`${FO}.reopen-offer:RUN`, `${P}:EDIT`],
  /** POST /placements/:id/force-close. */
  forceClose: [`${FO}.force-close:RUN`, `${P}:EDIT`],
  /** POST /placements/:id/endorsements — start a new endorsement. */
  endorseOffer: [`${FO}.endorse-offer:RUN`, `${P}:CREATE`],
  /**
   * Every endorsement mutation after creation — edit endorsement / status,
   * closings (create / validate-and-confirm / force-close / status), and
   * participants (add / edit / status / reinvite / remove). All guarded with
   * @RequireAnyPermission(endorse-offer:RUN, placements:EDIT). The single
   * `endorse_offer` role pill grants endorse-offer:RUN, which satisfies this.
   */
  manageEndorsement: [`${FO}.endorse-offer:RUN`, `${P}:EDIT`],
  /** DELETE /placements/:id — archive. */
  archiveOffer: [`${FO}.archive-offer:RUN`, `${P}:DELETE`],
  /** Participant add/edit/accept-and-confirm/status/delete routes. */
  editParticipants: [`${FO}.edit-offer:RUN`, `${P}:EDIT`],

  // ── Premium workflows (placements.controller.ts payments routes) ────────────
  /**
   * POST /placements/:id/payments — record an inbound or outbound premium.
   * The backend also accepts placements:CREATE, but that leaks premium entry to
   * any offer-creator, so the UI requires a premium-specific permission here.
   */
  addPayment: [`${PR}.receive-from-cedant:RUN`, `${PR}.disburse-to-reinsurer:RUN`],
  /**
   * POST /placements/:id/payments/:paymentId/reverse. Backend also accepts
   * placements:EDIT; the UI requires the premium permission.
   */
  reversePayment: [`${PR}.reverse-payment:RUN`],

  // ── Claim workflows (placement-claims.controller.ts) ───────────────────────
  /**
   * GET routes — backend checks placements:VIEW (which every operations role
   * has), so the UI gates on the claims-domain view permission instead.
   */
  viewClaim: [`${C}:VIEW`],
  /** POST /:id/claims — add a claim loss event / notification. */
  addClaim: [`${C}.add-claim:RUN`, `${C}:CREATE`],
  /**
   * PATCH /:id/claims/:claimId — edit claim details / finalize ("Move to Open").
   * Backend checks placements:EDIT; the UI requires a claims-workflow permission
   * (create a claim ⇒ amend it; run the notification workflow ⇒ finalize it).
   */
  editClaim: [`${C}.add-claim:RUN`, `${C}.create-notification:RUN`, `${C}:EDIT`],
  /** PATCH /:id/claims/:claimId/status — notify / void a claim. */
  claimStatusChange: [`${C}.create-notification:RUN`, `${C}.void-claim:RUN`, `${C}:EDIT`],
  /** POST /:id/claims/:claimId/cash-calls/:cashCallId/recovery-receipts. */
  recordRecovery: [`${C}.record-recovery:RUN`, `${C}:EDIT`],
} satisfies Record<string, string[]>;
