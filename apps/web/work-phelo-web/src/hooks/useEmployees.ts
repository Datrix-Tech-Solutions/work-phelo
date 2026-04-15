import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Employee,
  CreateEmployeePayload,
  EmployeeQuery,
  OffboardingRecord,
  InitiateOffboardDto,
  UpdateChecklistDto,
} from '@/types/hr';

export function useEmployees(query?: EmployeeQuery) {
  return useQuery({
    queryKey: ['employees', query],
    queryFn: async () => {
      const res = await api.get('/hr/employees', { params: query });
      const raw = res.data;
      // Backend returns { employees, meta } — normalise to { data, total }
      if (Array.isArray(raw)) return { data: raw as Employee[], total: raw.length };
      if (Array.isArray(raw?.employees))
        return {
          data: raw.employees as Employee[],
          total: raw.meta?.total ?? raw.employees.length,
        };
      if (Array.isArray(raw?.data))
        return { data: raw.data as Employee[], total: raw.total ?? raw.data.length };
      return { data: [] as Employee[], total: 0 };
    },
  });
}

export function useEmployee(id: string) {
  return useQuery({
    queryKey: ['employees', id],
    queryFn: async () => {
      const res = await api.get<Employee>(`/hr/employees/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useMyProfile() {
  return useQuery({
    queryKey: ['employees', 'me'],
    queryFn: async () => {
      const res = await api.get<Employee>('/hr/employees/me');
      return res.data;
    },
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateEmployeePayload) => {
      const res = await api.post<Employee>('/hr/employees', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }: Partial<CreateEmployeePayload> & { id: string }) => {
      const res = await api.patch<Employee>(`/hr/employees/${id}`, payload);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees', id] });
    },
  });
}

export function useOffboardingRecord(employeeId: string) {
  return useQuery({
    queryKey: ['employees', employeeId, 'offboarding'],
    queryFn: async () => {
      const res = await api.get<OffboardingRecord | null>(`/hr/employees/${employeeId}/offboard`);
      return res.data;
    },
    enabled: !!employeeId,
  });
}

export function useInitiateOffboard(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: InitiateOffboardDto) => {
      const res = await api.post<OffboardingRecord>(`/hr/employees/${employeeId}/offboard`, dto);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['employees', employeeId, 'offboarding'],
      });
    },
  });
}

export function useUpdateOffboardChecklist(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: UpdateChecklistDto) => {
      const res = await api.patch<OffboardingRecord>(
        `/hr/employees/${employeeId}/offboard/checklist`,
        dto,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['employees', employeeId, 'offboarding'],
      });
    },
  });
}

export function useCompleteOffboard(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.post(`/hr/employees/${employeeId}/offboard/complete`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
      queryClient.invalidateQueries({
        queryKey: ['employees', employeeId, 'offboarding'],
      });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useOffboardEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await api.patch(`/hr/employees/${id}/offboard`, { reason });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useResendEmployeeInvite() {
  return useMutation({
    mutationFn: async (employeeId: string) => {
      const res = await api.post(`/hr/employees/${employeeId}/resend-invite`);
      return res.data;
    },
  });
}
