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

export function useDeactivateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await api.patch(`/auth/tenants/${tenantId}/deactivate`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });
}

export function useDeleteTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tenantId: string) => {
      const res = await api.delete(`/auth/tenants/${tenantId}`);
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

// Tenant-scoped: calls GET /auth/users — uses the JWT's own tenantId (no SUPER_ADMIN required)
export function useCurrentTenantUsers() {
  return useQuery({
    queryKey: ['current-tenant-users'],
    queryFn: () => api.get('/auth/users').then((r) => r.data),
  });
}

export function useTenantAudit(id: string) {
  return useQuery({
    queryKey: ['tenant-audit', id],
    queryFn: () => api.get(`/auth/tenants/${id}/audit`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useUpdateTenant(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      name?: string;
      size?: string;
      industry?: string;
      country?: string;
      phone?: string;
    }) => api.patch(`/auth/tenants/${id}`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant', id] });
      queryClient.invalidateQueries({ queryKey: ['tenants'] });
    },
  });
}

export function useUpdateTenantAdmin(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { firstName: string; lastName: string; email: string }) =>
      api.patch(`/auth/tenants/${id}/admin`, payload).then((r) => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-users', id] });
    },
  });
}
