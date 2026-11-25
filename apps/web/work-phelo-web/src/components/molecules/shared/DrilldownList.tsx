import Link from 'next/link';
import { Skeleton } from '@/components/atoms/Skeleton';

export interface DrilldownRow {
  id: string;
  title: string;
  detail?: string;
  /** Right-aligned, e.g. an amount or a badge. */
  trailing?: React.ReactNode;
  /** Makes the row a link. */
  href?: string;
}

interface DrilldownListProps {
  rows: DrilldownRow[];
  isLoading?: boolean;
  isError?: boolean;
  emptyText: string;
  errorText?: string;
}

/** The rows of a dashboard side panel, with its loading, error and empty states. */
export function DrilldownList({
  rows,
  isLoading,
  isError,
  emptyText,
  errorText = 'Could not be loaded.',
}: DrilldownListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  if (isError || rows.length === 0) {
    return (
      <p className="text-sm text-gray-400 text-center py-10">{isError ? errorText : emptyText}</p>
    );
  }

  return (
    <ul className="flex flex-col gap-1">
      {rows.map(({ id, title, detail, trailing, href }) => {
        const content = (
          <>
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate text-sm font-semibold text-gray-900">{title}</span>
              {detail && <span className="truncate text-xs text-gray-400">{detail}</span>}
            </div>
            {trailing && (
              <span className="shrink-0 text-xs font-medium text-gray-700">{trailing}</span>
            )}
          </>
        );
        const rowClass = '-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5';
        return (
          <li key={id}>
            {href ? (
              <Link href={href} className={`${rowClass} transition-colors hover:bg-gray-100/70`}>
                {content}
              </Link>
            ) : (
              <div className={rowClass}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
