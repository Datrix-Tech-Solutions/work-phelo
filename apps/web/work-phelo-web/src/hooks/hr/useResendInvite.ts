import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface Options {
  onSuccess?: () => void;
  onError?: (err: unknown) => void;
}

export function useResendInvite(userId: string | null | undefined, options?: Options) {
  return useMutation({
    mutationFn: () => api.post(`/auth/users/${userId}/resend-invite`),
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}
