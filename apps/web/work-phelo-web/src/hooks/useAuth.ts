import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';
import { User, LoginPayload } from '@/types/auth';

async function fetchMeWithManagerFlag(setPermissions: (p: string[]) => void): Promise<User> {
  const res = await api.get<{ user: User }>('/auth/me');
  const authUser = res.data.user;
  if (authUser.role === 'EMPLOYEE') {
    await Promise.all([
      api
        .get<{ isManager: boolean; lastName?: string }>('/hr/employees/me')
        .then((r) => {
          authUser.isManager = r.data.isManager ?? false;
          // /auth/me doesn't return lastName — pull it from the HR profile
          if (r.data.lastName) authUser.lastName = r.data.lastName;
        })
        .catch(() => {}),
      api
        .get<{ effectivePermissions: string[]; companyRole?: string | null }>(
          `/auth/permissions/users/${authUser.id}`,
        )
        .then((r) => {
          setPermissions(r.data.effectivePermissions ?? []);
          authUser.companyRoleName = r.data.companyRole ?? null;
        })
        .catch(() => {}),
    ]);
  }
  return authUser;
}

export function useMe() {
  const { setUser, setPermissions } = useAuthStore();

  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const user = await fetchMeWithManagerFlag(setPermissions);
      setUser(user);
      return user;
    },
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}

export function useLogin() {
  const { setUser, setPermissions } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const res = await api.post<{ user: User }>('/auth/login', payload);
      return res.data;
    },
    onSuccess: async (data) => {
      const user = { ...data.user };

      if (user.role === 'EMPLOYEE') {
        await Promise.all([
          api
            .get<{ isManager: boolean; lastName?: string }>('/hr/employees/me')
            .then((r) => {
              user.isManager = r.data.isManager ?? false;
              if (r.data.lastName) user.lastName = r.data.lastName;
            })
            .catch(() => {}),
          api
            .get<{ effectivePermissions: string[]; companyRole?: string | null }>(
              `/auth/permissions/users/${user.id}`,
            )
            .then((r) => {
              setPermissions(r.data.effectivePermissions ?? []);
              user.companyRoleName = r.data.companyRole ?? null;
            })
            .catch(() => {}),
        ]);
      }

      setUser(user);
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useSuperAdminLogin() {
  const { setUser } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: { email: string; password: string }) => {
      const res = await api.post<{ user: User }>('/auth/admin/login', payload);
      return res.data;
    },
    onSuccess: (data) => {
      setUser(data.user);
      queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useLogout() {
  const { logout } = useAuthStore();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await api.post('/auth/logout');
    },
    onSuccess: () => {
      logout();
      queryClient.clear();
    },
  });
}

export function useForgotPassword() {
  return useMutation({
    mutationFn: async (payload: { email: string; tenantSlug: string }) => {
      const res = await api.post('/auth/forgot-password', payload);
      return res.data;
    },
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: async (payload: {
      token?: string;
      otpCode?: string;
      newPassword: string;
      email?: string;
      tenantSlug?: string;
    }) => {
      const res = await api.post('/auth/reset-password', payload);
      return res.data;
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (payload: { currentPassword: string; newPassword: string }) => {
      const res = await api.post('/auth/change-password', payload);
      return res.data;
    },
  });
}

export function useAcceptInvite() {
  return useMutation({
    mutationFn: async (payload: { inviteToken: string; password: string }) => {
      const res = await api.post('/auth/users/accept-invite', payload);
      return res.data;
    },
  });
}

export function useVerifyOtp() {
  return useMutation({
    mutationFn: (dto: { otp: string; tenantSlug?: string }) =>
      api.post('/auth/verify-otp', dto).then((r) => r.data),
  });
}

export function useResendOtp() {
  return useMutation({
    mutationFn: (dto: { tenantSlug?: string }) =>
      api.post('/auth/resend-otp', dto).then((r) => r.data),
  });
}
