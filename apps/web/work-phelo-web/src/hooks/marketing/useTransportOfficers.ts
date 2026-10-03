import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  TransportOfficer,
  TransportOfficerCandidate,
  TransportOfficerListResponse,
  TransportOfficersQuery,
  TransportOfficerToggleResult,
} from '@/types/marketing';

const ENDPOINT = '/marketing/transport-officers';
const OFFICERS_KEY = ['marketing', 'transport-officers'] as const;

export function useTransportOfficers(query: TransportOfficersQuery = {}) {
  return useQuery({
    queryKey: [...OFFICERS_KEY, 'list', query] as const,
    queryFn: async () => {
      const res = await api.get<TransportOfficerListResponse>(ENDPOINT, { params: query });
      return res.data;
    },
    placeholderData: (previous) => previous,
  });
}

export function useTransportOfficerCandidates(enabled = true) {
  return useQuery({
    queryKey: [...OFFICERS_KEY, 'candidates'] as const,
    queryFn: async () => {
      const res = await api.get<TransportOfficerCandidate[]>(`${ENDPOINT}/candidates`);
      return res.data;
    },
    enabled,
    staleTime: 0,
  });
}

/** Officers feed every driver dropdown, so changing them must refresh fleet and requests too. */
function useInvalidateOfficers() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: OFFICERS_KEY });
    queryClient.invalidateQueries({ queryKey: ['marketing', 'fleet'] });
    queryClient.invalidateQueries({ queryKey: ['marketing', 'requests'] });
  };
}

export function useAddTransportOfficers() {
  const invalidate = useInvalidateOfficers();
  return useMutation({
    mutationFn: async (employeeIds: string[]) => {
      const res = await api.post<TransportOfficer[]>(ENDPOINT, { employeeIds });
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useSetTransportOfficerActive() {
  const invalidate = useInvalidateOfficers();
  return useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const res = await api.post<TransportOfficerToggleResult>(
        `${ENDPOINT}/${id}/${active ? 'activate' : 'deactivate'}`,
      );
      return res.data;
    },
    onSuccess: invalidate,
  });
}
