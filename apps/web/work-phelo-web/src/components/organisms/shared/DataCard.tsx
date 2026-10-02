import { cardClass, cn, glassStrongClass } from '@/lib/utils';

export interface DataCardDetail {
  label: React.ReactNode;
  value: React.ReactNode;
}

export interface DataCardAction {
  label: string;
  onClick: () => void;
  /** Color classes for the button, e.g. 'bg-blue-50 text-blue-600 hover:bg-blue-100' */
  className: string;
}

interface DataCardProps {
  /** Fully-built leading visual (icon box or avatar circle) — DataCard doesn't style it. */
  icon: React.ReactNode;
  title: string;
  /** Plain text under the title. */
  subtitle?: string;
  /** Corner element in the header row, e.g. a status badge. */
  badge?: React.ReactNode;
  /** Full-width text row at the top of the body, e.g. a description. */
  note?: React.ReactNode;
  /** Label/value rows in the body. */
  details?: DataCardDetail[];
  /** Shortcut buttons row at the bottom. */
  actions?: DataCardAction[];
  onClick?: () => void;
  className?: string;
  /** `strong` (default) is the opaque-ish glass; `card` is the lighter card style the overview uses. */
  surface?: 'strong' | 'card';
}

export function DataCard({
  icon,
  title,
  subtitle,
  badge,
  note,
  details,
  actions,
  onClick,
  className,
  surface = 'strong',
}: DataCardProps) {
  const classes = cn(
    surface === 'strong' && 'shadow-lg',
    'rounded-card flex flex-col h-full w-full transition-all duration-200',
    onClick &&
      'cursor-pointer hover:border-(--module-border,var(--color-purple-100)) hover:shadow-xl hover:-translate-y-0.5',
    className,
  );

  return (
    <div
      onClick={onClick}
      className={surface === 'card' ? cardClass(classes) : glassStrongClass(classes, 'plain')}
    >
      {/* Header: icon + title/subtitle — badge on the right */}
      <div className="flex items-start gap-3 p-4 pb-3">
        {icon}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 leading-snug truncate">{title}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>}
        </div>
        {badge}
      </div>

      {(note || (details && details.length > 0)) && (
        <>
          <div className="mx-4 h-px bg-gray-100" />
          <div className="flex flex-col gap-2.5 px-4 py-3 flex-1">
            {note}
            {details?.map((d, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-400 flex items-center gap-1">{d.label}</span>
                {d.value}
              </div>
            ))}
          </div>
        </>
      )}

      {actions && actions.length > 0 && (
        <>
          <div className="mx-4 h-px bg-gray-100" />
          <div className="flex gap-2 p-4 pt-3">
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={(e) => {
                  e.stopPropagation();
                  a.onClick();
                }}
                className={cn(
                  'flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors',
                  a.className,
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
