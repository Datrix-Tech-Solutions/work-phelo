'use client';

import { useMemo, useState } from 'react';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useFiscalYear, useFiscalYears } from '@/hooks/accounting/useFiscalPeriods';

export type PeriodMode = 'custom' | 'fiscal-year' | 'fiscal-month';

const RANGE_MODE_OPTIONS: Array<{ value: PeriodMode; label: string }> = [
  { value: 'custom', label: 'Custom range' },
  { value: 'fiscal-year', label: 'Fiscal year' },
  { value: 'fiscal-month', label: 'Fiscal month' },
];

const AS_AT_MODE_OPTIONS: Array<{ value: PeriodMode; label: string }> = [
  { value: 'custom', label: 'Custom date' },
  { value: 'fiscal-year', label: 'End of fiscal year' },
  { value: 'fiscal-month', label: 'End of fiscal month' },
];

const isoDate = (value: string) => value.slice(0, 10);
const today = () => new Date().toISOString().slice(0, 10);
const startOfYear = () => `${new Date().getFullYear()}-01-01`;

/** The item covering today, else the first — so a fiscal pick has a sensible default. */
function containingToday<T extends { startDate: string; endDate: string }>(items: T[]) {
  const now = today();
  return (
    items.find((item) => isoDate(item.startDate) <= now && now <= isoDate(item.endDate)) ?? items[0]
  );
}

/**
 * Period selection for date-range reports: a custom range (the default), a whole fiscal year,
 * or a single fiscal month. Whichever is chosen resolves to a plain `range` of ISO dates,
 * or null while the selection isn't usable yet.
 *
 * With `asAt`, the report is a point in time rather than a span: a custom pick is one date and
 * the fiscal picks mean the end of that year or month. `asOfDate` is that date.
 */
export function useReportPeriod({ asAt = false }: { asAt?: boolean } = {}) {
  const [mode, setMode] = useState<PeriodMode>('custom');
  const [fromDate, setFromDate] = useState(startOfYear);
  const [toDate, setToDate] = useState(today);
  const [yearId, setYearId] = useState('');
  const [periodId, setPeriodId] = useState('');

  const { data: yearsData, isLoading: yearsLoading } = useFiscalYears();
  const years = useMemo(
    () => [...(yearsData ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [yearsData],
  );
  const year = years.find((entry) => entry.id === yearId) ?? containingToday(years);

  const yearDetail = useFiscalYear(mode === 'fiscal-month' ? year?.id : undefined);
  const periods = useMemo(() => yearDetail.data?.periods ?? [], [yearDetail.data]);
  // A period id left over from another year isn't in this list, so it falls back to the default.
  const period = periods.find((entry) => entry.id === periodId) ?? containingToday(periods);

  // The fiscal period just before the selection (years are newest-first, periods in calendar
  // order). The first month of a year looks back to the last month of the year before it.
  const toRange = (entry: { startDate: string; endDate: string }) => ({
    fromDate: isoDate(entry.startDate),
    toDate: isoDate(entry.endDate),
  });
  const yearIndex = year ? years.findIndex((entry) => entry.id === year.id) : -1;
  const olderYear = yearIndex >= 0 ? years[yearIndex + 1] : undefined;
  const periodIndex = period ? periods.findIndex((entry) => entry.id === period.id) : -1;
  const lookBackAYear = mode === 'fiscal-month' && periodIndex === 0 && !!olderYear;
  const olderYearDetail = useFiscalYear(lookBackAYear ? olderYear?.id : undefined);

  let previousPeriod: { fromDate: string; toDate: string } | null = null;
  let previousPending = false;
  if (mode === 'fiscal-year' && olderYear) {
    previousPeriod = toRange(olderYear);
  } else if (mode === 'fiscal-month' && periodIndex > 0) {
    previousPeriod = toRange(periods[periodIndex - 1]);
  } else if (lookBackAYear) {
    const olderPeriods = olderYearDetail.data?.periods ?? [];
    if (olderPeriods.length > 0) previousPeriod = toRange(olderPeriods[olderPeriods.length - 1]);
    else previousPending = olderYearDetail.isLoading;
  }

  let range: { fromDate: string; toDate: string } | null = null;
  let label: string | null = null;
  if (mode === 'custom') {
    range = asAt ? { fromDate: toDate, toDate } : fromDate <= toDate ? { fromDate, toDate } : null;
  } else if (mode === 'fiscal-year' && year) {
    range = { fromDate: isoDate(year.startDate), toDate: isoDate(year.endDate) };
    label = `${asAt ? 'End of fiscal year' : 'Fiscal year'} ${year.name}`;
  } else if (mode === 'fiscal-month' && period) {
    range = { fromDate: isoDate(period.startDate), toDate: isoDate(period.endDate) };
    label = `${asAt ? 'End of fiscal month' : 'Fiscal month'} ${period.name}`;
  }

  return {
    mode,
    setMode,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    years,
    year,
    setYearId,
    periods,
    period,
    setPeriodId,
    range,
    /** The as-at date: the end of the resolved range. Null while the selection isn't usable. */
    asOfDate: range ? range.toDate : null,
    asAt,
    yearsLoading,
    label,
    /** Null for a custom range, or when there is no earlier fiscal period to compare to. */
    previousPeriod,
    /** True while the earlier year's periods are still loading. */
    previousPending,
  };
}

export type ReportPeriod = ReturnType<typeof useReportPeriod>;

/** Renders inside a flex-wrap filter bar; each field is its own flex item. */
export function ReportPeriodFields({ period }: { period: ReportPeriod }) {
  const { mode, years, year, periods, period: selectedPeriod } = period;

  return (
    <>
      <div className="w-44">
        <SearchSelect
          label="Period"
          placeholder="Period"
          options={period.asAt ? AS_AT_MODE_OPTIONS : RANGE_MODE_OPTIONS}
          value={mode}
          onChange={(value) => period.setMode(value as PeriodMode)}
          clearable={false}
        />
      </div>

      {mode === 'custom' && period.asAt && (
        <div className="w-44">
          <DatePicker label="As at" value={period.toDate} onChange={period.setToDate} />
        </div>
      )}

      {mode === 'custom' && !period.asAt && (
        <>
          <div className="w-44">
            <DatePicker
              label="From"
              value={period.fromDate}
              onChange={period.setFromDate}
              maxDate={period.toDate}
            />
          </div>
          <div className="w-44">
            <DatePicker
              label="To"
              value={period.toDate}
              onChange={period.setToDate}
              minDate={period.fromDate}
            />
          </div>
        </>
      )}

      {mode !== 'custom' && (
        <div className="w-44">
          <SearchSelect
            label="Fiscal year"
            placeholder={years.length ? 'Fiscal year' : 'No fiscal years set up'}
            options={years.map((entry) => ({ value: entry.id, label: entry.name }))}
            value={year?.id ?? ''}
            onChange={period.setYearId}
            clearable={false}
          />
        </div>
      )}

      {mode === 'fiscal-month' && (
        <div className="w-48">
          <SearchSelect
            label="Fiscal month"
            placeholder={periods.length ? 'Fiscal month' : 'No periods'}
            options={periods.map((entry) => ({ value: entry.id, label: entry.name }))}
            value={selectedPeriod?.id ?? ''}
            onChange={period.setPeriodId}
            clearable={false}
          />
        </div>
      )}
    </>
  );
}
