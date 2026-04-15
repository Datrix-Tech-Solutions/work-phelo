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

// ─── Response transformers ────────────────────────────────────────────────────
// Backend returns snake_case-style DB fields and nested relations.
// These adapters normalise the shape to what the frontend types expect.

function transformBalance(b: any): LeaveBalance {
  return {
    leaveTypeId: b.leaveTypeId,
    leaveTypeName: b.leaveType?.name ?? '',
    entitled: b.totalDays,
    used: b.usedDays,
    pending: b.pendingDays,
    remaining: b.remainingDays,
    carriedOver: 0, // carry-over processing not yet implemented in backend
  };
}

function transformRequest(r: any): LeaveRequest {
  // Backend status is UPPER_CASE enum; frontend uses Title case for display/badge lookup.
  const status = r.status.charAt(0).toUpperCase() + r.status.slice(1).toLowerCase();
  return {
    id: r.id,
    tenantSlug: '',
    employeeId: r.employeeId,
    employeeName: r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : '',
    leaveTypeId: r.leaveTypeId,
    leaveTypeName: r.leaveType?.name ?? '',
    isPaid: r.leaveType?.isPaid ?? false,
    startDate: r.startDate,
    endDate: r.endDate,
    totalDays: r.totalDays,
    reason: r.reason,
    documentationUrl: r.documentationUrl,
    status: status as LeaveRequest['status'],
    // Approved and rejected paths store reviewer in separate columns
    reviewedBy: r.approvedBy ?? r.rejectedBy ?? undefined,
    reviewedAt: r.approvedAt ?? r.rejectedAt ?? undefined,
    reviewNote: r.rejectionNote ?? undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

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
      const res = await api.get<any[]>('/hr/leave/requests', {
        params: status ? { status } : undefined,
      });
      return res.data.map(transformRequest);
    },
  });
}

export function useMyLeaveRequests() {
  return useQuery({
    queryKey: leaveKeys.myRequests(),
    queryFn: async () => {
      const res = await api.get<any[]>('/hr/leave/requests/my');
      return res.data.map(transformRequest);
    },
  });
}

export function useCreateLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateLeaveRequestDto) => {
      const res = await api.post<any>('/hr/leave/requests', payload);
      return transformRequest(res.data);
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
      action,
      note,
    }: {
      id: string;
      action: 'APPROVED' | 'REJECTED';
      note?: string;
    }) => {
      // Backend DTO expects { action, note } — not { status, reviewNote }
      const res = await api.patch<any>(`/hr/leave/requests/${id}/review`, {
        action,
        note,
      });
      return transformRequest(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.requests() });
      queryClient.invalidateQueries({ queryKey: leaveKeys.myRequests() });
      queryClient.invalidateQueries({ queryKey: leaveKeys.balances() });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCancelLeaveRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.patch<any>(`/hr/leave/requests/${id}/cancel`);
      return transformRequest(res.data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: leaveKeys.requests() });
      queryClient.invalidateQueries({ queryKey: leaveKeys.myRequests() });
      queryClient.invalidateQueries({ queryKey: leaveKeys.balances() });
    },
  });
}

// ─── Leave Balances ───────────────────────────────────────────────────────────

export function useLeaveBalances(employeeId?: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: leaveKeys.balances(employeeId),
    queryFn: async () => {
      const url = employeeId ? `/hr/leave/balances/${employeeId}` : '/hr/leave/balances/me';
      const res = await api.get<any[]>(url);
      return res.data.map(transformBalance);
    },
    enabled: options?.enabled ?? true,
  });
}
