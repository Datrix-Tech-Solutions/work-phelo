import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Tenant, RegisterTenantPayload } from '@/types/tenant';

export function useTenants() {
  return useQuery({
    queryKey: ['tenants'],
    queryFn: async () => {
      const res = await api.get<{ tenants: Tenant[] }>('/auth/tenants');
      return res.data.tenants;
    },
  });
}

export function useRegisterTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: RegisterTenantPayload) => {
      const res = await api.post('/auth/tenants/register', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });
}

export function useApproveTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await api.patch(`/auth/tenants/${tenantId}/approve`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });
}

export function useSuspendTenant() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await api.patch(`/auth/tenants/${tenantId}/suspend`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });
}

export function useAssignAdmin() {
  return useMutation({
    mutationFn: async (payload: {
      tenantId: string;
      email: string;
      firstName: string;
      lastName: string;
    }) => {
      const res = await api.post('/auth/users/assign-admin', {
        ...payload,
        role: 'TENANT_ADMIN',
      });
      return res.data;
    },
  });
}

export function useResendInvite() {
  return useMutation({
    mutationFn: async (userId: string) => {
      const res = await api.post(`/auth/users/${userId}/resend-invite`);
      return res.data;
    },
  });
}

export function useCompanyRoles() {
  return useQuery({
    queryKey: ['company-roles'],
    queryFn: () => api.get('/auth/company-roles').then((r) => r.data),
  });
}

export function useCreateCompanyRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: { name: string; description?: string }) =>
      api.post('/auth/company-roles', dto).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-roles'] }),
  });
}

export function useDeleteCompanyRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/auth/company-roles/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-roles'] }),
  });
}

export function useTenant(id: string) {
  return useQuery({
    queryKey: ['tenant', id],
    queryFn: () => api.get(`/auth/tenants/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useTenantUsers(id: string) {
  return useQuery({
    queryKey: ['tenant-users', id],
    queryFn: () => api.get(`/auth/tenants/${id}/users`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useTenantAudit(id: string) {
  return useQuery({
    queryKey: ['tenant-audit', id],
    queryFn: () => api.get(`/auth/tenants/${id}/audit`).then((r) => r.data),
    enabled: !!id,
  });
}
