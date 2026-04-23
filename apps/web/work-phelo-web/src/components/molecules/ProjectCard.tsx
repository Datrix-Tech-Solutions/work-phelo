import { Project, ProjectStatus } from '@/types/hr';
import { cn } from '@/lib/utils';
import { Users, CalendarDays } from 'lucide-react';

const STATUS_STYLES: Record<
  ProjectStatus,
  { dot: string; text: string; bg: string; label: string }
> = {
  PLANNING: { dot: 'bg-blue-400', text: 'text-blue-700', bg: 'bg-blue-50', label: 'Planning' },
  ACTIVE: { dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50', label: 'Active' },
  ON_HOLD: { dot: 'bg-yellow-400', text: 'text-yellow-700', bg: 'bg-yellow-50', label: 'On Hold' },
  COMPLETED: { dot: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-100', label: 'Completed' },
  CANCELLED: { dot: 'bg-red-400', text: 'text-red-600', bg: 'bg-red-50', label: 'Cancelled' },
};

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function StatusBadge({ status }: { status: ProjectStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold shrink-0',
        s.bg,
        s.text,
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', s.dot)} />
      {s.label}
    </span>
  );
}

interface ProjectCardProps {
  project: Project;
  onAddTasks?: () => void;
  onAssignEmployees?: () => void;
  onDelete?: () => void;
}

export function ProjectCard({
  project,
  onAddTasks,
  onAssignEmployees,
  onDelete,
}: ProjectCardProps) {
  const hasActions = !!(onAddTasks || onAssignEmployees || onDelete);

  return (
    <div className="bg-white border border-gray-200 rounded-card flex flex-col h-full hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-3">
        <div className="w-10 h-10 rounded-lg bg-[#EEF1F8] flex items-center justify-center shrink-0">
          <span className="text-brand font-bold text-sm">
            {project.name.substring(0, 2).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-gray-900 leading-snug truncate">{project.name}</p>
          {project.managerName && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">PM: {project.managerName}</p>
          )}
        </div>
        <StatusBadge status={project.status} />
      </div>

      <div className="mx-4 h-px bg-gray-100" />

      {/* Details */}
      <div className="flex flex-col gap-2.5 px-4 py-3 flex-1">
        {project.description && (
          <p className="text-xs text-gray-500 line-clamp-2">{project.description}</p>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <CalendarDays className="w-3 h-3" /> Start
          </span>
          <span className="text-xs font-semibold text-gray-700">
            {formatDate(project.startDate)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <CalendarDays className="w-3 h-3" /> End
          </span>
          <span className="text-xs font-semibold text-gray-700">{formatDate(project.endDate)}</span>
        </div>

        {project.budget != null && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-400">Budget</span>
            <span className="text-xs font-semibold text-gray-700">
              GHS {project.budget.toLocaleString()}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-gray-400 flex items-center gap-1">
            <Users className="w-3 h-3" /> Assigned
          </span>
          <span className="text-xs font-semibold text-gray-700">
            {project.assignedCount} {project.assignedCount === 1 ? 'employee' : 'employees'}
          </span>
        </div>
      </div>

      {hasActions && (
        <>
          <div className="mx-4 h-px bg-gray-100" />

          {/* Actions */}
          <div className="flex gap-2 p-4 pt-3">
            {onAddTasks && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAddTasks();
                }}
                className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              >
                Add Tasks
              </button>
            )}
            {onAssignEmployees && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onAssignEmployees();
                }}
                className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
              >
                Assign
              </button>
            )}
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
                className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
