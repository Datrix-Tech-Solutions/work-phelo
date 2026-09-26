import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CreateFiscalPeriodPayload,
  FiscalPeriod,
  FiscalPeriodCloseCheck,
  FiscalYear,
  FiscalYearDetail,
  QueryFiscalPeriodsParams,
} from '@/types/accounting';

const BASE = '/accounting/fiscal-periods';
const YEARS_BASE = '/accounting/fiscal-years';
const FISCAL_PERIODS_KEY = ['accounting', 'fiscal-periods'] as const;
const FISCAL_YEARS_KEY = ['accounting', 'fiscal-years'] as const;

// A year's status and progress are derived from its periods, so any period change also
// refreshes the years (list and detail) — and generating a year refreshes the periods.
function useInvalidateFiscal() {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: FISCAL_PERIODS_KEY }),
      queryClient.invalidateQueries({ queryKey: FISCAL_YEARS_KEY }),
    ]);
}

export function useFiscalPeriods(params: QueryFiscalPeriodsParams = {}) {
  const { status } = params;
  return useQuery({
    queryKey: [...FISCAL_PERIODS_KEY, status ?? null],
    queryFn: async () => {
      const res = await api.get<FiscalPeriod[]>(BASE, { params: { status } });
      return res.data;
    },
  });
}

export function useFiscalYears() {
  return useQuery({
    queryKey: FISCAL_YEARS_KEY,
    queryFn: async () => (await api.get<FiscalYear[]>(YEARS_BASE)).data,
  });
}

/** One fiscal year with its periods in calendar order. */
export function useFiscalYear(yearId: string | undefined) {
  return useQuery({
    queryKey: [...FISCAL_YEARS_KEY, yearId],
    queryFn: async () => (await api.get<FiscalYearDetail>(`${YEARS_BASE}/${yearId}`)).data,
    enabled: Boolean(yearId),
  });
}

export function useCreateFiscalPeriod() {
  const invalidate = useInvalidateFiscal();
  return useMutation({
    mutationFn: async (payload: CreateFiscalPeriodPayload) => {
      const res = await api.post<FiscalPeriod>(BASE, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

/** Creates the fiscal year record and its 12 monthly periods. `startMonth` (1–12) defaults
 *  to the tenant's configured fiscal year start month. */
export function useGenerateFiscalYear() {
  const invalidate = useInvalidateFiscal();
  return useMutation({
    mutationFn: async ({ year, startMonth }: { year: number; startMonth?: number }) => {
      const res = await api.post<FiscalYearDetail>(YEARS_BASE, { year, startMonth });
      return res.data;
    },
    onSuccess: invalidate,
  });
}

function useFiscalPeriodStatusMutation(action: 'open' | 'soft-close' | 'close' | 'lock') {
  const invalidate = useInvalidateFiscal();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<FiscalPeriod>(`${BASE}/${id}/${action}`);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useOpenFiscalPeriod() {
  return useFiscalPeriodStatusMutation('open');
}

export function useSoftCloseFiscalPeriod() {
  return useFiscalPeriodStatusMutation('soft-close');
}

/** What still needs attention before an open period can be soft closed or closed. Always
 *  fetched fresh — the answer changes as drafts get posted. */
export function useFiscalPeriodCloseCheck(periodId: string | undefined) {
  return useQuery({
    queryKey: [...FISCAL_PERIODS_KEY, periodId, 'close-check'],
    queryFn: async () =>
      (await api.get<FiscalPeriodCloseCheck>(`${BASE}/${periodId}/close-check`)).data,
    enabled: Boolean(periodId),
    staleTime: 0,
    gcTime: 0,
  });
}

export function useCloseFiscalPeriod() {
  return useFiscalPeriodStatusMutation('close');
}

export function useLockFiscalPeriod() {
  return useFiscalPeriodStatusMutation('lock');
}
