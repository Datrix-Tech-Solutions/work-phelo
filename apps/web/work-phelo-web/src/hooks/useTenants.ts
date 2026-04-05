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
