import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  Appointment,
  AppointmentFormOptions,
  AppointmentListResponse,
  AppointmentsQuery,
  ApproveAppointmentPayload,
  CreateAppointmentPayload,
} from '@/types/marketing';

const ENDPOINT = '/marketing/appointments';
const APPOINTMENTS_KEY = ['marketing', 'appointments'] as const;

export function useAppointments(query: AppointmentsQuery = {}) {
  const { status, ...rest } = query;
  return useQuery({
    queryKey: [...APPOINTMENTS_KEY, 'list', query] as const,
    queryFn: async () => {
      const res = await api.get<AppointmentListResponse>(ENDPOINT, {
        params: { ...rest, ...(status?.length ? { status: status.join(',') } : {}) },
      });
      return res.data.data;
    },
    placeholderData: (previous) => previous,
  });
}

/** One appointment by id — used when a notification links straight to it. */
export function useAppointment(id: string | undefined) {
  return useQuery({
    queryKey: [...APPOINTMENTS_KEY, 'detail', id] as const,
    queryFn: async () => {
      const res = await api.get<Appointment>(`${ENDPOINT}/${id}`);
      return res.data;
    },
    enabled: !!id,
    retry: false,
  });
}

/** What the form may offer: who can be the marketer, and that marketer's prospects. */
export function useAppointmentFormOptions(
  query: { marketerUserId?: string; search?: string } = {},
  enabled = true,
) {
  return useQuery({
    queryKey: [...APPOINTMENTS_KEY, 'form-options', query] as const,
    queryFn: async () => {
      const res = await api.get<AppointmentFormOptions>(`${ENDPOINT}/form-options`, {
        params: {
          ...(query.marketerUserId ? { marketerUserId: query.marketerUserId } : {}),
          ...(query.search ? { search: query.search } : {}),
        },
      });
      return res.data;
    },
    enabled,
    placeholderData: (previous) => previous,
  });
}

function useInvalidateAppointments() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: APPOINTMENTS_KEY });
}

export function useCreateAppointment() {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: async (payload: CreateAppointmentPayload) => {
      const res = await api.post<Appointment>(ENDPOINT, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useApproveAppointment() {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: async ({ id, ...payload }: ApproveAppointmentPayload & { id: string }) => {
      const res = await api.post<Appointment>(`${ENDPOINT}/${id}/approve`, payload);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useRejectAppointment() {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: async ({ id, reviewNote }: { id: string; reviewNote?: string }) => {
      const res = await api.post<Appointment>(`${ENDPOINT}/${id}/reject`, {
        ...(reviewNote ? { reviewNote } : {}),
      });
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useCancelAppointment() {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<Appointment>(`${ENDPOINT}/${id}/cancel`);
      return res.data;
    },
    onSuccess: invalidate,
  });
}

export function useCompleteAppointment() {
  const invalidate = useInvalidateAppointments();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<Appointment>(`${ENDPOINT}/${id}/complete`);
      return res.data;
    },
    onSuccess: invalidate,
  });
}
