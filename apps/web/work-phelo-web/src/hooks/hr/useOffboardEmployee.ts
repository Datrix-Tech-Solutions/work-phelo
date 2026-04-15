import { api } from '@/lib/api';
import { OffboardPayload } from '@/types/hr';
import { useMutation, useQueryClient } from '@tanstack/react-query';

interface Options {
  onSuccess?: () => void;
  onError?: (err: unknown) => void;
}

export function useOffboardEmployee(options?: Options) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ employeeId, offboardedAt, reason }: OffboardPayload) =>
      api.patch(`/hr/employees/${employeeId}/offboard`, { offboardedAt, reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-all'] });
      options?.onSuccess?.();
    },
    onError: options?.onError,
  });
}
