import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Branch } from '@/types/hr';
import type { BranchImportRow, BulkImportRowResult } from '@/lib/hr/bulkImportTypes';

export type BranchOption = Pick<Branch, 'id' | 'name'>;

export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const res = await api.get<Branch[]>('/hr/branches');
      return Array.isArray(res.data) ? res.data : ((res.data as { data: Branch[] })?.data ?? []);
    },
  });
}

export function useBranchOptions(enabled = true) {
  return useQuery({
    queryKey: ['branch-options'],
    queryFn: async () => {
      const res = await api.get<BranchOption[]>('/hr/branches/options');
      return Array.isArray(res.data)
        ? res.data
        : ((res.data as { data: BranchOption[] })?.data ?? []);
    },
    enabled,
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      code?: string;
      address?: string;
      city?: string;
      region?: string;
      country?: string;
      phone?: string;
      email?: string;
      managerId?: string;
      isHeadOffice?: boolean;
    }) => {
      const res = await api.post<Branch>('/hr/branches', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['branch-options'] });
    },
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: {
      id: string;
      name?: string;
      code?: string;
      address?: string;
      city?: string;
      region?: string;
      country?: string;
      phone?: string;
      email?: string;
      managerId?: string;
      isHeadOffice?: boolean;
      isActive?: boolean;
    }) => {
      const res = await api.patch<Branch>(`/hr/branches/${id}`, payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['branch-options'] });
    },
  });
}

export function useBulkImportBranches() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (rows: BranchImportRow[]) => {
      const payload = rows.map((row) => ({
        rowNumber: row.rowNumber,
        name: row.name,
        code: row.code,
        country: row.country,
        address: row.address,
        city: row.city,
        region: row.region,
        phone: row.phone,
        email: row.email,
        managerName: row.managerName,
        isHeadOffice: row.isHeadOffice,
      }));
      const res = await api.post<BulkImportRowResult[]>('/hr/branches/bulk-import', {
        rows: payload,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['branch-options'] });
    },
  });
}

export function useDeleteBranch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hr/branches/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({ queryKey: ['branch-options'] });
    },
  });
}
