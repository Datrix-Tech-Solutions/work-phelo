import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Employee, CreateEmployeePayload, EmployeeQuery } from '@/types/hr';

export function useEmployees(query?: EmployeeQuery) {
  return useQuery({
    queryKey: ['employees', query],
    queryFn: async () => {
      const res = await api.get<{ data: Employee[]; total: number }>('/hr/employees', {
        params: query,
      });
      return res.data;
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
