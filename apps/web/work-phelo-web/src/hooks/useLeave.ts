import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { LeaveType, LeaveRequest } from '@/types/hr';

export function useLeaveTypes() {
  return useQuery({
    queryKey: ['leave', 'types'],
    queryFn: async () => {
      const res = await api.get<LeaveType[]>('/hr/leave/types');
      return res.data;
    },
  });
}

export function useCreateLeaveType() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      name: string;
      defaultDays: number;
      isPaid: boolean;
      description?: string;
    }) => {
      const res = await api.post<LeaveType>('/hr/leave/types', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave', 'types'] });
    },
  });
}

export function useLeaveRequests(status?: string) {
  return useQuery({
    queryKey: ['leave', 'requests', status],
    queryFn: async () => {
      const res = await api.get<LeaveRequest[]>('/hr/leave/requests', {
        params: status ? { status } : undefined,
      });
      return res.data;
    },
  });
}

export function useMyLeaveRequests() {
  return useQuery({
    queryKey: ['leave', 'requests', 'my'],
    queryFn: async () => {
      const res = await api.get<LeaveRequest[]>('/hr/leave/requests/my');
      return res.data;
    },
  });
}

export function useLeaveBalances(employeeId?: string) {
  return useQuery({
    queryKey: ['leave', 'balances', employeeId ?? 'me'],
    queryFn: async () => {
      const url = employeeId ? `/hr/leave/balances/${employeeId}` : '/hr/leave/balances/me';
      const res = await api.get(url);
      return res.data;
    },
  });
}

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: {
      leaveTypeId: string;
      startDate: string;
      endDate: string;
      reason: string;
    }) => {
      const res = await api.post<LeaveRequest>('/hr/leave/requests', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave', 'requests'] });
      queryClient.invalidateQueries({ queryKey: ['leave', 'balances'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useReviewLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      note,
    }: {
      id: string;
      status: 'APPROVED' | 'REJECTED';
      note?: string;
    }) => {
      const res = await api.patch(`/hr/leave/requests/${id}/review`, { status, note });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave', 'requests'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCancelLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch(`/hr/leave/requests/${id}/cancel`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave', 'requests'] });
    },
  });
}
