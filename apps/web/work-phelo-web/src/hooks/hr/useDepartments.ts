import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Department } from '@/types/hr';
import type { DepartmentImportRow, BulkImportRowResult } from '@/lib/hr/bulkImportTypes';

export type DepartmentOption = Pick<Department, 'id' | 'name'>;

export function useDepartments() {
  return useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const res = await api.get<Department[]>('/hr/departments');
      return res.data;
    },
  });
}

export function useDepartmentOptions(enabled = true) {
  return useQuery({
    queryKey: ['department-options'],
    queryFn: async () => {
      const res = await api.get<DepartmentOption[]>('/hr/departments/options');
      return res.data;
    },
    enabled,
  });
}

export function useDepartment(id: string) {
  return useQuery({
    queryKey: ['departments', id],
    queryFn: async () => {
      const res = await api.get<Department>(`/hr/departments/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { name: string; description?: string; branchId?: string }) => {
      const res = await api.post<Department>('/hr/departments', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['department-options'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useUpdateDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string;
      name?: string;
      description?: string;
      managerId?: string | null;
      branchId?: string | null;
      isActive?: boolean;
    }) => {
      const res = await api.patch<Department>(`/hr/departments/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['department-options'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useBulkImportDepartments() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rows: DepartmentImportRow[]) => {
      const payload = rows.map((row) => ({
        rowNumber: row.rowNumber,
        name: row.name,
        description: row.description,
        managerName: row.managerName,
        branchName: row.branchName,
      }));
      const res = await api.post<BulkImportRowResult[]>('/hr/departments/bulk-import', {
        rows: payload,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['department-options'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });
}

export function useDeleteDepartment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/hr/departments/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      queryClient.invalidateQueries({ queryKey: ['department-options'] });
    },
  });
}
