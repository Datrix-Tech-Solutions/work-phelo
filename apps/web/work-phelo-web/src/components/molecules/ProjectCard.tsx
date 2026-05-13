import { Project } from '@/types/hr';
import { Users, CalendarDays } from 'lucide-react';
import { ProjectStatusBadge } from '@/components/molecules/projects/ProjectStatusBadge';

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

interface ProjectCardProps {
  project: Project;
  onOpen?: () => void;
  onDelete?: () => void;
}

export function ProjectCard({ project, onOpen, onDelete }: ProjectCardProps) {
  const hasActions = !!(onOpen || onDelete);

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
        <ProjectStatusBadge status={project.status} />
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
            {onOpen && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen();
                }}
                className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
              >
                Open
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
