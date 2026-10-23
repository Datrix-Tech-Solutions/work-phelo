import type { Period } from '@/components/atoms/PeriodToggle';

/** What range the period filter draws, shown under a chart's title. */
export const SERIES_SUBTITLES: Record<Period, string> = {
  daily: 'This week',
  weekly: 'Weeks of this month',
  monthly: 'Last 6 months',
  quarterly: 'Quarters of this year',
  yearly: 'Last 6 years',
};

export const compactNumber = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
};

export const fullNumber = (value: number) =>
  value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
