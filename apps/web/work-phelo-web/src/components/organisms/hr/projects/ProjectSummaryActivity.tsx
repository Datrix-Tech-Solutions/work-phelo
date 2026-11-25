'use client';

import { useProjectActivities } from '@/hooks';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** The latest things that happened, narrowed to a person's own actions and tasks when one is picked. */
export function SummaryActivity({
  projectId,
  personId,
  taskIds,
}: {
  projectId: string;
  /** Empty for everyone. */
  personId: string;
  /** The filtered tasks. */
  taskIds: Set<string>;
}) {
  const { data = [] } = useProjectActivities(projectId);
  const shown = data
    .filter(
      (a) => !personId || a.actorEmployeeId === personId || (!!a.taskId && taskIds.has(a.taskId)),
    )
    .slice(0, 10);

  if (shown.length === 0) return <p className="text-sm text-gray-400">No recent activity.</p>;

  return (
    <ul className="flex flex-col gap-3">
      {shown.map((a) => (
        <li key={a.id} className="flex items-baseline justify-between gap-4 text-sm">
          <span className="min-w-0 text-gray-700">{a.message}</span>
          <span className="shrink-0 text-xs text-gray-400">{formatDate(a.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
