/** Formats an amount with thousands separators and two decimals; blank/null shows a dash. */
export function formatMoney(value: string | number | null | undefined): string {
  if (value == null || value === '') return '—';
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
