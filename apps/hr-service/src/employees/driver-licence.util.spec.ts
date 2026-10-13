import { licenceAbility } from './driver-licence.util';

describe('licenceAbility', () => {
  const onDate = '2026-10-13';

  it('has no ability without a licence', () => {
    expect(
      licenceAbility({ expiresAt: null, imageOnFile: true, onDate }),
    ).toEqual({ status: 'NONE', daysLeft: null, canDrive: false });
  });

  it('allows driving while valid with the image on file', () => {
    expect(
      licenceAbility({ expiresAt: '2027-10-13', imageOnFile: true, onDate }),
    ).toMatchObject({ status: 'VALID', daysLeft: 365, canDrive: true });
  });

  it('keeps the dates but loses the ability when the image is gone', () => {
    expect(
      licenceAbility({ expiresAt: '2027-10-13', imageOnFile: false, onDate }),
    ).toMatchObject({ status: 'VALID', canDrive: false });
  });

  it('flags a licence within 30 days of expiring, and still allows driving', () => {
    expect(
      licenceAbility({ expiresAt: '2026-11-01', imageOnFile: true, onDate }),
    ).toMatchObject({ status: 'EXPIRING', daysLeft: 19, canDrive: true });
  });

  it('counts the expiry day itself as valid', () => {
    expect(
      licenceAbility({ expiresAt: onDate, imageOnFile: true, onDate }),
    ).toMatchObject({ status: 'EXPIRING', daysLeft: 0, canDrive: true });
  });

  it('is expired the day after', () => {
    expect(
      licenceAbility({ expiresAt: '2026-10-12', imageOnFile: true, onDate }),
    ).toMatchObject({ status: 'EXPIRED', daysLeft: -1, canDrive: false });
  });
});
