import { CalendarDays } from 'lucide-react';
import { Project } from '@/types/hr';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { ProjectStatusBadge } from '@/components/molecules/hr/projects/ProjectStatusBadge';
import { cardClass } from '@/lib/utils';

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface Props {
  project: Project;
}

/** The project overview as a thin bar: name, status and deadline on the left, progress on the right. */
export function ProjectBanner({ project }: Props) {
  return (
    <div className={cardClass('px-4 py-2 flex items-center gap-4')}>
      <h1 className="text-base font-bold text-gray-900 truncate min-w-0">{project.name}</h1>
      <ProjectStatusBadge status={project.status} />
      <span className="hidden sm:flex items-center gap-1.5 text-sm text-gray-500 shrink-0">
        <CalendarDays className="w-4 h-4 text-gray-400" />
        <span className="text-gray-400">Deadline:</span>
        <span className="font-medium text-gray-700">{formatDate(project.endDate)}</span>
      </span>

      <div className="ml-auto shrink-0 w-40 sm:w-52">
        <ProgressBar value={project.progress ?? 0} />
      </div>
    </div>
  );
}
