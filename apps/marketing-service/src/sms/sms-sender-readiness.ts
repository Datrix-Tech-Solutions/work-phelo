import type {
  MarketingInternalReviewStatus,
  MarketingOwnershipStatus,
  MarketingProviderVerificationStatus,
  MarketingSmsSenderIdentity,
  MarketingSmsSenderIdentityStatus,
} from '../../prisma/generated/client';
import type { SmsProviderName } from '@work-phelo/types';

export type SmsSenderReadinessInput = {
  status: MarketingSmsSenderIdentityStatus;
  ownershipStatus: MarketingOwnershipStatus;
  internalReviewStatus: MarketingInternalReviewStatus;
  providerStatus: MarketingProviderVerificationStatus;
  provider?: string | null;
  providerLastSyncedAt?: Date | string | null;
};

export type SmsSenderReadinessMode = 'legacy' | 'warn' | 'strict';

export const SMS_SENDER_READINESS_MODES = ['legacy', 'warn', 'strict'] as const;

export type SmsSenderReadinessReasonCode =
  | 'READY'
  | 'SENDER_NOT_FOUND'
  | 'LEGACY_NOT_APPROVED'
  | 'SENDER_ARCHIVED'
  | 'SENDER_SUSPENDED'
  | 'SENDER_REJECTED'
  | 'OWNERSHIP_UNVERIFIED'
  | 'OWNERSHIP_REJECTED'
  | 'INTERNAL_REVIEW_PENDING'
  | 'INTERNAL_REVIEW_REJECTED'
  | 'PROVIDER_NOT_SUBMITTED'
  | 'PROVIDER_PENDING'
  | 'PROVIDER_REJECTED'
  | 'PROVIDER_SUSPENDED'
  | 'PROVIDER_UNKNOWN'
  | 'PROVIDER_STATUS_STALE'
  | 'PROVIDER_UNSUPPORTED';

export type SmsSenderReadinessResult<TSender = MarketingSmsSenderIdentity> = {
  ready: boolean;
  legacyReady: boolean;
  effectiveReady: boolean;
  mode: SmsSenderReadinessMode;
  reasonCode: SmsSenderReadinessReasonCode;
  reasonMessage: string;
  provider: SmsProviderName;
  providerStatusStale: boolean;
  sender: TSender | null;
};

export type SmsSenderReadinessConfig = {
  mode: SmsSenderReadinessMode;
  maxProviderStatusAgeHours: number;
};

const REASON_MESSAGES: Record<SmsSenderReadinessReasonCode, string> = {
  READY: 'SMS sender identity is ready',
  SENDER_NOT_FOUND: 'SMS sender identity was not found',
  LEGACY_NOT_APPROVED: 'SMS sender identity is not approved',
  SENDER_ARCHIVED: 'SMS sender identity is archived',
  SENDER_SUSPENDED: 'SMS sender identity is suspended',
  SENDER_REJECTED: 'SMS sender identity is rejected',
  OWNERSHIP_UNVERIFIED: 'Sender ownership is not verified',
  OWNERSHIP_REJECTED: 'Sender ownership verification was rejected',
  INTERNAL_REVIEW_PENDING: 'Sender identity is awaiting internal review',
  INTERNAL_REVIEW_REJECTED: 'Sender identity was rejected internally',
  PROVIDER_NOT_SUBMITTED:
    'Sender identity has not been submitted to the provider',
  PROVIDER_PENDING: 'Sender identity is awaiting provider approval',
  PROVIDER_REJECTED: 'Sender identity was rejected by the provider',
  PROVIDER_SUSPENDED: 'Sender identity is suspended by the provider',
  PROVIDER_UNKNOWN: 'Sender identity provider status is unknown',
  PROVIDER_STATUS_STALE: 'Sender identity provider status is stale',
  PROVIDER_UNSUPPORTED:
    'The selected SMS provider does not support tenant sender identities',
};

