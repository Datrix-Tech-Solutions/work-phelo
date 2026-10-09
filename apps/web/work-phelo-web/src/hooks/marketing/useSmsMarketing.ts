import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  CreateSmsSenderIdentityPayload,
  CreateTenantDomainPayload,
  SmsSenderIdentity,
  SmsSenderIdentityListResponse,
  CommunicationProviderStatus,
  SmsSenderIdentityStatus,
  SmsWalletBalance,
  TenantDomain,
  TenantDomainListResponse,
  TenantDomainVerificationResponse,
  UpdateSmsSenderIdentityPayload,
} from '@/types/marketing';

const SENDER_ENDPOINT = '/marketing/settings/sms-sender-identities';
const DOMAINS_ENDPOINT = '/marketing/settings/domains';
const WALLET_ENDPOINT = '/marketing/sms-wallet';
const SMS_KEY = ['marketing', 'sms'] as const;
const DOMAINS_KEY = ['marketing', 'domains'] as const;

export function useSmsSenderIdentities(
  query: {
    status?: SmsSenderIdentityStatus;
    providerStatus?: CommunicationProviderStatus;
    providerStatusNot?: CommunicationProviderStatus;
  } = {},
) {
  return useQuery({
    queryKey: [...SMS_KEY, 'sender-identities', query] as const,
    queryFn: async () => {
      const res = await api.get<SmsSenderIdentityListResponse>(SENDER_ENDPOINT, {
        params: query,
      });
      return res.data.items;
    },
  });
}

export function useSmsWalletBalance() {
  return useQuery({
    queryKey: [...SMS_KEY, 'wallet', 'balance'] as const,
    queryFn: async () => {
      const res = await api.get<SmsWalletBalance>(`${WALLET_ENDPOINT}/balance`);
      return res.data;
    },
  });
}

export function useCreateSmsSenderIdentity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateSmsSenderIdentityPayload) => {
      const res = await api.post<SmsSenderIdentity>(SENDER_ENDPOINT, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SMS_KEY }),
  });
}

export function useUpdateSmsSenderIdentity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateSmsSenderIdentityPayload) => {
      const res = await api.patch<SmsSenderIdentity>(`${SENDER_ENDPOINT}/${id}`, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SMS_KEY }),
  });
}

export function useArchiveSmsSenderIdentity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete<SmsSenderIdentity>(`${SENDER_ENDPOINT}/${id}`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SMS_KEY }),
  });
}

export function useSubmitSmsSenderIdentity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<SmsSenderIdentity>(`${SENDER_ENDPOINT}/${id}/submit`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SMS_KEY }),
  });
}

export function useRefreshSmsSenderProviderStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<SmsSenderIdentity>(
        `${SENDER_ENDPOINT}/${id}/refresh-provider-status`,
      );
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SMS_KEY }),
  });
}

export function useSetDefaultSmsSenderIdentity() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<SmsSenderIdentity>(`${SENDER_ENDPOINT}/${id}/default`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SMS_KEY }),
  });
}

export function useTenantDomains() {
  return useQuery({
    queryKey: DOMAINS_KEY,
    queryFn: async () => {
      const res = await api.get<TenantDomainListResponse>(DOMAINS_ENDPOINT);
      return res.data.items;
    },
  });
}

export function useCreateTenantDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateTenantDomainPayload) => {
      const res = await api.post<TenantDomain>(DOMAINS_ENDPOINT, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOMAINS_KEY }),
  });
}

export function useVerifyTenantDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<TenantDomainVerificationResponse>(
        `${DOMAINS_ENDPOINT}/${id}/verify`,
      );
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOMAINS_KEY }),
  });
}

export function useRegenerateTenantDomainVerification() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<TenantDomain>(`${DOMAINS_ENDPOINT}/${id}/regenerate-verification`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOMAINS_KEY }),
  });
}

export function useDeleteTenantDomain() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete<{ id: string }>(`${DOMAINS_ENDPOINT}/${id}`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DOMAINS_KEY }),
  });
}
