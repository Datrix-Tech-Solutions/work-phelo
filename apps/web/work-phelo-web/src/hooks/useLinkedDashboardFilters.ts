import { useSearchParams } from 'next/navigation';
import type { Period } from '@/components/atoms/PeriodToggle';
import { useDashboardFilters } from '@/hooks/useDashboardFilters';

const PERIODS: readonly Period[] = ['daily', 'weekly', 'monthly', 'quarterly', 'yearly'];

/**
 * Filter state for a page opened from a dashboard: it starts on the period, year and any named
 * extra filters carried in the link (`?period=…&year=…&rep=…`).
 */
export function useLinkedDashboardFilters(fieldKeys: string[] = []) {
  const searchParams = useSearchParams();
  const period = searchParams.get('period') as Period | null;

  return useDashboardFilters({
    period: period && PERIODS.includes(period) ? period : undefined,
    year: Number(searchParams.get('year')) || undefined,
    fieldValues: Object.fromEntries(fieldKeys.map((key) => [key, searchParams.get(key) ?? ''])),
  });
}
