import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  ReportBlock,
  ReportCatalog,
  ReportPeriod,
  ReportResult,
  ReportSpec,
  ReportType,
  SavedReport,
  SavedReportSummary,
} from '@/types/reports';

export function useReportCatalog() {
  return useQuery({
    queryKey: ['reports', 'catalog'],
    queryFn: async () => {
      const res = await api.get<ReportCatalog>('/hr/reports/catalog');
      return res.data;
    },
    staleTime: 5 * 60_000,
  });
}

/** Runs one block. Each block of a report loads and fails on its own. */
export function useRunReportBlock(
  type: ReportType,
  block: ReportBlock,
  period: ReportPeriod,
  paging?: { page: number; pageSize: number },
) {
  return useQuery({
    queryKey: ['reports', 'run', type, block, period, paging] as const,
    queryFn: async () => {
      const res = await api.post<ReportResult>('/hr/reports/run', {
        type,
        block,
        period: period.from || period.to ? period : undefined,
        ...paging,
      });
      return res.data;
    },
    placeholderData: (previous) => previous,
    retry: false,
  });
}

export function useSavedReports() {
  return useQuery({
    queryKey: ['reports', 'saved'],
    queryFn: async () => {
      const res = await api.get<SavedReportSummary[]>('/hr/reports/saved');
      return res.data;
    },
  });
}

export async function fetchSavedReport(id: string) {
  const res = await api.get<SavedReport>(`/hr/reports/saved/${id}`);
  return res.data;
}

interface SavePayload {
  name: string;
  description?: string;
  spec: ReportSpec;
}

const toBody = ({ name, description, spec }: SavePayload) => ({
  name,
  description,
  type: spec.type,
  period: spec.period.from || spec.period.to ? spec.period : undefined,
  blocks: spec.blocks,
});

export function useSaveReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: SavePayload) => {
      const res = await api.post<SavedReport>('/hr/reports/saved', toBody(payload));
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reports', 'saved'] }),
  });
}

export function useUpdateSavedReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: SavePayload & { id: string }) => {
      const res = await api.patch<SavedReport>(`/hr/reports/saved/${id}`, toBody(payload));
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reports', 'saved'] }),
  });
}

export function useDeleteSavedReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/hr/reports/saved/${id}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reports', 'saved'] }),
  });
}
