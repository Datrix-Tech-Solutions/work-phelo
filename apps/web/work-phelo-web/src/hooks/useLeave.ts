import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  LeaveType,
  LeaveRequest,
  LeaveBalance,
  CreateLeaveTypeDto,
  CreateLeaveRequestDto,
} from '@/types/hr';

// ─── Query Key Factory ────────────────────────────────────────────────────────

export const leaveKeys = {
  all: ['leave'] as const,
  types: (tenantSlug: string) => ['leave', 'types', tenantSlug] as const,
  requests: (status?: string) => ['leave', 'requests', status ?? 'all'] as const,
  myRequests: () => ['leave', 'requests', 'my'] as const,
  balances: (employeeId?: string) => ['leave', 'balances', employeeId ?? 'me'] as const,
};

// ─── Leave Types ──────────────────────────────────────────────────────────────

export function useLeaveTypes(tenantSlug: string) {
  return useQuery({
    queryKey: leaveKeys.types(tenantSlug),
    queryFn: async () => {
      const res = await api.get<LeaveType[]>('/hr/leave/types');
      return res.data;
    },
  });
}

export function useCreateLeaveType(tenantSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateLeaveTypeDto) => {
      const res = await api.post<LeaveType>('/hr/leave/types', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.types(tenantSlug) });
    },
  });
}

export function useUpdateLeaveType(tenantSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: CreateLeaveTypeDto & { id: string }) => {
      const res = await api.patch<LeaveType>(`/hr/leave/types/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.types(tenantSlug) });
    },
  });
}

export function useDeleteLeaveType(tenantSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hr/leave/types/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.types(tenantSlug) });
    },
  });
}

// ─── Leave Requests ───────────────────────────────────────────────────────────

export function useLeaveRequests(status?: string) {
  return useQuery({
    queryKey: leaveKeys.requests(status),
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
    queryKey: leaveKeys.myRequests(),
    queryFn: async () => {
      const res = await api.get<LeaveRequest[]>('/hr/leave/requests/my');
      return res.data;
    },
  });
}

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateLeaveRequestDto) => {
      const res = await api.post<LeaveRequest>('/hr/leave/requests', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.requests() });
      queryClient.invalidateQueries({ queryKey: leaveKeys.myRequests() });
      queryClient.invalidateQueries({ queryKey: leaveKeys.balances() });
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
      const res = await api.patch<LeaveRequest>(`/hr/leave/requests/${id}/review`, {
        status,
        note,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.requests() });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCancelLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch<LeaveRequest>(`/hr/leave/requests/${id}/cancel`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.requests() });
      queryClient.invalidateQueries({ queryKey: leaveKeys.myRequests() });
      queryClient.invalidateQueries({ queryKey: leaveKeys.balances() });
    },
  });
}

// ─── Leave Balances ───────────────────────────────────────────────────────────

export function useLeaveBalances(employeeId?: string) {
  return useQuery({
    queryKey: leaveKeys.balances(employeeId),
    queryFn: async () => {
      const url = employeeId ? `/hr/leave/balances/${employeeId}` : '/hr/leave/balances/me';
      const res = await api.get<LeaveBalance[]>(url);
      return res.data;
    },
  });
}
