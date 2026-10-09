import type {
  MarketingInternalReviewStatus,
  MarketingOwnershipStatus,
  MarketingProviderVerificationStatus,
  MarketingSmsSenderIdentityStatus,
} from '../../prisma/generated/client';

export type SmsSenderReadinessInput = {
  status: MarketingSmsSenderIdentityStatus;
  ownershipStatus: MarketingOwnershipStatus;
  internalReviewStatus: MarketingInternalReviewStatus;
  providerStatus: MarketingProviderVerificationStatus;
};

/**
 * Future authoritative readiness rule. Campaign enforcement deliberately keeps
 * using the legacy APPROVED status until provider submission/sync ships.
 */
export function isSmsSenderEffectiveReady(sender: SmsSenderReadinessInput) {
  if (sender.status === 'ARCHIVED' || sender.status === 'SUSPENDED')
    return false;
  return (
    sender.ownershipStatus === 'VERIFIED' &&
    ['NOT_REQUIRED', 'APPROVED'].includes(sender.internalReviewStatus) &&
    sender.providerStatus === 'APPROVED'
  );
}

/**
 * Transitional compatibility rule for Phase 1A. This preserves current campaign
 * behavior while the provider-authoritative state is being introduced.
 */
export function isSmsSenderLegacyUsable(sender: {
  status: MarketingSmsSenderIdentityStatus;
}) {
  return sender.status === 'APPROVED';
}