export function parseSmsSenderReadinessMode(
  value = process.env.SMS_SENDER_READINESS_MODE,
): SmsSenderReadinessMode {
  const mode = (value ?? 'legacy').trim().toLowerCase();
  if (SMS_SENDER_READINESS_MODES.includes(mode as SmsSenderReadinessMode)) {
    return mode as SmsSenderReadinessMode;
  }
  throw new Error(
    `Invalid SMS_SENDER_READINESS_MODE "${value}". Expected legacy, warn, or strict.`,
  );
}

export function parseSmsSenderProviderStatusMaxAgeHours(
  value = process.env.SMS_SENDER_PROVIDER_STATUS_MAX_AGE_HOURS,
): number {
  const raw = value ?? '24';
  const hours = Number(raw);
  if (!Number.isFinite(hours) || hours <= 0) {
    throw new Error(
      `Invalid SMS_SENDER_PROVIDER_STATUS_MAX_AGE_HOURS "${raw}". Expected a positive number.`,
    );
  }
  return hours;
}

export function getSmsSenderReadinessConfig(): SmsSenderReadinessConfig {
  return {
    mode: parseSmsSenderReadinessMode(),
    maxProviderStatusAgeHours: parseSmsSenderProviderStatusMaxAgeHours(),
  };
}

export function resolveSmsSenderProvider(
  senderProvider?: string | null,
): SmsProviderName {
  const provider = (senderProvider || process.env.SMS_PROVIDER || 'termii')
    .trim()
    .toLowerCase();
  if (
    provider === 'termii' ||
    provider === 'pilosms' ||
    provider === 'sasusync' ||
    provider === 'agoosms'
  ) {
    return provider;
  }
  return 'agoosms';
}

export function smsProviderSupportsTenantSender(provider: SmsProviderName) {
  return provider !== 'agoosms';
}

export function smsProviderSupportsSenderRefresh(provider: SmsProviderName) {
  return provider === 'termii' || provider === 'sasusync';
}

/**
 * Future authoritative readiness rule. Campaign enforcement deliberately keeps
 * using the legacy APPROVED status until provider submission/sync ships.
 */
