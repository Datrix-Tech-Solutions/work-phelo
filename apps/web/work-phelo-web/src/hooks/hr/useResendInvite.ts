import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Options {
  onSuccess?: () => void;
  onError?: (err: unknown) => void;
}

export function useResendInvite(employeeId: string | null | undefined, options?: Options) {
  return useMutation({
    mutationFn: () => api.post(`/hr/employees/${employeeId}/resend-invite`),
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}
