import { Facultative, FacultativeStatus, toStatusLabel } from '@/types/reinsurance';

export type StatusVariant = 'success' | 'warning' | 'neutral' | 'danger';

export const RAW_STATUS_VARIANT_MAP: Record<FacultativeStatus, StatusVariant> = {
  DRAFT: 'neutral',
  MARKETING: 'neutral',
  PARTIALLY_PLACED: 'success',
  PLACED: 'success',
  CLOSING: 'success',
  CLOSED: 'success',
  DECLINED: 'danger',
  CANCELLED: 'danger',
};

/**
 * Raw status alone can't tell 'Closed' apart from 'Partially Placed' once a placement has
 * been through CLOSING — reopening a closed offer for edits reuses the CLOSING status, and
 * validating a fully-placed offer moves it into CLOSING too. So for the in-flight CLOSING
 * status we fall back to the actual accepted percentage against facultativeOffer instead of
 * trusting the raw status. PLACED, however, means the offer is fully placed but the closing
 * workflow hasn't been initiated yet — it stays "open" until the user acts on it.
 */
export function acceptedPercentFor(placement: Facultative): number {
  return (
    placement.participants
      ?.filter((p) => p.status === 'ACCEPTED' || p.status === 'CLOSED')
      .reduce((sum, p) => sum + parseFloat(p.signedLinePercent ?? p.sharePercent ?? '0'), 0) ?? 0
  );
}

export function isEffectivelyClosed(placement: Facultative): boolean {
  if (
    placement.status === 'CLOSED' ||
    placement.status === 'DECLINED' ||
    placement.status === 'CANCELLED'
  ) {
    return true;
  }
  if (placement.status === 'CLOSING') {
    const facOffer = placement.facultativeOffer ?? 0;
    return facOffer > 0 && acceptedPercentFor(placement) >= facOffer;
  }
  return false;
}

/** Raw backend status, human-formatted only (no grouping/collapsing across statuses). */
export function rawStatusLabel(status: FacultativeStatus): string {
  return status
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Business-friendly wording for specific statuses — still one label per raw status, no grouping.
const STATUS_LABEL_OVERRIDES: Partial<Record<FacultativeStatus, string>> = {
  MARKETING: 'On Market',
  CLOSING: 'Partially Closed',
};

/** Same as rawStatusLabel, but swaps in business-friendly wording for a few statuses. */
export function facultativeStatusLabel(status: FacultativeStatus): string {
  return STATUS_LABEL_OVERRIDES[status] ?? rawStatusLabel(status);
}

export function displayStatusFor(placement: Facultative): {
  label: string;
  variant: StatusVariant;
} {
  if (placement.status === 'PARTIALLY_PLACED' || placement.status === 'CLOSING') {
    return isEffectivelyClosed(placement)
      ? { label: 'Closed', variant: 'success' }
      : { label: 'Partially Placed', variant: 'success' };
  }
  return {
    label: toStatusLabel(placement.status),
    variant: RAW_STATUS_VARIANT_MAP[placement.status],
  };
}
