export type SeriesPeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface SeriesBucket {
  /** Short axis label, e.g. "Mon", "Wk 2", "Oct", "Q1", "FY2026". */
  label: string;
  /** Longer label for the tooltip, e.g. "Mon 6 Oct 2026". */
  detail: string;
  /** YYYY-MM-DD, inclusive. */
  fromDate: string;
  toDate: string;
}

export interface FiscalYearSpan {
  name: string;
  startDate: string;
  endDate: string;
}

export interface SeriesOptions {
  /** Defaults to now. */
  today?: Date;
  /** Plain calendar quarters and years, labelled "2026" rather than "FY2026". For modules with no fiscal year. */
  calendar?: boolean;
  /** 1-12, from the accounting configuration. Used when no fiscal year record covers a date. */
  fiscalYearStartMonth?: number;
  fiscalYears?: FiscalYearSpan[];
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n: number) => String(n).padStart(2, '0');
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (value: string) => {
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
const endOfMonth = (y: number, m: number) => new Date(y, m + 1, 0);
const dayMonth = (d: Date) => `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`;
const fullDate = (d: Date) => `${dayMonth(d)} ${d.getFullYear()}`;
const range = (from: Date, to: Date) =>
  from.getTime() === to.getTime() ? fullDate(from) : `${dayMonth(from)} – ${fullDate(to)}`;

/** Monday = 0 … Sunday = 6. */
const mondayOffset = (d: Date) => (d.getDay() + 6) % 7;

/** Mon–Sun of the current week. */
function dailyBuckets(today: Date): SeriesBucket[] {
  const monday = addDays(today, -mondayOffset(today));
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i);
    return {
      label: SHORT_DAYS[day.getDay()],
      detail: `${SHORT_DAYS[day.getDay()]} ${fullDate(day)}`,
      fromDate: iso(day),
      toDate: iso(day),
    };
  });
}

/** The weeks (Monday to Sunday) of the current month; the first and last are cut to the month. */
function weeklyBuckets(today: Date): SeriesBucket[] {
  const monthEnd = endOfMonth(today.getFullYear(), today.getMonth());
  const buckets: SeriesBucket[] = [];
  let start = new Date(today.getFullYear(), today.getMonth(), 1);
  while (start <= monthEnd) {
    const sunday = addDays(start, 6 - mondayOffset(start));
    const end = sunday < monthEnd ? sunday : monthEnd;
    buckets.push({
      label: `Wk ${buckets.length + 1}`,
      detail: range(start, end),
      fromDate: iso(start),
      toDate: iso(end),
    });
    start = addDays(end, 1);
  }
  return buckets;
}

/** The current month and the five before it. */
function monthlyBuckets(today: Date): SeriesBucket[] {
  return Array.from({ length: 6 }, (_, i) => {
    const first = new Date(today.getFullYear(), today.getMonth() - (5 - i), 1);
    const last = endOfMonth(first.getFullYear(), first.getMonth());
    const month = SHORT_MONTHS[first.getMonth()];
    return {
      label:
        first.getFullYear() === today.getFullYear()
          ? month
          : `${month} ${pad(first.getFullYear() % 100)}`,
      detail: `${month} ${first.getFullYear()}`,
      fromDate: iso(first),
      toDate: iso(last),
    };
  });
}

/**
 * The fiscal year containing `today`: the matching record if there is one, otherwise a twelve
 * month year starting in the configured start month.
 */
export function currentFiscalYear(
  today: Date,
  fiscalYears: FiscalYearSpan[] = [],
  startMonth = 1,
): { start: Date; end: Date; name: string } {
  const todayIso = iso(today);
  const record = fiscalYears.find(
    (year) => year.startDate.slice(0, 10) <= todayIso && todayIso <= year.endDate.slice(0, 10),
  );
  if (record) {
    return { start: parse(record.startDate), end: parse(record.endDate), name: record.name };
  }
  const startYear =
    today.getMonth() + 1 >= startMonth ? today.getFullYear() : today.getFullYear() - 1;
  const start = new Date(startYear, startMonth - 1, 1);
  return { start, end: addDays(addMonths(start, 12), -1), name: fiscalYearName(start) };
}

/** "FY2026" for a calendar-year fiscal year, "FY2025/26" when it starts mid-year. */
function fiscalYearName(start: Date) {
  const y = start.getFullYear();
  return start.getMonth() === 0 ? `FY${y}` : `FY${y}/${pad((y + 1) % 100)}`;
}

/** The year the quarterly and yearly views are built on: fiscal, or the plain calendar year. */
function resolveYear(today: Date, options: SeriesOptions) {
  return options.calendar
    ? currentFiscalYear(today, [], 1)
    : currentFiscalYear(today, options.fiscalYears, options.fiscalYearStartMonth);
}

/** The four quarters of the current fiscal (or calendar) year; a short last quarter is cut to the year's end. */
function quarterlyBuckets(today: Date, options: SeriesOptions): SeriesBucket[] {
  const { start, end } = resolveYear(today, options);
  const buckets: SeriesBucket[] = [];
  for (let q = 0; q < 4; q += 1) {
    const from = addMonths(start, q * 3);
    if (from > end) break;
    const natural = addDays(addMonths(start, q * 3 + 3), -1);
    const to = natural < end ? natural : end;
    buckets.push({
      label: `Q${q + 1}`,
      detail: range(from, to),
      fromDate: iso(from),
      toDate: iso(to),
    });
  }
  return buckets;
}

/** The current fiscal (or calendar) year and the five before it. */
function yearlyBuckets(today: Date, options: SeriesOptions): SeriesBucket[] {
  const current = resolveYear(today, options);
  return Array.from({ length: 6 }, (_, i) => {
    const back = 5 - i;
    const start = addMonths(current.start, -12 * back);
    const record = options.calendar
      ? undefined
      : options.fiscalYears?.find((year) => year.startDate.slice(0, 10) === iso(start));
    const end =
      back === 0 ? current.end : record ? parse(record.endDate) : addDays(addMonths(start, 12), -1);
    const fiscalName = back === 0 ? current.name : (record?.name ?? fiscalYearName(start));
    const name = options.calendar ? String(start.getFullYear()) : fiscalName;
    return {
      label: name,
      detail: `${name} (${range(start, end)})`,
      fromDate: iso(start),
      toDate: iso(end),
    };
  });
}

/** The ranges a period-filtered dashboard chart plots for each period. */
export function periodSeriesBuckets(
  period: SeriesPeriod,
  options: SeriesOptions = {},
): SeriesBucket[] {
  const today = options.today ?? new Date();
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  switch (period) {
    case 'daily':
      return dailyBuckets(day);
    case 'weekly':
      return weeklyBuckets(day);
    case 'monthly':
      return monthlyBuckets(day);
    case 'quarterly':
      return quarterlyBuckets(day, options);
    case 'yearly':
      return yearlyBuckets(day, options);
  }
}
