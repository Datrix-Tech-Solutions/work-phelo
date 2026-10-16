/** How many days ahead of an expiry a document starts showing an early warning. */
export const DOCUMENT_WARNING_DAYS = 30;

export type VehicleDocumentKind = 'INSURANCE' | 'SAFETY_CERTIFICATE';

export const DOCUMENT_LABELS: Record<VehicleDocumentKind, string> = {
  INSURANCE: 'Insurance',
  SAFETY_CERTIFICATE: 'Safety certificate',
};

/** The optional document dates stored on a vehicle. All are date-only; any may be missing. */
export interface VehicleDocumentDates {
  insuranceStartDate?: Date | null;
  insuranceExpiryDate?: Date | null;
  safetyCertificateIssuedOn?: Date | null;
  safetyCertificateExpiresOn?: Date | null;
}

export interface VehicleDocumentAlert {
  document: VehicleDocumentKind;
  label: string;
  state: 'EXPIRED' | 'EXPIRING_SOON';
  /** YYYY-MM-DD, the last day the document is valid. */
  expiresOn: string;
  /** Negative once expired; 0 on the expiry day itself. */
  daysLeft: number;
}

const DAY_MS = 86_400_000;

const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

/** Whole days from `now`'s calendar day (UTC) to the stored expiry day. */
function daysUntil(expiry: Date, now: Date): number {
  const today = Date.parse(dateOnly(now));
  return Math.round((Date.parse(dateOnly(expiry)) - today) / DAY_MS);
}

/**
 * Documents that are expired or about to expire. A document is valid through its whole expiry
 * date and expired from the next day. Documents with no expiry on file are ignored, so vehicles
 * that were never given any are never affected.
 */
export function documentAlerts(
  dates: VehicleDocumentDates | null | undefined,
  now: Date = new Date(),
): VehicleDocumentAlert[] {
  if (!dates) return [];
  const checks: Array<[VehicleDocumentKind, Date | null | undefined]> = [
    ['INSURANCE', dates.insuranceExpiryDate],
    ['SAFETY_CERTIFICATE', dates.safetyCertificateExpiresOn],
  ];
  const alerts: VehicleDocumentAlert[] = [];
  for (const [document, expiry] of checks) {
    if (!expiry) continue;
    const daysLeft = daysUntil(expiry, now);
    if (daysLeft > DOCUMENT_WARNING_DAYS) continue;
    alerts.push({
      document,
      label: DOCUMENT_LABELS[document],
      state: daysLeft < 0 ? 'EXPIRED' : 'EXPIRING_SOON',
      expiresOn: dateOnly(expiry),
      daysLeft,
    });
  }
  return alerts;
}

const formatDay = (isoDay: string) =>
  new Date(isoDay).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

/** "Insurance expired 12 Oct 2026", or both documents joined; null when nothing has expired. */
export function expiredDocumentsReason(
  dates: VehicleDocumentDates | null | undefined,
  now: Date = new Date(),
): string | null {
  const expired = documentAlerts(dates, now).filter(
    (alert) => alert.state === 'EXPIRED',
  );
  if (!expired.length) return null;
  return expired
    .map((alert) => `${alert.label} expired ${formatDay(alert.expiresOn)}`)
    .join(' · ');
}
