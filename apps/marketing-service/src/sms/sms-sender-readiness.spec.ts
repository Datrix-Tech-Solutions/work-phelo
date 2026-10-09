import {
  isSmsSenderEffectiveReady,
  isSmsSenderLegacyUsable,
} from './sms-sender-readiness';

const sender = (overrides = {}) =>
  ({
    status: 'APPROVED',
    ownershipStatus: 'VERIFIED',
    internalReviewStatus: 'APPROVED',
    providerStatus: 'APPROVED',
    ...overrides,
  }) as Parameters<typeof isSmsSenderEffectiveReady>[0];

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
});
