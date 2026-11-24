import type { ProjectDetail, ProjectStatus } from '@/types/hr';

const DAY_MS = 86_400_000;
/** A project ending within this many days with little done is flagged as at risk. */
const DUE_SOON_DAYS = 7;
const AT_RISK_PROGRESS = 70;

export type AttentionReason = 'OVERDUE' | 'DUE_SOON' | 'ON_HOLD';

export interface AttentionItem {
  project: ProjectDetail;
  reason: AttentionReason;
  /** Whole days past (positive) or until (negative) the end date; null without one. */
  daysLate: number | null;
}

const isClosed = (project: ProjectDetail) =>
  project.status === 'COMPLETED' || project.status === 'CANCELLED';

/** Whole days between a date-only string and today, in UTC so the day never shifts by timezone. */
function daysPast(date: string, todayUtc: number) {
  const day = Date.UTC(
    Number(date.slice(0, 4)),
    Number(date.slice(5, 7)) - 1,
    Number(date.slice(8, 10)),
  );
  return Math.round((todayUtc - day) / DAY_MS);
}

function attentionFor(project: ProjectDetail, todayUtc: number): AttentionItem | null {
  if (isClosed(project)) return null;
  const daysLate = project.endDate ? daysPast(project.endDate, todayUtc) : null;
  if (daysLate !== null && daysLate > 0) return { project, reason: 'OVERDUE', daysLate };
  if (
    daysLate !== null &&
    daysLate >= -DUE_SOON_DAYS &&
    (project.progress ?? 0) < AT_RISK_PROGRESS
  ) {
    return { project, reason: 'DUE_SOON', daysLate };
  }
  if (project.status === 'ON_HOLD') return { project, reason: 'ON_HOLD', daysLate };
  return null;
}

const REASON_ORDER: Record<AttentionReason, number> = { OVERDUE: 0, DUE_SOON: 1, ON_HOLD: 2 };

const STATUSES: ProjectStatus[] = ['ACTIVE', 'PLANNING', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];

export interface ProjectsSummary {
  counts: Record<ProjectStatus, number>;
  /** Tasks not done, across projects that are not completed or cancelled. */
  openTasks: number;
  /** Open tasks past their due date. */
  overdueTasks: number;
  /** Projects past their end date, ending soon with little done, or on hold; worst first. */
  attention: AttentionItem[];
  /** Projects past their end date. */
  overdueProjects: number;
}

/** Status counts, task load and the projects needing attention, from the projects a person can see. */
export function summarizeProjects(projects: ProjectDetail[], now = new Date()): ProjectsSummary {
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  const counts = Object.fromEntries(STATUSES.map((status) => [status, 0])) as Record<
    ProjectStatus,
    number
  >;
  for (const project of projects) counts[project.status] += 1;

  let openTasks = 0;
  let overdueTasks = 0;
  for (const project of projects.filter((p) => !isClosed(p))) {
    for (const task of project.tasks ?? []) {
      if (task.status === 'DONE') continue;
      openTasks += 1;
      if (task.dueDate && daysPast(task.dueDate, todayUtc) > 0) overdueTasks += 1;
    }
  }

  const attention = projects
    .map((project) => attentionFor(project, todayUtc))
    .filter((item): item is AttentionItem => item !== null)
    .sort(
      (a, b) =>
        REASON_ORDER[a.reason] - REASON_ORDER[b.reason] ||
        (b.daysLate ?? -Infinity) - (a.daysLate ?? -Infinity),
    );

  return {
    counts,
    openTasks,
    overdueTasks,
    attention,
    overdueProjects: attention.filter((item) => item.reason === 'OVERDUE').length,
  };
}
