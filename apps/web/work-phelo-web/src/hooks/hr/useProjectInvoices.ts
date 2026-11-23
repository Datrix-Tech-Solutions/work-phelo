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

const STATE_LABELS: Record<string, string> = {
  DRAFT: 'Sent',
  POSTED: 'Posted',
  REVERSED: 'Reversed',
  REJECTED: 'Rejected',
};

/** An invoice's state and what to call it, and its document number once Accounting has one. */
export interface ProjectInvoiceStatus {
  state: string;
  stateLabel: string;
  documentNumber: string | null;
}

/**
 * A project's invoices, and the ones still standing. An invoice voided in Accounting no longer counts
 * as billed. A project client's invoice carries the state Accounting reported to us; a marketing
 * client's is read back through marketing.
 */
export function useProjectInvoices(projectId: string) {
  const { data, isLoading } = useProjectInvoiceList(projectId);
  const invoices = useMemo(() => data ?? [], [data]);
  const marketingInvoice = invoices.find((inv) => !inv.state);
  const clientId = marketingInvoice?.clientId ?? '';
  const { data: transactions } = useClientBillingTransactions(clientId, 1, !!clientId);

  const statusOf = useMemo(
    () =>
      (inv: ProjectInvoice): ProjectInvoiceStatus | undefined => {
        if (inv.state) {
          return {
            state: inv.state,
            stateLabel: STATE_LABELS[inv.state.toUpperCase()] ?? inv.state,
            documentNumber: null,
          };
        }
        const tx = transactions?.items.find((t) => t.id === inv.transactionId);
        return tx
          ? { state: tx.state, stateLabel: tx.stateLabel, documentNumber: tx.documentNumber }
          : undefined;
      },
    [transactions],
  );

  // A marketing client's invoices are only looked up among the client's latest transactions, so one
  // not found there counts as standing.
  const active = useMemo<ProjectInvoice[]>(
    () =>
      invoices.filter((inv) => {
        const state = statusOf(inv)?.state;
        return !(state && VOIDED_STATES.includes(state.toUpperCase()));
      }),
    [invoices, statusOf],
  );

  return { invoices, active, statusOf, isLoading };
}
