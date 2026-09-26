import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CreateExchangeRatePayload,
  ExchangeRate,
  UpdateExchangeRatePayload,
} from '@/types/accounting';

const BASE = '/accounting/exchange-rates';
const EXCHANGE_RATES_KEY = ['accounting', 'exchange-rates'] as const;

export function useExchangeRates() {
  return useQuery({
    queryKey: EXCHANGE_RATES_KEY,
    queryFn: async () => {
      const res = await api.get<ExchangeRate[]>(BASE);
      return res.data;
    },
  });
}

export function useCreateExchangeRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateExchangeRatePayload) => {
      const res = await api.post<ExchangeRate>(BASE, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXCHANGE_RATES_KEY });
    },
  });
}

export function useUpdateExchangeRate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateExchangeRatePayload & { id: string }) => {
      const res = await api.patch<ExchangeRate>(`${BASE}/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXCHANGE_RATES_KEY });
    },
  });
}

export function useExchangeRatesForCurrency(
  fromCurrency: string | undefined,
  toBaseCurrency: string | null | undefined,
) {
  const { data = [], isLoading } = useExchangeRates();

  const rates = useMemo(() => {
    if (!fromCurrency || !toBaseCurrency) return [];
    return data
      .filter((r) => r.fromCurrency === fromCurrency && r.toCurrency === toBaseCurrency)
      .sort((a, b) => new Date(b.effectiveAt).getTime() - new Date(a.effectiveAt).getTime());
  }, [data, fromCurrency, toBaseCurrency]);

  const latestActive = useMemo(() => rates.find((r) => r.isActive), [rates]);

  return { rates, latestActive, isLoading };
}
