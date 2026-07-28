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
        : `Comparative Year-To-Date (FY${startYear} - FY${endYear})`;

  return (
    <div className="flex items-baseline gap-2 pb-2 border-b border-gray-100 shrink-0">
      <h2 className="text-lg font-bold text-gray-900">{title}</h2>
      {subtitle && (
        <>
          <span className="text-gray-400">·</span>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </>
      )}
    </div>
  );
}
