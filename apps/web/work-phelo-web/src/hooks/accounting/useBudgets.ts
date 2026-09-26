import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Budget, BudgetDetail, CreateBudgetPayload } from '@/types/accounting';

const BASE = '/accounting/budgets';
export const BUDGETS_KEY = ['accounting', 'budgets'] as const;

export function useBudgets() {
  return useQuery({
    queryKey: BUDGETS_KEY,
    queryFn: async () => (await api.get<Budget[]>(BASE)).data,
  });
}

/** One budget with each line's budgeted amount and posted actual. */
export function useBudget(budgetId: string | undefined) {
  return useQuery({
    queryKey: [...BUDGETS_KEY, budgetId],
    queryFn: async () => (await api.get<BudgetDetail>(`${BASE}/${budgetId}`)).data,
    enabled: Boolean(budgetId),
  });
}

// Every mutation invalidates the whole BUDGETS_KEY prefix, which covers the list and any
// open detail page (their actuals and totals both change).
function useInvalidateBudgets() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: BUDGETS_KEY });
}

export function useCreateBudget() {
  const invalidate = useInvalidateBudgets();
  return useMutation({
    mutationFn: async (payload: CreateBudgetPayload) =>
      (await api.post<BudgetDetail>(BASE, payload)).data,
    onSuccess: invalidate,
  });
}

/** Any subset of the create fields; `lines`, when sent, replaces the budget's lines. */
export function useUpdateBudget() {
  const invalidate = useInvalidateBudgets();
  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<CreateBudgetPayload> & { id: string }) =>
      (await api.patch<BudgetDetail>(`${BASE}/${id}`, payload)).data,
    onSuccess: invalidate,
  });
}

export function useActivateBudget() {
  const invalidate = useInvalidateBudgets();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<BudgetDetail>(`${BASE}/${id}/activate`)).data,
    onSuccess: invalidate,
  });
}

export function useCloseBudget() {
  const invalidate = useInvalidateBudgets();
  return useMutation({
    mutationFn: async (id: string) => (await api.post<BudgetDetail>(`${BASE}/${id}/close`)).data,
    onSuccess: invalidate,
  });
}

/** Drafts only — the API rejects deleting an active or closed budget. */
export function useDeleteBudget() {
  const invalidate = useInvalidateBudgets();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`${BASE}/${id}`);
    },
    onSuccess: invalidate,
  });
}
