import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  PayrollItem,
  PayrollRun,
  PayrollRunDetail,
  PayrollAccountingStatus,
  PayrollSettings,
  PayrollSettlementStatus,
  RunPayrollDto,
  RunConfiguredPayrollDto,
  ApprovePayrollMonthResult,
  PayrollDecisionDto,
  UpdatePayrollItemDto,
  UpdatePayrollSettingsDto,
} from '@/types/hr';

export function usePayrollRuns() {
  return useQuery({
    queryKey: ['payroll'],
    queryFn: async () => {
      const res = await api.get<PayrollRun[]>('/hr/payroll');
      return res.data;
    },
  });
}

export function usePayrollRun(id: string) {
  return useQuery({
    queryKey: ['payroll', id],
    queryFn: async () => {
      const res = await api.get<PayrollRunDetail>(`/hr/payroll/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

/** Polls while the run is APPROVED and still awaiting settlement, so the progress view
 *  reflects payments made in Accounting without the employer needing to refresh. Null
 *  means the tenant isn't linked to Accounting. */
export function usePayrollSettlementStatus(
  id: string,
  runStatus: PayrollRun['status'] | undefined,
) {
  return useQuery({
    queryKey: ['payroll', id, 'settlement-status'],
    queryFn: async () => {
      const res = await api.get<PayrollSettlementStatus | null>(
        `/hr/payroll/${id}/settlement-status`,
      );
      return res.data;
    },
    enabled: !!id,
    refetchInterval: runStatus === 'APPROVED' ? 15000 : false,
  });
}

export function useMyPayslips() {
  return useQuery({
    queryKey: ['payroll', 'my-payslips'],
    queryFn: async () => {
      const res = await api.get<PayrollItem[]>('/hr/payroll/my-payslips');
      return res.data;
    },
  });
}

export function useEmployeePayslips(employeeId: string) {
  const { data: runs = [] } = usePayrollRuns();

  const eligibleRuns = runs.filter((r) => r.status === 'APPROVED' || r.status === 'PAID');
  const runIds = eligibleRuns.map((r) => r.id);

  return useQuery({
    queryKey: ['payroll', 'employee-payslips', employeeId, runIds],
    queryFn: async () => {
      const details = await Promise.all(
        eligibleRuns.map((run) =>
          api.get<PayrollRunDetail>(`/hr/payroll/${run.id}`).then((r) => r.data),
        ),
      );
      const items: PayrollItem[] = [];
      for (const detail of details) {
        const item = detail.items.find((i) => i.employeeId === employeeId);
        if (item) {
          items.push({
            ...item,
            payrollRun: {
              month: detail.month,
              year: detail.year,
              status: detail.status,
              paidAt: detail.paidAt ?? null,
              payrollCountry: detail.payrollCountry,
              payrollCurrency: detail.payrollCurrency,
              tier3Enabled: detail.tier3Enabled,
              tier3Rate: detail.tier3Rate ?? null,
              tier3SchemeName: detail.tier3SchemeName ?? null,
            },
          });
        }
      }
      return items;
    },
    enabled: !!employeeId && runIds.length > 0,
  });
}

export function useRunPayroll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RunPayrollDto) => {
      const res = await api.post<PayrollRunDetail>('/hr/payroll/run', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
  });
}

export function useUpdatePayrollItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      payrollRunId: string;
      itemId: string;
      data: UpdatePayrollItemDto;
    }) => {
      const res = await api.patch<PayrollRunDetail>(
        `/hr/payroll/${payload.payrollRunId}/items/${payload.itemId}`,
        payload.data,
      );
      return res.data;
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      queryClient.setQueryData(['payroll', variables.payrollRunId], data);
    },
  });
}

export function useSubmitPayroll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch<PayrollRun>(`/hr/payroll/${id}/submit`);
      return res.data;
    },
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', id] });
    },
  });
}

/** Whether approving payroll will post it to Accounting - asked fresh each time the approve screen opens. */
export function usePayrollAccountingStatus(enabled: boolean) {
  return useQuery({
    queryKey: ['payroll', 'accounting-status'],
    queryFn: async () =>
      (await api.get<PayrollAccountingStatus>('/hr/payroll/accounting-status')).data,
    enabled,
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

/** Runs one payslip type for a month: the server works every payslip out and sends it for approval. */
export function useRunConfiguredPayroll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RunConfiguredPayrollDto) => {
      const res = await api.post<PayrollRun>('/hr/payroll-runs', payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll'] }),
  });
}

/** Approves every run of the month that is waiting for approval. */
export function useApprovePayrollMonth() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { month: number; year: number; note?: string }) => {
      const res = await api.post<ApprovePayrollMonthResult>('/hr/payroll-runs/approve', payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payroll'] }),
  });
}

export function useApprovePayroll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const res = await api.patch(`/hr/payroll/${id}/approve`, {
        note,
      } satisfies PayrollDecisionDto);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', id] });
    },
  });
}

export function useReturnPayrollToDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const res = await api.patch<PayrollRun>(`/hr/payroll/${id}/return-to-draft`, {
        note,
      } satisfies PayrollDecisionDto);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
      queryClient.invalidateQueries({ queryKey: ['payroll', id] });
    },
  });
}

export function useRejectPayroll() {
  return useReturnPayrollToDraft();
}

export function useMarkPayrollPaid() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch(`/hr/payroll/${id}/mark-paid`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
  });
}

export function usePayrollSettings() {
  return useQuery({
    queryKey: ['payroll', 'settings'],
    queryFn: async () => {
      const res = await api.get<PayrollSettings>('/hr/settings/payroll');
      return res.data;
    },
  });
}

export function useUpdatePayrollSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdatePayrollSettingsDto) => {
      const res = await api.patch<PayrollSettings>('/hr/settings/payroll', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll', 'settings'] });
    },
  });
}
