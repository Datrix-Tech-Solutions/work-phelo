import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CreateProspectingSettingPayload,
  ProspectingSetting,
  ProspectingSettingSlug,
  ProspectingSettingsResponse,
  UpdateProspectingSettingPayload,
} from '@/types/marketing';

const endpoint = (slug: ProspectingSettingSlug) => `/marketing/crm-settings/${slug}`;
const key = (slug: ProspectingSettingSlug) => ['marketing', 'crm-settings', slug] as const;

export function useProspectingSettings(slug: ProspectingSettingSlug) {
  return useQuery({
    queryKey: key(slug),
    queryFn: async () => {
      const res = await api.get<ProspectingSettingsResponse>(endpoint(slug));
      return res.data.items ?? [];
    },
  });
}

export function useCreateProspectingSetting(slug: ProspectingSettingSlug) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateProspectingSettingPayload) => {
      const res = await api.post<ProspectingSetting>(endpoint(slug), payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(slug) }),
  });
}

export function useUpdateProspectingSetting(slug: ProspectingSettingSlug) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateProspectingSettingPayload & { id: string }) => {
      const res = await api.patch<ProspectingSetting>(`${endpoint(slug)}/${id}`, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(slug) }),
  });
}

export function useDeleteProspectingSetting(slug: ProspectingSettingSlug) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete<ProspectingSetting>(`${endpoint(slug)}/${id}`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(slug) }),
  });
}
