import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { SeedPayrollAccountsPayload, SeedPayrollAccountsResult } from '@/types/accounting';
import { GL_ACCOUNTS_KEY } from './useGLAccounts';
import { SOURCE_TYPES_KEY } from './useSourceTypes';

export function useSeedPayrollAccounts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SeedPayrollAccountsPayload) =>
      (
        await api.post<SeedPayrollAccountsResult>(
          '/accounting/payroll-integration/seed-accounts',
          payload,
        )
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: GL_ACCOUNTS_KEY });
      queryClient.invalidateQueries({ queryKey: SOURCE_TYPES_KEY });
    },
  });
}
