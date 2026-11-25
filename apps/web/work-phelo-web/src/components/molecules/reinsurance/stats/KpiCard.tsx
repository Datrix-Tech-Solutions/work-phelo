'use client';

import Link from 'next/link';
import { LucideIcon } from 'lucide-react';
import { TrendBadge } from '@/components/atoms/TrendBadge';
import { Skeleton } from '@/components/atoms/Skeleton';
import { cardClass, cn, waterIconStyle } from '@/lib/utils';

interface KpiCardProps {
  label: string;
  value: string | number;
  /** Leave out for a card with no icon; the text then uses the full width. */
  icon?: LucideIcon;
  /** Hex/CSS color seed for the icon's water-glass circle. */
  iconColor?: string;
  /** Shown at the right of the label row, e.g. a type chip. */
  badge?: React.ReactNode;
  /** Tighter padding and a smaller value, for rows with many cards. */
  compact?: boolean;
  trend?: number;
  trendTooltip?: string;
  periodLabel?: string;
  /** Optional breakdown shown under the value, e.g. Pending / Finalized splits. */
  sub?: { label: string; value: string | number }[];
  /** Where `sub` sits: beside the value (default) or on its own line underneath it. */
  subPlacement?: 'inline' | 'below';
  isLoading?: boolean;
  /** Makes the whole card a link to this page. */
  href?: string;
  /** Makes the whole card a button, e.g. to open a side panel. Ignored when `href` is given. */
  onClick?: () => void;
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  iconColor = 'var(--module-btn-bg, var(--brand))',
  badge,
  compact = false,
  trend,
  trendTooltip,
  periodLabel,
  sub,
  subPlacement = 'inline',
  isLoading,
  href,
  onClick,
}: KpiCardProps) {
  const clickable = Boolean(href || onClick);
  // Covers the card, so the whole of it is clickable without nesting content inside a link.
  const overlayClass =
    'absolute inset-0 rounded-[inherit] cursor-pointer focus-visible:outline-2 focus-visible:outline-brand';

  return (
    <div
      className={cardClass(
        cn(
          'flex items-center gap-2',
          compact ? 'px-2 py-1.5' : 'p-2',
          clickable && 'relative transition-shadow hover:shadow-md',
        ),
        'glass',
      )}
    >
      {href ? (
        <Link href={href} aria-label={label} className={overlayClass} />
      ) : (
        onClick && (
          <button type="button" onClick={onClick} aria-label={label} className={overlayClass} />
        )
      )}

      {Icon && (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={waterIconStyle(iconColor)}
        >
          <Icon
            className="w-4 h-4"
            style={{ color: `color-mix(in oklab, ${iconColor} 65%, black)` }}
          />
        </div>
      )}

      <div className="flex flex-col gap-px min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-light text-gray-700">{label}</span>
          {badge}
        </div>
        {isLoading ? (
          <>
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </>
        ) : (
          <>
            <div className="flex items-baseline gap-2 min-w-0">
              <span className={cn('font-bold text-gray-900', compact ? 'text-base' : 'text-lg')}>
                {value}
              </span>
              {sub && sub.length > 0 && subPlacement === 'inline' && (
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[10px] text-gray-500">
                  {sub.map((s) => (
                    <span key={s.label}>
                      {s.label} <span className="font-semibold text-gray-700">{s.value}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
            {sub && sub.length > 0 && subPlacement === 'below' && (
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[10px] text-gray-500">
                {sub.map((s) => (
                  <span key={s.label}>
                    {s.label} <span className="font-semibold text-gray-700">{s.value}</span>
                  </span>
                ))}
              </div>
            )}
            {trend !== undefined && (
              <div className="flex items-center gap-1">
                {/* Above the card's click overlay, so the tooltip still shows on hover. */}
                <span className="relative z-10 inline-flex">
                  <TrendBadge change={trend} tooltip={trendTooltip} />
                </span>
                <span className="text-[10px] text-gray-400">vs previous {periodLabel}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
