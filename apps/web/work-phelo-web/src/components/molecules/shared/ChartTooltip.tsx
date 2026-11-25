import { cn } from '@/lib/utils';

export interface ChartTooltipRow {
  label: string;
  value: string;
  /** Draws a dot beside the label, to tell series apart. */
  color?: string;
}

interface ChartTooltipProps {
  title: string;
  /** Dot beside the title. */
  color?: string;
  /** Right of the title, e.g. a share of the total. */
  aside?: string;
  rows: ChartTooltipRow[];
  /** A closing hint under the rows. */
  footer?: string;
  /** Positions the tooltip; it sits centred above the point given. */
  className?: string;
  style?: React.CSSProperties;
}

/** The dark hover card of the dashboard charts. Place it inside a `relative` parent. */
export function ChartTooltip({
  title,
  color,
  aside,
  rows,
  footer,
  className,
  style,
}: ChartTooltipProps) {
  return (
    <div
      className={cn(
        'absolute z-10 -translate-x-1/2 -translate-y-full pointer-events-none',
        className,
      )}
      style={style}
    >
      <div className="bg-(--chip-dark,#111827) text-white rounded-lg shadow-xl px-2.5 py-1.5 text-[10px] whitespace-nowrap flex flex-col gap-1">
        <div className="flex items-center gap-1.5 font-semibold text-[11px]">
          {color && (
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
          )}
          {title}
          {aside && <span className="ml-auto pl-3 text-[#d1d5db]">{aside}</span>}
        </div>
        <div className="border-t border-[#374151] pt-1 flex flex-col gap-0.5">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-[#9ca3af]">
                {row.color && (
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: row.color }}
                  />
                )}
                {row.label}
              </span>
              <span className="font-medium">{row.value}</span>
            </div>
          ))}
        </div>
        {footer && <div className="border-t border-[#374151] pt-1 text-[#9ca3af]">{footer}</div>}
      </div>
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-(--chip-dark,#111827) rotate-45 rounded-sm" />
    </div>
  );
}

/** What a tooltip shows for one bucket of a chart with series. With `showShare` and a single
 * series it reads like a pie slice: the series dot and the bucket's share beside its name. */
export function bucketTooltip(
  title: string,
  series: {
    label: string;
    color: string;
    data: (number | null)[];
    valueFormatter?: (value: number | null) => string;
  }[],
  index: number,
  showShare?: boolean,
): Pick<ChartTooltipProps, 'title' | 'color' | 'aside' | 'rows'> {
  const solo = showShare && series.length === 1 ? series[0] : null;
  const total = solo?.data.reduce<number>((sum, value) => sum + (value ?? 0), 0) ?? 0;
  return {
    title,
    color: solo?.color,
    aside:
      solo && total > 0 ? `${(((solo.data[index] ?? 0) / total) * 100).toFixed(1)}%` : undefined,
    rows: series.map((s) => {
      const value = s.data[index] ?? null;
      return {
        label: s.label,
        color: solo ? undefined : s.color,
        value: s.valueFormatter ? s.valueFormatter(value) : String(value ?? '—'),
      };
    }),
  };
}