export function isSmsSenderEffectiveReady(
  sender: SmsSenderReadinessInput,
  config: Pick<SmsSenderReadinessConfig, 'maxProviderStatusAgeHours'> = {
    maxProviderStatusAgeHours: parseSmsSenderProviderStatusMaxAgeHours(),
  },
) {
  if (sender.status === 'ARCHIVED' || sender.status === 'SUSPENDED')
    return false;
  if (sender.status === 'REJECTED') return false;
  if (
    !smsProviderSupportsTenantSender(resolveSmsSenderProvider(sender.provider))
  )
    return false;
  return (
    sender.ownershipStatus === 'VERIFIED' &&
    ['NOT_REQUIRED', 'APPROVED'].includes(sender.internalReviewStatus) &&
    sender.providerStatus === 'APPROVED' &&
    !isSmsSenderProviderStatusStale(sender, config.maxProviderStatusAgeHours)
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

export function isSmsSenderProviderStatusStale(
  sender: Pick<
    SmsSenderReadinessInput,
    'providerStatus' | 'providerLastSyncedAt'
  >,
  maxAgeHours = parseSmsSenderProviderStatusMaxAgeHours(),
) {
  if (sender.providerStatus !== 'APPROVED') return false;
  if (!sender.providerLastSyncedAt) return true;
  const syncedAt =
    sender.providerLastSyncedAt instanceof Date
      ? sender.providerLastSyncedAt
      : new Date(sender.providerLastSyncedAt);
  if (Number.isNaN(syncedAt.getTime())) return true;
  return Date.now() - syncedAt.getTime() > maxAgeHours * 60 * 60 * 1000;
}

export function isSmsSenderProviderSyncDue(
  sender: Pick<SmsSenderReadinessInput, 'providerLastSyncedAt'>,
  maxAgeHours = parseSmsSenderProviderStatusMaxAgeHours(),
) {
  if (!sender.providerLastSyncedAt) return true;
  const syncedAt =
    sender.providerLastSyncedAt instanceof Date
      ? sender.providerLastSyncedAt
      : new Date(sender.providerLastSyncedAt);
  if (Number.isNaN(syncedAt.getTime())) return true;
  return Date.now() - syncedAt.getTime() > maxAgeHours * 60 * 60 * 1000;
}

export function evaluateSmsSenderReadiness<
  TSender extends SmsSenderReadinessInput,
>(
  sender: TSender | null,
  config: SmsSenderReadinessConfig = getSmsSenderReadinessConfig(),
): SmsSenderReadinessResult<TSender> {
  if (!sender) {
    return result(null, config, 'SENDER_NOT_FOUND', false, false);
  }

  const legacyReady = isSmsSenderLegacyUsable(sender);
  const provider = resolveSmsSenderProvider(sender.provider);
  const stale = isSmsSenderProviderStatusStale(
    sender,
    config.maxProviderStatusAgeHours,
  );
  let reasonCode: SmsSenderReadinessReasonCode = 'READY';

  if (sender.status === 'ARCHIVED') reasonCode = 'SENDER_ARCHIVED';
  else if (sender.status === 'SUSPENDED') reasonCode = 'SENDER_SUSPENDED';
  else if (sender.status === 'REJECTED') reasonCode = 'SENDER_REJECTED';
  else if (!smsProviderSupportsTenantSender(provider))
    reasonCode = 'PROVIDER_UNSUPPORTED';
  else if (sender.ownershipStatus === 'REJECTED')
    reasonCode = 'OWNERSHIP_REJECTED';
  else if (sender.ownershipStatus !== 'VERIFIED')
    reasonCode = 'OWNERSHIP_UNVERIFIED';
  else if (sender.internalReviewStatus === 'REJECTED')
    reasonCode = 'INTERNAL_REVIEW_REJECTED';
  else if (sender.internalReviewStatus === 'PENDING')
    reasonCode = 'INTERNAL_REVIEW_PENDING';
  else if (sender.providerStatus === 'NOT_SUBMITTED')
    reasonCode = 'PROVIDER_NOT_SUBMITTED';
  else if (
    sender.providerStatus === 'SUBMITTED' ||
    sender.providerStatus === 'PENDING'
  )
    reasonCode = 'PROVIDER_PENDING';
  else if (sender.providerStatus === 'REJECTED')
    reasonCode = 'PROVIDER_REJECTED';
  else if (sender.providerStatus === 'SUSPENDED')
    reasonCode = 'PROVIDER_SUSPENDED';
  else if (sender.providerStatus === 'UNKNOWN') reasonCode = 'PROVIDER_UNKNOWN';
  else if (sender.providerStatus === 'APPROVED' && stale)
    reasonCode = 'PROVIDER_STATUS_STALE';

  const effectiveReady = reasonCode === 'READY';
  const ready = config.mode === 'strict' ? effectiveReady : legacyReady;

  if (!legacyReady && config.mode !== 'strict') {
    reasonCode = 'LEGACY_NOT_APPROVED';
  }

  return result(
    sender,
    config,
    reasonCode,
    legacyReady,
    effectiveReady,
    provider,
    stale,
    ready,
  );
}

function result<TSender>(
  sender: TSender | null,
  config: SmsSenderReadinessConfig,
  reasonCode: SmsSenderReadinessReasonCode,
  legacyReady: boolean,
  effectiveReady: boolean,
  provider: SmsProviderName = 'termii',
  providerStatusStale = false,
  ready = config.mode === 'strict' ? effectiveReady : legacyReady,
): SmsSenderReadinessResult<TSender> {
  return {
    ready,
    legacyReady,
    effectiveReady,
    mode: config.mode,
    reasonCode,
    reasonMessage: REASON_MESSAGES[reasonCode],
    provider,
    providerStatusStale,
    sender,
  };
}
