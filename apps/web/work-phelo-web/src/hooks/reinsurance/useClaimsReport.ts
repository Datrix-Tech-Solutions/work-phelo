import { useMemo } from 'react';
import { useFacultatives } from './useFacultatives';
import { useClaimsByTab } from './useClaims';
import { CLOSING_STATUSES } from './usePayments';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

export type ClaimsReportBucket = 'notification' | 'open' | 'closed';

export interface ClaimsReportParams {
  /** Restricts to claims whose occurrenceDate falls in [startDate, endDate]. */
  startDate?: string;
  endDate?: string;
  cedantIds?: string[];
  currency?: string;
  bucket?: ClaimsReportBucket;
}

export interface ClaimReportRow {
  id: string;
  placementId: string;
  policyNumber: string;
  cedantName: string;
  claimNumber: string;
  currency: string;
  occurrenceDate: string;
  estimatedLossAmount: number;
  finalLossAmount: number | null;
  /** When the actual (final) loss amount was set — i.e. when the payable amount became
   *  available. Null while the claim is still a notification. */
  finalizedAt: string | null;
  /** Bank-confirmed amount recovered from reinsurers so far — only set for open/closed claims. */
  recoveredAmount: number | null;
  recoveredAt: string | null;
  bucket: ClaimsReportBucket;
}

export interface ClaimsReportSummary {
  openClaims: number;
  closedClaims: number;
  /** Share of finalized claims (open + closed) that have been fully recovered from reinsurers. */
  recoveryRate: number;
}

export function useClaimsReport(
  params: ClaimsReportParams,
  options: { enabled?: boolean } = {},
): {
  rows: ClaimReportRow[];
  summary: ClaimsReportSummary;
  isLoading: boolean;
} {
  const enabled = options.enabled ?? true;
  const { data: placements = [], isLoading: loadingPlacements } = useFacultatives();

  const closingRows = useMemo(
    () => (enabled ? placements.filter((p) => CLOSING_STATUSES.includes(p.status)) : []),
    [placements, enabled],
  );

  const cedantFiltered = useMemo(() => {
    const cedantIds = params.cedantIds?.length ? new Set(params.cedantIds) : null;
    return cedantIds ? closingRows.filter((p) => cedantIds.has(p.cedant.id)) : closingRows;
  }, [closingRows, params.cedantIds]);

  const { notification, open, closed, isLoadingClaims, isLoadingFinancials } =
    useClaimsByTab(cedantFiltered);

  const allRows = useMemo<ClaimReportRow[]>(() => {
    const rowsFor = (list: typeof notification, bucket: ClaimsReportBucket): ClaimReportRow[] =>
      list.map((r) => ({
        id: r.claim.id,
        placementId: r.placement.id,
        policyNumber: displayPolicyNumber(r.placement.policyNumber),
        cedantName: r.placement.cedant.name,
        claimNumber: r.claim.claimNumber,
        currency: r.claim.currency,
        occurrenceDate: r.claim.occurrenceDate,
        estimatedLossAmount: parseFloat(r.claim.estimatedLossAmount),
        finalLossAmount:
          r.claim.finalLossAmount != null ? parseFloat(r.claim.finalLossAmount) : null,
        finalizedAt: r.claim.finalizedAt ?? null,
        recoveredAmount: r.recoveredAmount ?? null,
        recoveredAt: r.recoveredAt ?? null,
        bucket,
      }));

    return [
      ...rowsFor(notification, 'notification'),
      ...rowsFor(open, 'open'),
      ...rowsFor(closed, 'closed'),
    ];
  }, [notification, open, closed]);

  const dateFiltered = useMemo(() => {
    const from = params.startDate ? new Date(params.startDate) : null;
    const to = params.endDate ? new Date(params.endDate) : null;
    if (to) to.setHours(23, 59, 59, 999);

    return allRows.filter((r) => {
      if (from || to) {
        const occurred = new Date(r.occurrenceDate);
        if (from && occurred < from) return false;
        if (to && occurred > to) return false;
      }
      if (params.currency && r.currency !== params.currency) return false;
      return true;
    });
  }, [allRows, params.startDate, params.endDate, params.currency]);

  const rows = useMemo(
    () => (params.bucket ? dateFiltered.filter((r) => r.bucket === params.bucket) : dateFiltered),
    [dateFiltered, params.bucket],
  );

  const summary = useMemo<ClaimsReportSummary>(() => {
    const openClaims = dateFiltered.filter((r) => r.bucket === 'open').length;
    const closedClaims = dateFiltered.filter((r) => r.bucket === 'closed').length;
    const finalizedTotal = openClaims + closedClaims;
    return {
      openClaims,
      closedClaims,
      recoveryRate: finalizedTotal > 0 ? (closedClaims / finalizedTotal) * 100 : 0,
    };
  }, [dateFiltered]);

  const isLoading = loadingPlacements || isLoadingClaims || isLoadingFinancials;

  return { rows, summary, isLoading };
}
