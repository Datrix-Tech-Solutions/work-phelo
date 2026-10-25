import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useClientBillingTransactions } from '@/hooks/marketing/useClients';
import type { ProjectInvoice, RecordProjectInvoiceDto } from '@/types/hr';

const KEY = 'projects';
const VOIDED_STATES = ['REVERSED', 'REJECTED'];

/** A project's invoices, newest first, as recorded in the backend. */
function useProjectInvoiceList(projectId: string) {
  return useQuery({
    queryKey: [KEY, projectId, 'invoices'],
    queryFn: async () => {
      const res = await api.get<ProjectInvoice[]>(`/hr/projects/${projectId}/invoices`);
      return res.data;
    },
    enabled: !!projectId,
  });
}

/** Records an invoice already raised in Accounting. Recording the same id again changes nothing. */
export function useRecordProjectInvoice(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: RecordProjectInvoiceDto) => {
      const res = await api.post<ProjectInvoice>(`/hr/projects/${projectId}/invoices`, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY, projectId, 'invoices'] }),
  });
}

/** A project's invoices, and the ones still standing. An invoice voided in Accounting no longer counts as billed. */
export function useProjectInvoices(projectId: string) {
  const { data, isLoading } = useProjectInvoiceList(projectId);
  const invoices = useMemo(() => data ?? [], [data]);
  const clientId = invoices[0]?.clientId ?? '';
  const { data: transactions } = useClientBillingTransactions(clientId, 1, !!clientId);

  // Only the client's latest transactions are read, so an invoice not found there counts as standing.
  const active = useMemo<ProjectInvoice[]>(
    () =>
      invoices.filter((inv) => {
        const state = transactions?.items.find((t) => t.id === inv.transactionId)?.state;
        return !(state && VOIDED_STATES.includes(state.toUpperCase()));
      }),
    [invoices, transactions],
  );

  return { invoices, active, transactions, isLoading };
}
