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

export function useCreateCompanyRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dto: {
      name: string;
      description?: string;
      permissions?: Record<string, string[]>;
    }) => api.post('/auth/company-roles', dto).then((r) => r.data),
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

export function useUpdateCompanyRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...dto
    }: {
      id: string;
      name?: string;
      description?: string;
      permissions?: Record<string, string[]>;
    }) => api.patch(`/auth/company-roles/${id}`, dto).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['company-roles'] }),
  });
}

export function useAssignPermissionSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, permissionSetId }: { userId: string; permissionSetId: string }) =>
      api.post('/auth/permissions/sets/assign', { userId, permissionSetId }).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-tenant-users'] });
      qc.invalidateQueries({ queryKey: ['user-permissions'] });
    },
  });
}

export function useRemovePermissionSet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, permissionSetId }: { userId: string; permissionSetId: string }) =>
      api.patch(`/auth/permissions/sets/remove/${userId}/${permissionSetId}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-tenant-users'] });
      qc.invalidateQueries({ queryKey: ['user-permissions'] });
    },
  });
}

export function useAssignCompanyRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companyRoleId, userId }: { companyRoleId: string; userId: string }) =>
      api.patch(`/auth/company-roles/${companyRoleId}/assign/${userId}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-roles'] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['current-tenant-users'] });
      qc.invalidateQueries({ queryKey: ['user-permissions'] });
    },
  });
}

export function useRemoveCompanyRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ companyRoleId, userId }: { companyRoleId: string; userId: string }) =>
      api.delete(`/auth/company-roles/${companyRoleId}/assign/${userId}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['company-roles'] });
      qc.invalidateQueries({ queryKey: ['employees'] });
      qc.invalidateQueries({ queryKey: ['current-tenant-users'] });
      qc.invalidateQueries({ queryKey: ['user-permissions'] });
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
