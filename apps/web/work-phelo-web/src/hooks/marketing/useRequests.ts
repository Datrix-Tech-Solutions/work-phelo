import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  ApproveTransportRequestPayload,
  DestinationOption,
  CompleteTransportRequestPayload,
  StartTransportRequestPayload,
  TransportRequestStartOptions,
  CreateTransportRequestPayload,
  TransportRequest,
  TransportRequestAllocationOptions,
  RescheduleTransportRequestPayload,
  TransportRequestFormOptions,
  TransportRequestWindow,
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

/** One request by id — used when a notification links straight to it. */
export function useRequest(id: string | undefined) {
  return useQuery({
    queryKey: [...REQUESTS_KEY, 'detail', id] as const,
    queryFn: async () => {
      const res = await api.get<TransportRequest>(`${ENDPOINT}/${id}`);
      return res.data;
    },
    enabled: !!id,
    retry: false,
  });
}

/** Clients and prospects the person can choose as destinations, matching `search`. */
export function useDestinationOptions(search: string, enabled = true) {
  return useQuery({
    queryKey: [...REQUESTS_KEY, 'destination-options', search] as const,
    queryFn: async () => {
      const res = await api.get<{ data: DestinationOption[] }>(`${ENDPOINT}/destination-options`, {
        params: search.trim() ? { search: search.trim() } : undefined,
      });
      return res.data.data;
    },
    enabled,
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

/** `window` checks a different date and times (rescheduling); omit it to use the request's own. */
export function useRequestAllocationOptions(
  id: string | undefined,
  enabled = true,
  window?: TransportRequestWindow,
) {
  return useQuery({
    queryKey: [...REQUESTS_KEY, 'allocation-options', id, window ?? null] as const,
    queryFn: async () => {
      const res = await api.get<TransportRequestAllocationOptions>(
        `${ENDPOINT}/${id}/allocation-options`,
        { params: window },
      );
      return res.data;
    },
    enabled: enabled && !!id,
    // Availability changes as other requests get approved, so don't serve stale answers.
    staleTime: 0,
    placeholderData: (previous) => previous,
  });
}

/** Requests drive vehicle and driver status (booked / on route), so their lists refresh too. */
function useInvalidateRequests() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: REQUESTS_KEY });
    queryClient.invalidateQueries({ queryKey: ['marketing', 'fleet'] });
    queryClient.invalidateQueries({ queryKey: ['marketing', 'transport-officers'] });
    // A completed trip joins its vehicle's and driver's history.
    queryClient.invalidateQueries({ queryKey: ['marketing', 'trip-history'] });
  };
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

export function useRescheduleRequest() {
  const invalidate = useInvalidateRequests();
  return useMutation({
    mutationFn: async ({ id, ...payload }: RescheduleTransportRequestPayload & { id: string }) => {
      const res = await api.post<TransportRequest>(`${ENDPOINT}/${id}/reschedule`, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

/** Prefill for the start form; fetched fresh each time it opens. */
export function useStartOptions(id: string | undefined) {
  return useQuery({
    queryKey: [...REQUESTS_KEY, 'start-options', id] as const,
    queryFn: async () => {
      const res = await api.get<TransportRequestStartOptions>(`${ENDPOINT}/${id}/start-options`);
      return res.data;
    },
    enabled: !!id,
    gcTime: 0,
  });
}

export function useStartRequest() {
  const invalidate = useInvalidateRequests();
  return useMutation({
    mutationFn: async ({ id, ...payload }: StartTransportRequestPayload & { id: string }) => {
      const res = await api.post<TransportRequest>(`${ENDPOINT}/${id}/start`, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useCompleteRequest() {
  const invalidate = useInvalidateRequests();
  return useMutation({
    mutationFn: async ({ id, ...payload }: CompleteTransportRequestPayload & { id: string }) => {
      const res = await api.post<TransportRequest>(`${ENDPOINT}/${id}/complete`, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}
