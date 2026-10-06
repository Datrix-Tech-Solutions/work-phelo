import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  CreateSmsSenderIdentityPayload,
  SmsSenderIdentity,
  SmsSenderIdentityListResponse,
  SmsSenderIdentityStatus,
  SmsWalletBalance,
  UpdateSmsSenderIdentityPayload,
} from '@/types/marketing';

const SENDER_ENDPOINT = '/marketing/settings/sms-sender-identities';
const WALLET_ENDPOINT = '/marketing/sms-wallet';
const SMS_KEY = ['marketing', 'sms'] as const;

export function useSmsSenderIdentities(query: { status?: SmsSenderIdentityStatus } = {}) {
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
