import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { TaxType, CreateTaxTypePayload, UpdateTaxTypePayload } from '@/types/accounting';

const BASE = '/accounting/tax-types';
export const TAX_TYPES_KEY = ['accounting', 'tax-types'] as const;

export function useTaxTypes() {
  return useQuery({
    queryKey: TAX_TYPES_KEY,
    queryFn: async () => (await api.get<TaxType[]>(BASE)).data,
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
