/** Converts an ISO timestamp to the `datetime-local` input value in the viewer's local time. */
export function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

/** Formats an ISO timestamp for display, e.g. "25 Aug 2026, 14:30". */
export function fmtExchangeRateDate(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
