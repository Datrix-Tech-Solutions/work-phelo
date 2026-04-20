import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CompanyRole,
  PermissionSet,
  Resource,
  UserEffectivePermissions,
  UserPermission,
  CreateCompanyRoleDto,
  UpdateCompanyRoleDto,
  CreatePermissionSetDto,
  UpdatePermissionSetDto,
  GrantPermissionDto,
  RevokePermissionDto,
  AssignPermissionSetDto,
} from '@/types/roles';

// ── Company Roles ─────────────────────────────────────────

export function useCompanyRoles() {
  return useQuery({
    queryKey: ['company-roles'],
    queryFn: async () => {
      const res = await api.get<CompanyRole[]>('/auth/company-roles');
      return res.data;
    },
  });
}

export function useCompanyRole(id: string) {
  return useQuery({
    queryKey: ['company-roles', id],
    queryFn: async () => {
      const res = await api.get<CompanyRole>(`/auth/company-roles/${id}`);
      return res.data;
    },
    enabled: !!id,
  });
}

export function useCreateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreateCompanyRoleDto) => {
      const res = await api.post<CompanyRole>('/auth/company-roles', dto);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-roles'] });
    },
  });
}

export function useUpdateRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...dto }: UpdateCompanyRoleDto & { id: string }) => {
      const res = await api.patch<CompanyRole>(`/auth/company-roles/${id}`, dto);
      return res.data;
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['company-roles'] });
      queryClient.invalidateQueries({ queryKey: ['company-roles', id] });
    },
  });
}

export function useDeleteRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/auth/company-roles/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-roles'] });
    },
  });
}

// ── Role Assignment ───────────────────────────────────────

export function useAssignRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ roleId, userId }: { roleId: string; userId: string }) => {
      const res = await api.patch(`/auth/company-roles/${roleId}/assign/${userId}`);
      return res.data;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['company-roles'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['current-tenant-users'] });
      queryClient.invalidateQueries({ queryKey: ['permissions', 'users', userId] });
    },
  });
}

export function useUnassignRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ roleId, userId }: { roleId: string; userId: string }) => {
      const res = await api.delete(`/auth/company-roles/${roleId}/assign/${userId}`);
      return res.data;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['company-roles'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['current-tenant-users'] });
      queryClient.invalidateQueries({ queryKey: ['permissions', 'users', userId] });
    },
  });
}

// ── Permission Set Assignment ─────────────────────────────

export function useAssignPermissionSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: AssignPermissionSetDto) => {
      const res = await api.post('/auth/permissions/sets/assign', dto);
      return res.data;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['permissions', 'users', userId] });
      queryClient.invalidateQueries({ queryKey: ['current-tenant-users'] });
    },
  });
}

export function useRemovePermissionSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, permissionSetId }: AssignPermissionSetDto) => {
      const res = await api.patch(`/auth/permissions/sets/remove/${userId}/${permissionSetId}`);
      return res.data;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['permissions', 'users', userId] });
      queryClient.invalidateQueries({ queryKey: ['current-tenant-users'] });
    },
  });
}

// ── Permission Resources ──────────────────────────────────

export function usePermissionResources() {
  return useQuery({
    queryKey: ['permissions', 'resources'],
    queryFn: async () => {
      const res = await api.get<Resource[]>('/auth/permissions/resources');
      return res.data;
    },
    staleTime: 10 * 60 * 1000, // resources rarely change
  });
}

// ── Permission Sets ───────────────────────────────────────

export function usePermissionSets() {
  return useQuery({
    queryKey: ['permissions', 'sets'],
    queryFn: async () => {
      const res = await api.get<PermissionSet[]>('/auth/permissions/sets');
      return res.data;
    },
  });
}

export function useCreatePermissionSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: CreatePermissionSetDto) => {
      const res = await api.post<PermissionSet>('/auth/permissions/sets', dto);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions', 'sets'] });
    },
  });
}

export function useUpdatePermissionSet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...dto }: UpdatePermissionSetDto & { id: string }) => {
      const res = await api.patch<PermissionSet>(`/auth/permissions/sets/${id}`, dto);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions', 'sets'] });
    },
  });
}

// ── User Effective Permissions ────────────────────────────

export function useUserPermissions(userId: string) {
  return useQuery({
    queryKey: ['permissions', 'users', userId],
    queryFn: async () => {
      const res = await api.get<UserEffectivePermissions>(`/auth/permissions/users/${userId}`);
      return res.data;
    },
    enabled: !!userId,
  });
}

export function useUserPermissionHistory(userId: string) {
  return useQuery({
    queryKey: ['permissions', 'users', userId, 'history'],
    queryFn: async () => {
      const res = await api.get<UserPermission[]>(`/auth/permissions/users/${userId}/history`);
      return res.data;
    },
    enabled: !!userId,
  });
}

// ── Direct Grant / Revoke ─────────────────────────────────

export function useGrantPermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: GrantPermissionDto) => {
      const res = await api.post('/auth/permissions/grant', dto);
      return res.data;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({
        queryKey: ['permissions', 'users', userId],
      });
    },
  });
}

export function useRevokePermission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (dto: RevokePermissionDto) => {
      const res = await api.patch('/auth/permissions/revoke', dto);
      return res.data;
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({
        queryKey: ['permissions', 'users', userId],
      });
      queryClient.invalidateQueries({
        queryKey: ['permissions', 'users', userId, 'history'],
      });
    },
  });
}
