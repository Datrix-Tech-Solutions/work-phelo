import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { PayrollRun } from '@/types/hr';

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
      const res = await api.get<PayrollRun>(`/hr/payroll/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useMyPayslips() {
  return useQuery({
    queryKey: ['payroll', 'my-payslips'],
    queryFn: async () => {
      const res = await api.get('/hr/payroll/my-payslips');
      return res.data;
    },
  });
}

export function useRunPayroll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { month: number; year: number; notes?: string }) => {
      const res = await api.post<PayrollRun>('/hr/payroll/run', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
  });
}

export function useApprovePayroll() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch(`/hr/payroll/${id}/approve`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payroll'] });
    },
  });
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
