import { useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useFacultatives } from './useFacultatives';
import { useCurrencies } from './useCurrencies';
import { useReportCurrencyTotals, ReportCurrencyTotals } from './useReportCurrencyTotals';
import {
  Currency,
  Facultative,
  FacultativeStatus,
  PlacementParticipant,
  PlacementPayment,
} from '@/types/reinsurance';

const BASE = '/operations/reinsurance/placements';
const paymentsKey = (placementId: string) =>
  ['reinsurance', 'placements', placementId, 'payments'] as const;

const REINSURER_ROLES = new Set(['REINSURER', 'LEAD_REINSURER', 'CO_REINSURER']);
const QUALIFYING_STATUSES = new Set(['ACCEPTED', 'CLOSED']);

function getRate(currencies: Currency[], isoCode: string | null): number {
  if (!isoCode) return 1;
  const c = currencies.find((x) => x.isoCode === isoCode);
  return c?.exchangeRateToBase ? parseFloat(c.exchangeRateToBase) : 1;
}

function convertToTarget(
  value: number,
  sourceIso: string | null,
  currencies: Currency[],
  targetRate: number,
): number {
  const sourceRate = getRate(currencies, sourceIso);
  return (value * sourceRate) / targetRate;
}

export interface ReinsurersReportParams {
  /** Restricts to these years (by placement createdAt). Omitted/empty = all-time, no restriction. */
  years?: string[];
  riskTypeId?: string;
  currency?: string;
  status?: FacultativeStatus;
  reinsurerIds?: string[];
}

export interface ReinsurerReportRow {
  reinsurerId: string;
  name: string;
  placementCount: number;
  cededPremium: number;
  outstanding: number;
}

export interface ReinsurersReportSummary {
  activeReinsurers: number;
  cededPremium: number;
  outstanding: number;
  currencySymbol: string;
}

export function useReinsurersReport(
  params: ReinsurersReportParams,
  options: { enabled?: boolean } = {},
): {
  rows: ReinsurerReportRow[];
  summary: ReinsurersReportSummary;
  currencyTotals: ReportCurrencyTotals;
  isLoading: boolean;
} {
  const enabled = options.enabled ?? true;
  const { data: placements = [], isLoading: loadingPlacements } = useFacultatives();
  const { data: currencies = [], isLoading: loadingCurrencies } = useCurrencies();

  const filteredPlacements = useMemo(() => {
    if (!enabled) return [];

    const years = params.years?.length ? new Set(params.years) : null;

    return placements.filter((p) => {
      if (years && !years.has(String(new Date(p.createdAt).getFullYear()))) return false;
      if (params.riskTypeId && p.riskTypeId !== params.riskTypeId) return false;
      if (params.status && p.status !== params.status) return false;
      return true;
    });
  }, [placements, enabled, params.years, params.riskTypeId, params.status]);

  const placementParticipants = useMemo(() => {
    const reinsurerIdsFilter = params.reinsurerIds?.length ? new Set(params.reinsurerIds) : null;

    return filteredPlacements
      .map((placement) => ({
        placement,
        participants: placement.participants.filter(
          (pt) =>
            REINSURER_ROLES.has(pt.role) &&
            QUALIFYING_STATUSES.has(pt.status) &&
            pt.sharePercent != null &&
            (!reinsurerIdsFilter || reinsurerIdsFilter.has(pt.counterpartyId)),
        ),
      }))
      .filter((entry) => entry.participants.length > 0);
  }, [filteredPlacements, params.reinsurerIds]);

  const targetIso = useMemo(() => {
    if (params.currency) return params.currency;
    return currencies.find((c) => c.isBaseCurrency)?.isoCode ?? '';
  }, [params.currency, currencies]);
  const targetRate = getRate(currencies, targetIso);

  const paymentQueries = useQueries({
    queries: placementParticipants.map(({ placement }) => ({
      queryKey: paymentsKey(placement.id),
      queryFn: async () => {
        const res = await api.get(`${BASE}/${placement.id}/payments`);
        return (res.data?.items ?? res.data ?? []) as PlacementPayment[];
      },
    })),
  });

  const rows = useMemo(() => {
    const map = new Map<string, ReinsurerReportRow>();

    placementParticipants.forEach(
      (
        {
          placement,
          participants,
        }: {
          placement: Facultative;
          participants: PlacementParticipant[];
        },
        i,
      ) => {
        const premiumInTarget = convertToTarget(
          placement.premium ?? 0,
          placement.currency,
          currencies,
          targetRate,
        );
        const payments = paymentQueries[i]?.data ?? [];

        participants.forEach((pt) => {
          const share = parseFloat(pt.sharePercent as string) / 100;
          const cededShare = premiumInTarget * share;

          const disbursed = payments
            .filter(
              (pmt) =>
                pmt.type === 'REINSURER_DISBURSEMENT' &&
                pmt.status === 'RECORDED' &&
                pmt.counterpartyId === pt.counterpartyId,
            )
            .reduce(
              (sum, pmt) =>
                sum + convertToTarget(parseFloat(pmt.amount), pmt.currency, currencies, targetRate),
              0,
            );

          const existing = map.get(pt.counterpartyId) ?? {
            reinsurerId: pt.counterpartyId,
            name: pt.counterparty.name,
            placementCount: 0,
            cededPremium: 0,
            outstanding: 0,
          };
          existing.placementCount += 1;
          existing.cededPremium += cededShare;
          existing.outstanding += Math.max(cededShare - disbursed, 0);
          map.set(pt.counterpartyId, existing);
        });
      },
    );

    return Array.from(map.values()).sort((a, b) => b.cededPremium - a.cededPremium);
  }, [placementParticipants, paymentQueries, currencies, targetRate]);

  const summary = useMemo<ReinsurersReportSummary>(() => {
    const targetCurrency = currencies.find((c) => c.isoCode === targetIso);
    return {
      activeReinsurers: rows.length,
      cededPremium: rows.reduce((sum, r) => sum + r.cededPremium, 0),
      outstanding: rows.reduce((sum, r) => sum + r.outstanding, 0),
      currencySymbol: targetCurrency?.symbol ?? targetIso,
    };
  }, [rows, currencies, targetIso]);

  const isLoading =
    loadingPlacements || loadingCurrencies || paymentQueries.some((q) => q.isLoading);

  const currencyTotalsEntries = useMemo(
    () =>
      placementParticipants.map(({ placement, participants }) => ({
        placement,
        participants,
        scope: 'participant' as const,
      })),
    [placementParticipants],
  );
  const currencyTotals = useReportCurrencyTotals(currencyTotalsEntries);

  return { rows, summary, currencyTotals, isLoading };
}
