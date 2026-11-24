'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { Button } from '@/components/atoms/Button';
import { Skeleton } from '@/components/atoms/Skeleton';
import { useProjects } from '@/hooks/hr/useProjects';
import { cardClass, cn } from '@/lib/utils';
import { summarizeProjects, type AttentionItem, type AttentionReason } from '@/lib/projectsSummary';

const LIST_LIMIT = 6;

const REASON_STYLE: Record<AttentionReason, string> = {
  OVERDUE: 'bg-red-50 text-red-600',
  DUE_SOON: 'bg-amber-50 text-amber-700',
  ON_HOLD: 'bg-gray-100 text-gray-600',
};

function reasonLabel({ reason, daysLate }: AttentionItem) {
  if (reason === 'OVERDUE') return `${daysLate}d overdue`;
  if (reason === 'DUE_SOON') {
    const left = -(daysLate ?? 0);
    return left === 0 ? 'Due today' : `Due in ${left}d`;
  }
  return 'On hold';
}

interface ProjectsSummaryCardProps {
  className?: string;
}

/** Portfolio health at a glance: a status count strip, task load across the open projects, and
 * the projects that need attention (overdue, ending soon with little done, or on hold). Computed
 * from the projects the caller can see, and a live snapshot, so it ignores the period filter. */
export function ProjectsSummaryCard({ className }: ProjectsSummaryCardProps) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const { data, isLoading, isError } = useProjects();

  const summary = useMemo(() => summarizeProjects(data ?? []), [data]);

  const base = `/${tenantSlug}/hr/projects`;

  return (
    <div className={cn(cardClass('flex flex-col gap-2 p-3 h-72', 'glass'), className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col">
          <h3 className="text-sm font-semibold text-gray-900">Projects</h3>
          <span className="text-xs text-gray-400">Needs attention</span>
        </div>
        <div className="flex items-center gap-2">
          {!isLoading && !isError && summary.attention.length > 0 && (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-700">
              {summary.attention.length}
            </span>
          )}
          <Button
            variant="outline"
            size="sm"
            className="px-3 py-1 text-xs"
            onClick={() => router.push(base)}
          >
            Manage
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
          Projects could not be loaded.
        </div>
      ) : (
        <>
          {summary.attention.length === 0 ? (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
              Every project is on track.
            </div>
          ) : (
            <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto">
              {summary.attention.slice(0, LIST_LIMIT).map((item) => (
                <li key={item.project.id}>
                  <Link
                    href={`${base}/${item.project.id}`}
                    className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-gray-100/70"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1 leading-tight">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-gray-900">
                          {item.project.name}
                        </span>
                        <span className="shrink-0 text-[10px] text-gray-400">
                          {item.project.progress ?? 0}%
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-gray-200">
                        <div
                          className="h-full rounded-full bg-gray-700"
                          style={{ width: `${item.project.progress ?? 0}%` }}
                        />
                      </div>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        REASON_STYLE[item.reason],
                      )}
                    >
                      {reasonLabel(item)}
                    </span>
                  </Link>
                </li>
              ))}
              {summary.attention.length > LIST_LIMIT && (
                <li className="px-1.5 pt-1 text-[11px] text-gray-400">
                  +{summary.attention.length - LIST_LIMIT} more in{' '}
                  <Link href={base} className="underline">
                    Projects
                  </Link>
                </li>
              )}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
