import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ShiftSchedule, CreateShiftSchedulePayload } from '@/types/scheduling';
import { extractError } from '@/lib/extractError';
import { useToastStore } from '@/store/toast.store';

export function useShiftSchedules(employeeId?: string) {
  return useQuery({
    queryKey: ['schedules', employeeId ?? 'all'],
    queryFn: async () => {
      const res = await api.get<ShiftSchedule[]>('/hr/time/schedules', {
        params: employeeId ? { employeeId } : undefined,
      });
      return res.data ?? [];
    },
  });
}

export function useMyShiftSchedules() {
  return useQuery({
    queryKey: ['schedules', 'me'],
    queryFn: async () => {
      const res = await api.get<ShiftSchedule[]>('/hr/time/schedules');
      return res.data ?? [];
    },
  });
}

export function useCreateShiftSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateShiftSchedulePayload) => {
      const res = await api.post<ShiftSchedule>('/hr/time/schedules', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
    },
    onError: (error) => {
      useToastStore.getState().addToast({ message: extractError(error), type: 'error' });
    },
  });
}
