import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  PayrollSetup,
  SeedPayrollAccountsPayload,
  SeedPayrollAccountsResult,
} from '@/types/accounting';
import { GL_ACCOUNTS_KEY } from './useGLAccounts';
import { SOURCE_TYPES_KEY } from './useSourceTypes';

const BASE = '/accounting/payroll-integration';
// Under the source types key, so linking or unlinking a source refreshes it too.
export const PAYROLL_SETUP_KEY = [...SOURCE_TYPES_KEY, 'payroll-setup'] as const;

/** Which account handles each payroll function, and whether payroll is linked and ready. */
export function usePayrollSetup(enabled = true) {
  return useQuery({
    queryKey: PAYROLL_SETUP_KEY,
    queryFn: async () => (await api.get<PayrollSetup>(`${BASE}/setup`)).data,
    enabled,
  });
}

/** Choose the account for a payroll function, or clear it with `null`. Future runs only. */
export function useSetPayrollAccountMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ role, glAccountId }: { role: string; glAccountId: string | null }) =>
      (await api.put<PayrollSetup>(`${BASE}/mapping/${role}`, { glAccountId })).data,
    onSuccess: (setup) => {
      queryClient.setQueryData(PAYROLL_SETUP_KEY, setup);
      queryClient.invalidateQueries({ queryKey: SOURCE_TYPES_KEY });
    },
  });
}

/** Create a new account for a payroll function and use it for that function. */
export function useCreatePayrollRoleAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ role, name }: { role: string; name?: string }) =>
      (await api.post<PayrollSetup>(`${BASE}/mapping/${role}/create-account`, { name })).data,
    onSuccess: (setup) => {
      queryClient.setQueryData(PAYROLL_SETUP_KEY, setup);
      queryClient.invalidateQueries({ queryKey: GL_ACCOUNTS_KEY });
    },
  });
}

export function useUpdatePayrollAccountingSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (autoPostOnApproval: boolean) =>
      (await api.patch<{ autoPostOnApproval: boolean }>(`${BASE}/settings`, { autoPostOnApproval }))
        .data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PAYROLL_SETUP_KEY }),
  });
}

/** The shortcut: creates the standard payroll accounts and the wage payment type, and points
 *  each payroll function at the account it made - without overriding a choice already made. */
export function useSeedPayrollAccounts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SeedPayrollAccountsPayload) =>
      (await api.post<SeedPayrollAccountsResult>(`${BASE}/seed-accounts`, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GL_ACCOUNTS_KEY });
      queryClient.invalidateQueries({ queryKey: SOURCE_TYPES_KEY });
    },
  });
}
