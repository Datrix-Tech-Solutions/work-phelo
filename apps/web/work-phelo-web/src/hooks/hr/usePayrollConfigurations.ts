import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import { api } from '@/lib/api';
import type { PayComponent, PayslipTypeKey, SavedConfiguration } from '@/lib/payroll-engine';

const KEY = ['payroll', 'configurations'];

export interface SavePayrollConfigurationInput {
  /** Set to update an existing configuration; leave out to create one. */
  id?: string;
  name: string;
  payslipType: PayslipTypeKey;
  /** The currency its payslips are paid in. */
  currency: string;
  components: PayComponent[];
  /** Used when the components changed, which publishes a new version. */
  effectiveFrom: string;
  note: string;
  /** The latest version number the person was editing, so a newer save by someone else is caught. */
  baseVersion?: number;
}

export type SavePayrollConfigurationResult = SavedConfiguration & { published: boolean };

/** Every message the server gave, not only the first, since a configuration can fail several checks. */
export function payrollConfigurationError(err: unknown, fallback = 'Something went wrong'): string {
  const response = (err as AxiosError<{ message?: string | string[] }>)?.response;
  if (response && response.status < 500) {
    const message = response.data?.message;
    if (Array.isArray(message)) return message.join(' ');
    if (typeof message === 'string' && message) return message;
  }
  return fallback;
}

/**
 * The saved payroll configurations, each with its versions. A payslip type uses one configuration
 * at a time, so saving one for a type takes it from the configuration that had it.
 */
export function usePayrollConfigurations() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await api.get<SavedConfiguration[]>('/hr/payroll-configurations');
      return res.data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async ({ id, ...body }: SavePayrollConfigurationInput) => {
      const res = id
        ? await api.put<SavePayrollConfigurationResult>(`/hr/payroll-configurations/${id}`, body)
        : await api.post<SavePayrollConfigurationResult>('/hr/payroll-configurations', body);
      return res.data;
    },
    // Waits for the refreshed list, so the saved configuration is there when the save resolves.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });

  return {
    configurations: query.data ?? [],
    isLoading: query.isLoading,
    save: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
  };
}
