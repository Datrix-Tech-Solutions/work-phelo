'use client';

import { use, useState } from 'react';
import { ProjectBacklog } from '@/components/organisms/hr/projects/ProjectBacklog';
import { ProjectBoard } from '@/components/organisms/hr/projects/ProjectBoard';
import { Columns3, List } from 'lucide-react';
import { cn } from '@/lib/utils';

type BacklogView = 'backlog' | 'board';

const VIEWS = [
  { value: 'backlog', label: 'Backlog view', icon: List },
  { value: 'board', label: 'Board view', icon: Columns3 },
] as const;

// The backlog is where tasks and sprints are managed: sprints on top, each a collapsible list of its
// tasks, then the tasks not in any sprint. The toggle swaps in the board right here, without leaving
// the page.
export default function ProjectBacklogPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { id } = use(params);
  const [view, setView] = useState<BacklogView>('backlog');
  // Same icon switch as the table/grid one used in the other toolbars.
  const toggle = (
    <div className="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
      {VIEWS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => setView(value)}
          aria-label={label}
          title={label}
          aria-pressed={view === value}
          className={cn(
            'p-1.5 rounded-md transition-colors',
            view === value
              ? 'bg-white shadow-sm text-gray-800'
              : 'text-gray-400 hover:text-gray-600',
          )}
        >
          <Icon className="w-4 h-4" />
        </button>
      ))}
    </div>
  );

  // The backlog carries the toggle in its own toolbar; the board has none, so it gets a row.
  if (view === 'backlog') return <ProjectBacklog projectId={id} viewToggle={toggle} />;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">{toggle}</div>
      <ProjectBoard projectId={id} />
    </div>
  );
}
