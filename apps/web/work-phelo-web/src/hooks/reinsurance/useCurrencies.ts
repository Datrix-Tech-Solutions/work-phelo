import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Currency, CreateCurrencyPayload, UpdateCurrencyPayload } from '@/types/reinsurance';

const CURRENCIES_KEY = ['reinsurance', 'currencies'] as const;

export function useCurrencies() {
  return useQuery({
    queryKey: CURRENCIES_KEY,
    queryFn: async () => {
      const res = await api.get<Currency[]>('/operations/reinsurance/currencies');
      return Array.isArray(res.data) ? res.data : ((res.data as { data: Currency[] })?.data ?? []);
    },
  });
}

export function useCreateCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateCurrencyPayload) => {
      const res = await api.post<Currency>('/operations/reinsurance/currencies', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY });
    },
  });
}

export function useUpdateCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateCurrencyPayload & { id: string }) => {
      const res = await api.patch<Currency>(`/operations/reinsurance/currencies/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY });
    },
  });
}

export function useDeleteCurrency() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/operations/reinsurance/currencies/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CURRENCIES_KEY });
    },
  });
}

export function useCurrencyOptions() {
  return useQuery({
    queryKey: [...CURRENCIES_KEY, 'options'],
    queryFn: async () => {
      const res = await api.get<Currency[]>('/operations/reinsurance/currencies');
      const list = Array.isArray(res.data)
        ? res.data
        : ((res.data as { data: Currency[] })?.data ?? []);
      return list.map((c) => ({ value: c.id, label: `${c.isoCode} – ${c.name}` }));
    },
  });
}
