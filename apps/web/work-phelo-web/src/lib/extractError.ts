import type { AxiosError } from 'axios';

type ApiErrorResponse = { message: string | string[] };

export function extractError(err: unknown, fallback = 'Something went wrong'): string {
  const axiosErr = err as AxiosError<ApiErrorResponse>;
  const msg = axiosErr?.response?.data?.message;
  if (Array.isArray(msg)) return msg[0] ?? fallback;
  if (typeof msg === 'string' && msg) return msg;
  if (axiosErr?.message) return axiosErr.message;
  return fallback;
}
