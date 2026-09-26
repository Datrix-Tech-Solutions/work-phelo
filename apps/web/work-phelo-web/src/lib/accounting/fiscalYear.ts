export const FISCAL_MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
].map((label, i) => ({ value: String(i + 1), label }));

const SHORT_MONTHS = FISCAL_MONTHS.map((m) => m.label.slice(0, 3));

/** What a year starting in `startMonth` of `year` will be called and cover — mirrors the API. */
export function fiscalYearPreview(year: number, startMonth: number) {
  const name = startMonth === 1 ? `FY${year}` : `FY${year}/${String(year + 1).slice(-2)}`;
  const endMonthIndex = (startMonth + 10) % 12;
  const endYear = startMonth === 1 ? year : year + 1;
  return {
    name,
    range: `${SHORT_MONTHS[startMonth - 1]} ${year} – ${SHORT_MONTHS[endMonthIndex]} ${endYear}`,
  };
}
