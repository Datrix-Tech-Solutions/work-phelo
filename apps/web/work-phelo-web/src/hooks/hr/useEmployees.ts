import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Employee,
  EmployeeOption,
  EmployeeAllowance,
  EmployeeDocument,
  CreateEmployeePayload,
  UpdateEmployeePayload,
  AddAllowancePayload,
  UploadDocumentPayload,
  EmployeeQuery,
  OffboardingRecord,
  InitiateOffboardDto,
  UpdateChecklistDto,
  ResignationPayload,
  ResignationRecord,
} from '@/types/hr';

export function useEmployees(query?: EmployeeQuery) {
  return useQuery({
    queryKey: ['employees', query],
    queryFn: async () => {
      const res = await api.get<{ employees: Employee[]; meta: { total: number } }>(
        '/hr/employees',
        { params: query },
      );
      return {
        data: res.data.employees,
        total: res.data.meta.total,
      };
    },
  });
}

export function useEmployeeOptions() {
  return useQuery({
    queryKey: ['employee-options'],
    queryFn: async () => {
      const res = await api.get<EmployeeOption[]>('/hr/employees/options');
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
    mutationFn: async ({ id, ...payload }: UpdateEmployeePayload & { id: string }) => {
      const res = await api.patch<Employee>(`/hr/employees/${id}`, payload);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees', id] });
      queryClient.invalidateQueries({ queryKey: ['departments'] });
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

export function useResignationRecord(employeeId: string) {
  return useQuery({
    queryKey: ['employees', employeeId, 'resignation'],
    queryFn: async () => {
      const res = await api.get<ResignationRecord | null>(
        `/hr/employees/${employeeId}/resignation`,
      );
      return res.data;
    },
    enabled: !!employeeId,
  });
}

export function useResignEmployee(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ResignationPayload) => {
      const res = await api.post(`/hr/employees/${employeeId}/resignation`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'resignation'] });
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
    },
  });
}

export function useWithdrawResignation(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.delete(`/hr/employees/${employeeId}/resignation`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'resignation'] });
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
    },
  });
}

export function useDismissResignation(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await api.patch(`/hr/employees/${employeeId}/resignation/dismiss`, {});
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId, 'resignation'] });
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
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

export function useAddAllowance(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AddAllowancePayload) => {
      const res = await api.post<EmployeeAllowance>(
        `/hr/employees/${employeeId}/allowances`,
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
    },
  });
}

export function useUploadDocument(employeeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UploadDocumentPayload) => {
      const res = await api.post<EmployeeDocument>(
        `/hr/employees/${employeeId}/documents`,
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees', employeeId] });
    },
  });
}
