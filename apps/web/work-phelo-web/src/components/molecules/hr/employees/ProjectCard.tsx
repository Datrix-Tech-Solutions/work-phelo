import { Users, CalendarDays } from 'lucide-react';
import { ProjectStatusBadge } from '@/components/molecules/hr/projects/ProjectStatusBadge';
import type { Project } from '@/types/hr';

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function ProjectCard({
  project,
  onSelect,
  disabled = false,
}: {
  project: Project;
  onSelect: () => void;
  /** Shown but not openable (e.g. the viewer lacks project access) — no hover effect. */
  disabled?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, project.progress ?? 0));

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={`w-80 shrink-0 text-left flex flex-col gap-3 p-4 rounded-2xl border border-gray-200 ${
        disabled
          ? 'bg-gray-50 opacity-60 cursor-not-allowed'
          : 'bg-white cursor-pointer transition-all duration-150 hover:border-brand hover:bg-brand-tint hover:ring-2 hover:ring-brand/30 hover:shadow-xl hover:-translate-y-1 hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 line-clamp-2">{project.name}</p>
        <ProjectStatusBadge status={project.status} />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>Progress</span>
          <span className="font-semibold text-gray-900">{pct}%</span>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {project.assignedCount} {project.assignedCount === 1 ? 'member' : 'members'}
        </span>
        <span className="flex items-center gap-1">
          <CalendarDays className="w-3 h-3" />
          {formatDate(project.startDate)} – {formatDate(project.endDate)}
        </span>
      </div>
    </button>
  );
}
