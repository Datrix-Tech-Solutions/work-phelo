import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  TenantDocumentRender,
  TenantDocumentTemplate,
  UpsertTenantDocumentTemplatePayload,
} from '@/types/tenant-document-template';

export const tenantDocumentTemplateKeys = {
  template: (tenantId: string) => ['tenant-document-template', tenantId] as const,
};

export function useTenantDocumentTemplate(tenantId?: string) {
  return useQuery({
    queryKey: tenantDocumentTemplateKeys.template(tenantId ?? ''),
    queryFn: () =>
      api
        .get<TenantDocumentTemplate>(`/auth/tenants/${tenantId}/document-template`)
        .then((response) => response.data),
    enabled: Boolean(tenantId),
    staleTime: 60_000,
  });
}

/** What a real document renders with — readable by accounting users, not only admins.
 *  Refetched on every use so a newly saved template applies straight away. */
export function useTenantDocumentRender(tenantId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: [...tenantDocumentTemplateKeys.template(tenantId ?? ''), 'render'],
    queryFn: () =>
      api
        .get<TenantDocumentRender>(`/auth/tenants/${tenantId}/document-render`)
        .then((response) => response.data),
    enabled: enabled && Boolean(tenantId),
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}

export function useSaveTenantDocumentTemplate(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpsertTenantDocumentTemplatePayload) =>
      api
        .put<TenantDocumentTemplate>(`/auth/tenants/${tenantId}/document-template`, payload)
        .then((response) => response.data),
    onSuccess: (template) => {
      queryClient.setQueryData(tenantDocumentTemplateKeys.template(tenantId), template);
    },
  });
}

export function useUploadTenantDocumentWatermark(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api
        .post<TenantDocumentTemplate>(
          `/auth/tenants/${tenantId}/document-template/watermark`,
          formData,
          { headers: { 'Content-Type': 'multipart/form-data' } },
        )
        .then((response) => response.data);
    },
    onSuccess: (template) => {
      queryClient.setQueryData(tenantDocumentTemplateKeys.template(tenantId), template);
    },
  });
}

export function useRemoveTenantDocumentWatermark(tenantId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      api
        .delete<TenantDocumentTemplate>(`/auth/tenants/${tenantId}/document-template/watermark`)
        .then((response) => response.data),
    onSuccess: (template) => {
      queryClient.setQueryData(tenantDocumentTemplateKeys.template(tenantId), template);
    },
  });
}
