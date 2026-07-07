interface ReportHeroProps {
  title: string;
  years: string[];
}

export function ReportHero({ title, years }: ReportHeroProps) {
  const sortedYears = [...years].sort((a, b) => Number(a) - Number(b));
  const [startYear, endYear] = [sortedYears[0], sortedYears[sortedYears.length - 1]];

  const subtitle =
    sortedYears.length === 0
      ? null
      : sortedYears.length === 1
        ? `Year-To-Date (FY${startYear})`
        : `Comparative Year-To-Date (FY${startYear}-FY${endYear})`;

  return (
    <div className="flex flex-col items-center gap-1 pb-4 border-b border-gray-100 shrink-0 text-center">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
    </div>
  );
}
