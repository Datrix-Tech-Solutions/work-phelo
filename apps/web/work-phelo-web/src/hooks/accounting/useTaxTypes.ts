import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  TaxObligation,
  TaxOutstanding,
  TaxType,
  CreateTaxTypePayload,
  UpdateTaxTypePayload,
} from '@/types/accounting';

const BASE = '/accounting/tax-types';
export const TAX_TYPES_KEY = ['accounting', 'tax-types'] as const;

export function useTaxTypes() {
  return useQuery({
    queryKey: TAX_TYPES_KEY,
    queryFn: async () => (await api.get<TaxType[]>(BASE)).data,
  });
}

/** Taxes that are due and still owe something, read from the tax payable accounts. */
export function useTaxObligations(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...TAX_TYPES_KEY, 'obligations'] as const,
    queryFn: async () => (await api.get<TaxObligation[]>(`${BASE}/obligations`)).data,
    enabled: options?.enabled,
  });
}

/** What each tax owes right now, to fill in a tax payment. */
export function useTaxOutstanding(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...TAX_TYPES_KEY, 'outstanding'] as const,
    queryFn: async () => (await api.get<TaxOutstanding[]>(`${BASE}/outstanding`)).data,
    enabled: options?.enabled,
  });
}

export function useCreateTaxType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateTaxTypePayload) =>
      (await api.post<TaxType>(BASE, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TAX_TYPES_KEY }),
  });
}

export function useUpdateTaxType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateTaxTypePayload & { id: string }) =>
      (await api.patch<TaxType>(`${BASE}/${id}`, payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TAX_TYPES_KEY }),
  });
}

export function useDeleteTaxType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => (await api.delete(`${BASE}/${id}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TAX_TYPES_KEY }),
  });
}
