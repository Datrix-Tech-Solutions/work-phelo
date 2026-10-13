import {
  evaluateSmsSenderReadiness,
  isSmsSenderEffectiveReady,
  isSmsSenderLegacyUsable,
  parseSmsSenderProviderStatusMaxAgeHours,
  parseSmsSenderReadinessMode,
} from './sms-sender-readiness';

const sender = (overrides = {}) =>
  ({
    status: 'APPROVED',
    ownershipStatus: 'VERIFIED',
    internalReviewStatus: 'APPROVED',
    providerStatus: 'APPROVED',
    providerLastSyncedAt: new Date().toISOString(),
    ...overrides,
  }) as Parameters<typeof isSmsSenderEffectiveReady>[0];

const config = { mode: 'strict' as const, maxProviderStatusAgeHours: 24 };

describe('SMS sender readiness', () => {
  it('requires verified ownership and provider approval for future readiness', () => {
    expect(isSmsSenderEffectiveReady(sender())).toBe(true);
    expect(
      isSmsSenderEffectiveReady(sender({ ownershipStatus: 'UNVERIFIED' })),
    ).toBe(false);
    expect(
      isSmsSenderEffectiveReady(sender({ providerStatus: 'UNKNOWN' })),
    ).toBe(false);
  });

  it('preserves transitional legacy usability for approved senders', () => {
    expect(isSmsSenderLegacyUsable({ status: 'APPROVED' })).toBe(true);
    expect(
      isSmsSenderLegacyUsable({ status: 'PENDING_PROVIDER_APPROVAL' }),
    ).toBe(false);
  });

  it('does not treat archived or suspended senders as effective ready', () => {
    expect(isSmsSenderEffectiveReady(sender({ status: 'ARCHIVED' }))).toBe(
      false,
    );
    expect(isSmsSenderEffectiveReady(sender({ status: 'SUSPENDED' }))).toBe(
      false,
    );
  });

  it('preserves legacy and warn campaign readiness for legacy approved senders', () => {
    const legacyApproved = sender({ providerStatus: 'UNKNOWN' });

    expect(
      evaluateSmsSenderReadiness(legacyApproved, {
        ...config,
        mode: 'legacy',
      }),
    ).toMatchObject({
      ready: true,
      legacyReady: true,
      effectiveReady: false,
      reasonCode: 'PROVIDER_UNKNOWN',
    });
    expect(
      evaluateSmsSenderReadiness(legacyApproved, {
        ...config,
        mode: 'warn',
      }),
    ).toMatchObject({
      ready: true,
      legacyReady: true,
      effectiveReady: false,
      reasonCode: 'PROVIDER_UNKNOWN',
    });
  });

  it('requires provider-authoritative readiness in strict mode', () => {
    expect(evaluateSmsSenderReadiness(sender(), config)).toMatchObject({
      ready: true,
      effectiveReady: true,
      reasonCode: 'READY',
    });
    expect(
      evaluateSmsSenderReadiness(sender({ providerStatus: 'PENDING' }), config),
    ).toMatchObject({
      ready: false,
      legacyReady: true,
      effectiveReady: false,
      reasonCode: 'PROVIDER_PENDING',
    });
  });

  it('blocks stale provider approval in strict mode', () => {
    const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000);

    expect(
      evaluateSmsSenderReadiness(
        sender({ providerLastSyncedAt: staleDate }),
        config,
      ),
    ).toMatchObject({
      ready: false,
      providerStatusStale: true,
      reasonCode: 'PROVIDER_STATUS_STALE',
    });
  });

  it('reports unsupported providers explicitly', () => {
    expect(
      evaluateSmsSenderReadiness(sender({ provider: 'agoosms' }), config),
    ).toMatchObject({
      ready: false,
      reasonCode: 'PROVIDER_UNSUPPORTED',
    });
  });

  it('validates readiness environment options', () => {
    expect(parseSmsSenderReadinessMode(undefined)).toBe('legacy');
    expect(parseSmsSenderReadinessMode('warn')).toBe('warn');
    expect(() => parseSmsSenderReadinessMode('future')).toThrow(
      'Invalid SMS_SENDER_READINESS_MODE',
    );

    expect(parseSmsSenderProviderStatusMaxAgeHours(undefined)).toBe(24);
    expect(parseSmsSenderProviderStatusMaxAgeHours('6')).toBe(6);
    expect(() => parseSmsSenderProviderStatusMaxAgeHours('0')).toThrow(
      'Invalid SMS_SENDER_PROVIDER_STATUS_MAX_AGE_HOURS',
    );
  });
});
