import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  CreateFleetVehiclePayload,
  CreateFleetVehicleResult,
  FleetListResponse,
  FleetOptions,
  FleetQuery,
  FleetVehicle,
  UpdateFleetVehiclePayload,
} from '@/types/marketing';

const ENDPOINT = '/marketing/fleet';
const FLEET_KEY = ['marketing', 'fleet'] as const;

const withId = <T extends { assetId: string }>(vehicle: T) => ({ ...vehicle, id: vehicle.assetId });

export function useFleet(query: FleetQuery = {}) {
  return useQuery({
    queryKey: [...FLEET_KEY, query] as const,
    queryFn: async () => {
      const res = await api.get<FleetListResponse>(ENDPOINT, { params: query });
      return { ...res.data, data: res.data.data.map(withId) };
    },
    placeholderData: (previous) => previous,
    // Booked → on route → available changes with the clock, so keep it fresh.
    refetchInterval: 60_000,
  });
}

export function useFleetOptions() {
  return useQuery({
    queryKey: [...FLEET_KEY, 'options'] as const,
    queryFn: async () => {
      const res = await api.get<FleetOptions>(`${ENDPOINT}/options`);
      return res.data;
    },
  });
}

/** Vehicles are HR assets too, so fleet writes must also refresh the HR assets views. */
function useInvalidateFleet() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: FLEET_KEY });
    queryClient.invalidateQueries({ queryKey: ['assets'] });
  };
}

export function useCreateFleetVehicle() {
  const invalidate = useInvalidateFleet();
  return useMutation({
    mutationFn: async (payload: CreateFleetVehiclePayload) => {
      const res = await api.post<CreateFleetVehicleResult>(ENDPOINT, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useUpdateFleetVehicle() {
  const invalidate = useInvalidateFleet();
  return useMutation({
    mutationFn: async ({
      assetId,
      ...payload
    }: UpdateFleetVehiclePayload & { assetId: string }) => {
      const res = await api.patch<FleetVehicle>(`${ENDPOINT}/${assetId}`, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useSetFleetVehicleStatus() {
  const invalidate = useInvalidateFleet();
  return useMutation({
    mutationFn: async ({
      assetId,
      status,
    }: {
      assetId: string;
      status: 'AVAILABLE' | 'MAINTENANCE' | 'RETIRED';
    }) => {
      const res = await api.post<FleetVehicle>(`${ENDPOINT}/${assetId}/status`, { status });
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useAssignFleetDriver() {
  const invalidate = useInvalidateFleet();
  return useMutation({
    mutationFn: async ({ assetId, employeeId }: { assetId: string; employeeId: string }) => {
      const res = await api.post<FleetVehicle>(`${ENDPOINT}/${assetId}/driver`, { employeeId });
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useUnassignFleetDriver() {
  const invalidate = useInvalidateFleet();
  return useMutation({
    mutationFn: async (assetId: string) => {
      const res = await api.delete<FleetVehicle>(`${ENDPOINT}/${assetId}/driver`);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useRetireFleetVehicle() {
  const invalidate = useInvalidateFleet();
  return useMutation({
    mutationFn: async (assetId: string) => {
      await api.delete(`${ENDPOINT}/${assetId}`);
    },
    onSuccess: invalidate,
  });
}
