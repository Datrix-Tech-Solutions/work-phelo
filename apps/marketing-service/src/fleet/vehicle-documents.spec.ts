import {
  DOCUMENT_WARNING_DAYS,
  documentAlerts,
  expiredDocumentsReason,
} from './vehicle-documents';

const day = (value: string) => new Date(`${value}T00:00:00.000Z`);
const NOW = new Date('2026-10-16T14:30:00.000Z');

describe('vehicle documents', () => {
  it('ignores a vehicle with no documents on file', () => {
    expect(documentAlerts(null, NOW)).toEqual([]);
    expect(documentAlerts({}, NOW)).toEqual([]);
    expect(
      documentAlerts({ insuranceStartDate: day('2026-01-01') }, NOW),
    ).toEqual([]);
  });

  it('is valid through the whole expiry day and expired from the next', () => {
    const onTheDay = documentAlerts(
      { insuranceExpiryDate: day('2026-10-16') },
      NOW,
    );
    expect(onTheDay).toMatchObject([{ state: 'EXPIRING_SOON', daysLeft: 0 }]);
    expect(
      expiredDocumentsReason({ insuranceExpiryDate: day('2026-10-16') }, NOW),
    ).toBeNull();

    const dayAfter = documentAlerts(
      { insuranceExpiryDate: day('2026-10-15') },
      NOW,
    );
    expect(dayAfter).toMatchObject([{ state: 'EXPIRED', daysLeft: -1 }]);
  });

  it('warns inside the warning window and stays quiet beyond it', () => {
    const edge = new Date(NOW);
    edge.setUTCDate(edge.getUTCDate() + DOCUMENT_WARNING_DAYS);
    const inside = documentAlerts(
      { safetyCertificateExpiresOn: day(edge.toISOString().slice(0, 10)) },
      NOW,
    );
    expect(inside).toMatchObject([
      {
        document: 'SAFETY_CERTIFICATE',
        state: 'EXPIRING_SOON',
        daysLeft: DOCUMENT_WARNING_DAYS,
      },
    ]);

    edge.setUTCDate(edge.getUTCDate() + 1);
    expect(
      documentAlerts(
        { safetyCertificateExpiresOn: day(edge.toISOString().slice(0, 10)) },
        NOW,
      ),
    ).toEqual([]);
  });

  it('names every expired document', () => {
    expect(
      expiredDocumentsReason(
        {
          insuranceExpiryDate: day('2026-10-12'),
          safetyCertificateExpiresOn: day('2026-08-01'),
        },
        NOW,
      ),
    ).toBe(
      'Insurance expired 12 Oct 2026 · Safety certificate expired 01 Aug 2026',
    );
  });
});
