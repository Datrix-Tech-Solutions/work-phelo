import { useState } from 'react';
import type { Period } from '@/components/atoms/PeriodToggle';
import type { DashboardView } from '@/components/atoms/DashboardViewToggle';

export interface DashboardFilters {
  period: Period;
  setPeriod: (value: Period) => void;
  year: number;
  setYear: (value: number) => void;
  /** Values of the module's extra search-select filters, keyed by field `key`
   * (e.g. `fieldValues.currency`). Empty string means "no filter". */
  fieldValues: Record<string, string>;
  setFieldValue: (key: string, value: string) => void;
  view: DashboardView;
  setView: (value: DashboardView) => void;
}

/** Filter state shared by every module dashboard: period, year (used when period is yearly),
 * the values of whatever extra filter fields the module declares, and the general/detailed
 * view. Pass the result to `DashboardShell` and to the cards inside it. */
export function useDashboardFilters(
  initial: { period?: Period; view?: DashboardView } = {},
): DashboardFilters {
  const [period, setPeriod] = useState<Period>(initial.period ?? 'monthly');
  const [year, setYear] = useState(new Date().getFullYear());
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [view, setView] = useState<DashboardView>(initial.view ?? 'general');

  const setFieldValue = (key: string, value: string) =>
    setFieldValues((prev) => ({ ...prev, [key]: value }));

  return { period, setPeriod, year, setYear, fieldValues, setFieldValue, view, setView };
}
