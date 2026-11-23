import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  ProjectClient,
  ProjectInvoice,
  ProjectInvoiceBillingOptions,
  RaiseProjectInvoiceDto,
} from '@/types/hr';

const CLIENTS_KEY = ['projects', 'clients'] as const;

/** The clients made from project management, optionally narrowed by part of the name. */
export function useProjectClients(search = '', enabled = true) {
  return useQuery({
    enabled,
    queryKey: [...CLIENTS_KEY, search] as const,
    queryFn: async () => {
      const res = await api.get<ProjectClient[]>('/hr/projects/clients', {
        params: search ? { search } : undefined,
      });
      return res.data;
    },
    placeholderData: (previous) => previous,
  });
}

/** Adds a client by name. A name already there gives back that client, never a second one. */
export function useCreateProjectClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const res = await api.post<ProjectClient>('/hr/projects/clients', { name });
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CLIENTS_KEY }),
  });
}

/** What the invoice form offers for a project client's project, and whether Accounting is set up. */
export function useProjectInvoiceBillingOptions(projectId: string, enabled = true) {
  return useQuery({
    enabled: enabled && !!projectId,
    queryKey: ['projects', projectId, 'invoice-options'] as const,
    queryFn: async () => {
      const res = await api.get<ProjectInvoiceBillingOptions>(
        `/hr/projects/${projectId}/invoices/options`,
      );
      return res.data;
    },
    staleTime: 30_000,
    retry: false,
  });
}

/** Raises an invoice for a project client straight to Accounting. Sending the same id again changes nothing. */
export function useRaiseProjectInvoice(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RaiseProjectInvoiceDto) => {
      const res = await api.post<ProjectInvoice>(
        `/hr/projects/${projectId}/invoices/raise`,
        payload,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'invoices'] });
      // The client now has an entity, so the entity type is locked from here on.
      queryClient.invalidateQueries({ queryKey: ['projects', projectId, 'invoice-options'] });
    },
  });
}
