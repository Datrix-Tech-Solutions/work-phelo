import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CreatePipelineStagePayload,
  PipelineStage,
  PipelineStagesResponse,
  UpdatePipelineStagePayload,
} from '@/types/marketing';

const PIPELINE_STAGES_KEY = ['marketing', 'crm-settings', 'pipeline-stages'] as const;
const ENDPOINT = '/marketing/crm-settings/pipeline-stages';

export function usePipelineStages() {
  return useQuery({
    queryKey: PIPELINE_STAGES_KEY,
    queryFn: async () => {
      const res = await api.get<PipelineStagesResponse>(ENDPOINT);
      return res.data.items ?? [];
    },
  });
}

export function useCreatePipelineStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreatePipelineStagePayload) => {
      const res = await api.post<PipelineStage>(ENDPOINT, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PIPELINE_STAGES_KEY }),
  });
}

export function useUpdatePipelineStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdatePipelineStagePayload & { id: string }) => {
      const res = await api.patch<PipelineStage>(`${ENDPOINT}/${id}`, payload);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PIPELINE_STAGES_KEY }),
  });
}

export function useDeletePipelineStage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete<PipelineStage>(`${ENDPOINT}/${id}`);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PIPELINE_STAGES_KEY }),
  });
}

export interface PipelineStageOrderChange {
  id: string;
  displayOrder: number;
}

export function useReorderPipelineStages() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (changes: PipelineStageOrderChange[]) => {
      await Promise.all(
        changes.map(({ id, displayOrder }) => api.patch(`${ENDPOINT}/${id}`, { displayOrder })),
      );
    },
    onMutate: async (changes) => {
      await queryClient.cancelQueries({ queryKey: PIPELINE_STAGES_KEY });
      const previous = queryClient.getQueryData<PipelineStage[]>(PIPELINE_STAGES_KEY);
      if (previous) {
        const order = new Map(changes.map((c) => [c.id, c.displayOrder]));
        queryClient.setQueryData<PipelineStage[]>(
          PIPELINE_STAGES_KEY,
          previous
            .map((s) => ({ ...s, displayOrder: order.get(s.id) ?? s.displayOrder }))
            .sort((a, b) => a.displayOrder - b.displayOrder),
        );
      }
      return { previous };
    },
    onError: (_err, _changes, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(PIPELINE_STAGES_KEY, ctx.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: PIPELINE_STAGES_KEY }),
  });
}
