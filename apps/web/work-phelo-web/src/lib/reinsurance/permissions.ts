/**
 * Any-of permission rule lists that mirror the reinsurance-service controllers.
 *
 * Every granular workflow endpoint is guarded with
 *   @RequireAnyPermission(<granular>:RUN, <coarse operations.reinsurance.placements action>)
 * so holding EITHER the granular workflow permission OR the coarse placements
 * fallback lets the request through. The UI must gate the same way — pass these
 * arrays to `useAnyPermissionRules` so a role granted only the granular RUN
 * permission still sees the button, and a role with just the coarse placements
 * action keeps working.
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
  /** POST /placements/:id/payments/:paymentId/reverse. */
  reversePayment: [`${PR}.reverse-payment:RUN`, `${P}:EDIT`],

  // ── Claim workflows (placement-claims.controller.ts) ───────────────────────
  /** GET routes — @RequirePermissions(PlacementPermission.VIEW). */
  viewClaim: [`${P}:VIEW`],
  /**
   * POST /:id/claims — add a claim loss event / notification.
   * The backend also accepts placements:CREATE, but that leaks claim creation to
   * any offer-creator, so the UI requires a claims-specific permission here
   * (the granular RUN, or the coarse claims:CREATE held by claims-admin roles).
   */
  addClaim: [`${C}.add-claim:RUN`, `${C}:CREATE`],
  /** PATCH /:id/claims/:claimId — edit claim details / finalize. */
  editClaim: [`${P}:EDIT`],
  /** PATCH /:id/claims/:claimId/status — notify / void a claim. */
  claimStatusChange: [`${C}.create-notification:RUN`, `${C}.void-claim:RUN`, `${P}:EDIT`],
  /** POST /:id/claims/:claimId/cash-calls/:cashCallId/recovery-receipts. */
  recordRecovery: [`${C}.record-recovery:RUN`, `${P}:EDIT`],
} satisfies Record<string, string[]>;
