import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  CreateSmsSenderIdentityPayload,
  SmsSenderIdentity,
  SmsSenderIdentityListResponse,
  SmsWalletBalance,
  UpdateSmsSenderIdentityPayload,
} from '@/types/marketing';

// Super-admin provisioning of a tenant's SMS sender IDs and wallet. These platform routes take
// the tenant from the path, unlike the tenant-facing ones in useSmsMarketing which use the session.

export type SmsLedgerEntryType =
  | 'INITIAL_ALLOCATION'
  | 'PLAN_ALLOCATION'
  | 'PURCHASE'
  | 'ADMIN_GRANT'
  | 'PROMOTIONAL'
  | 'CAMPAIGN_RESERVATION'
  | 'CAMPAIGN_CONSUMPTION'
  | 'CAMPAIGN_RELEASE'
  | 'CAMPAIGN_REFUND'
  | 'ADMIN_ADJUSTMENT';

export interface SmsLedgerEntry {
  id: string;
  type: SmsLedgerEntryType;
  credits: number;
  availableBefore: number;
  availableAfter: number;
  reservedBefore: number;
  reservedAfter: number;
  campaignId: string | null;
  reason: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface SmsLedgerPage {
  data: SmsLedgerEntry[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface GrantSmsCreditsPayload {
  credits: number;
  reason?: string;
  idempotencyKey?: string;
}

const base = (tenantId: string) => `/marketing/platform/tenants/${tenantId}/sms`;
const key = (tenantId: string) => ['marketing', 'platform', 'sms', tenantId] as const;

export function useTenantSmsSenderIdentities(tenantId: string) {
  return useQuery({
    queryKey: [...key(tenantId), 'sender-identities'] as const,
    queryFn: async () => {
      const res = await api.get<SmsSenderIdentityListResponse>(
        `${base(tenantId)}/sender-identities`,
      );
      return res.data.items;
    },
    enabled: Boolean(tenantId),
  });
}

export function useTenantSmsWalletBalance(tenantId: string) {
  return useQuery({
    queryKey: [...key(tenantId), 'wallet', 'balance'] as const,
    queryFn: async () => {
      const res = await api.get<SmsWalletBalance>(`${base(tenantId)}/wallet`);
      return res.data;
    },
    enabled: Boolean(tenantId),
  });
}

export function useTenantSmsLedger(tenantId: string, page: number, limit = 10) {
  return useQuery({
    queryKey: [...key(tenantId), 'wallet', 'ledger', page, limit] as const,
    queryFn: async () => {
      const res = await api.get<SmsLedgerPage>(`${base(tenantId)}/wallet/ledger`, {
        params: { page, limit },
      });
      return res.data;
    },
    placeholderData: keepPreviousData,
    enabled: Boolean(tenantId),
  });
}

function useInvalidatingMutation<TVars, TData>(
  tenantId: string,
  mutationFn: (vars: TVars) => Promise<TData>,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(tenantId) }),
  });
}

export function useCreateTenantSmsSenderIdentity(tenantId: string) {
  return useInvalidatingMutation(tenantId, async (payload: CreateSmsSenderIdentityPayload) => {
    const res = await api.post<SmsSenderIdentity>(`${base(tenantId)}/sender-identities`, payload);
    return res.data;
  });
}

export function useUpdateTenantSmsSenderIdentity(tenantId: string) {
  return useInvalidatingMutation(
    tenantId,
    async ({ id, ...payload }: UpdateSmsSenderIdentityPayload) => {
      const res = await api.patch<SmsSenderIdentity>(
        `${base(tenantId)}/sender-identities/${id}`,
        payload,
      );
      return res.data;
    },
  );
}

export function useArchiveTenantSmsSenderIdentity(tenantId: string) {
  return useInvalidatingMutation(tenantId, async (id: string) => {
    const res = await api.delete<SmsSenderIdentity>(`${base(tenantId)}/sender-identities/${id}`);
    return res.data;
  });
}

export function useSetDefaultTenantSmsSenderIdentity(tenantId: string) {
  return useInvalidatingMutation(tenantId, async (id: string) => {
    const res = await api.post<SmsSenderIdentity>(
      `${base(tenantId)}/sender-identities/${id}/default`,
    );
    return res.data;
  });
}

export function useGrantTenantSmsCredits(tenantId: string) {
  return useInvalidatingMutation(tenantId, async (payload: GrantSmsCreditsPayload) => {
    const res = await api.post<SmsWalletBalance>(`${base(tenantId)}/wallet/grants`, payload);
    return res.data;
  });
}
