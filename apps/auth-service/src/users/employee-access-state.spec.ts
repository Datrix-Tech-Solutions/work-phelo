import { classifyEmployeeAccount } from './employee-access-state';

describe('Canonical employee account state', () => {
  const now = new Date('2026-11-13T00:00:00Z');
  const pending = {
    status: 'PENDING_VERIFICATION',
    hasInvite: true,
    inviteExpiresAt: new Date(now.getTime() + 1000),
    suspended: false,
  };
  it.each([
    [null, null, 'INVITED'],
    ['READY', null, 'PROVISIONING'],
    ['PAUSED', null, 'PROVISIONING_FAILED'],
    ['PROVIDER_ACCEPTED', null, 'INVITED'],
    ['PROVIDER_ACCEPTED', 'READY', 'PROVISIONING'],
    ['EXPIRED', 'COMPLETED', 'INVITED'],
    ['PROVIDER_ACCEPTED', 'PAUSED', 'PROVISIONING_FAILED'],
  ])('maps grant=%s resend=%s to %s', (grant, resend, expected) => {
    expect(classifyEmployeeAccount(pending, grant, resend, now)).toBe(expected);
  });
  it('uses one explicit snapshot clock for expiration and never treats absence as active', () => {
    expect(
      classifyEmployeeAccount(
        { ...pending, inviteExpiresAt: now },
        'PROVIDER_ACCEPTED',
        null,
        now,
      ),
    ).toBe('INVITE_EXPIRED');
    expect(classifyEmployeeAccount(null, null, null, now)).toBe('MISSING');
    expect(
      classifyEmployeeAccount(
        { ...pending, status: 'ACTIVE', suspended: true },
        null,
        null,
        now,
      ),
    ).toBe('INCONSISTENT');
  });
});
