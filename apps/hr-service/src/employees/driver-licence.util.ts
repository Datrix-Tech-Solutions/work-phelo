export type LicenceStatus = 'NONE' | 'VALID' | 'EXPIRING' | 'EXPIRED';

/** A licence this close to expiring is flagged so it can be renewed in time. */
export const LICENCE_EXPIRING_DAYS = 30;

/** Today as YYYY-MM-DD (UTC). */
export const todayIso = () => new Date().toISOString().slice(0, 10);

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from `from` to `to` (both YYYY-MM-DD); negative once `to` has passed. */
const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS,
  );

/**
 * What a licence amounts to on a given day. Driving needs both an unexpired licence and an image
 * on file; the status describes only the dates.
 */
export function licenceAbility(input: {
  expiresAt: string | null;
  imageOnFile: boolean;
  onDate: string;
}) {
  if (!input.expiresAt) {
    return { status: 'NONE' as LicenceStatus, daysLeft: null, canDrive: false };
  }
  const daysLeft = daysBetween(input.onDate, input.expiresAt);
  const status: LicenceStatus =
    daysLeft < 0
      ? 'EXPIRED'
      : daysLeft <= LICENCE_EXPIRING_DAYS
        ? 'EXPIRING'
        : 'VALID';
  return { status, daysLeft, canDrive: daysLeft >= 0 && input.imageOnFile };
}
