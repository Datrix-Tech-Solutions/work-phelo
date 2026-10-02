import { AxiosError } from 'axios';

/** Pulls a user-facing message out of an API error, falling back to `fallback`. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof AxiosError) {
    if (error.response?.status === 403) return "You don't have permission to do that.";
    const message = error.response?.data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string') return message;
  }
  return fallback;
}
