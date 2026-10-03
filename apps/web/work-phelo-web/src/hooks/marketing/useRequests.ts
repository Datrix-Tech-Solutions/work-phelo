import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  ApproveTransportRequestPayload,
  CreateTransportRequestPayload,
  TransportRequest,
  TransportRequestAllocationOptions,
  TransportRequestFormOptions,
  TransportRequestListResponse,
  TransportRequestsQuery,
  UpdateTransportRequestPayload,
} from '@/types/marketing';

const ENDPOINT = '/marketing/requests';
const REQUESTS_KEY = ['marketing', 'requests'] as const;

export function useRequests(query: TransportRequestsQuery = {}) {
  const { status, ...rest } = query;
  return useQuery({
    queryKey: [...REQUESTS_KEY, query] as const,
    queryFn: async () => {
      const res = await api.get<TransportRequestListResponse>(ENDPOINT, {
        params: { ...rest, ...(status?.length ? { status: status.join(',') } : {}) },
      });
      return res.data;
    },
    placeholderData: (previous) => previous,
  });
}

export function useRequestFormOptions(enabled = true) {
  return useQuery({
    queryKey: [...REQUESTS_KEY, 'form-options'] as const,
    queryFn: async () => {
      const res = await api.get<TransportRequestFormOptions>(`${ENDPOINT}/form-options`);
      return res.data;
    },
    enabled,
  });
}

export function useRequestAllocationOptions(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: [...REQUESTS_KEY, 'allocation-options', id] as const,
    queryFn: async () => {
      const res = await api.get<TransportRequestAllocationOptions>(
        `${ENDPOINT}/${id}/allocation-options`,
      );
      return res.data;
    },
    enabled: enabled && !!id,
    // Availability changes as other requests get approved, so don't serve stale answers.
    staleTime: 0,
  });
}

function useInvalidateRequests() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: REQUESTS_KEY });
}

export function useCreateRequest() {
  const invalidate = useInvalidateRequests();
  return useMutation({
    mutationFn: async (payload: CreateTransportRequestPayload) => {
      const res = await api.post<TransportRequest>(ENDPOINT, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateRequest() {
  const invalidate = useInvalidateRequests();
  return useMutation({
    mutationFn: async ({ id, ...payload }: UpdateTransportRequestPayload & { id: string }) => {
      const res = await api.patch<TransportRequest>(`${ENDPOINT}/${id}`, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useCancelRequest() {
  const invalidate = useInvalidateRequests();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<TransportRequest>(`${ENDPOINT}/${id}/cancel`);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useApproveRequest() {
  const invalidate = useInvalidateRequests();
  return useMutation({
    mutationFn: async ({ id, ...payload }: ApproveTransportRequestPayload & { id: string }) => {
      const res = await api.post<TransportRequest>(`${ENDPOINT}/${id}/approve`, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useRejectRequest() {
  const invalidate = useInvalidateRequests();
  return useMutation({
    mutationFn: async ({ id, note }: { id: string; note?: string }) => {
      const res = await api.post<TransportRequest>(`${ENDPOINT}/${id}/reject`, {
        ...(note ? { note } : {}),
      });
      return res.data;
    },
    onSuccess: invalidate,
  });
}
