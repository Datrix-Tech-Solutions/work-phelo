import type { TypeChipColor } from '@/components/atoms/TypeChip';
import type { ProjectSprint } from '@/types/hr';

/** Where a sprint is: completed once someone completes it, otherwise going by today's date against its start and end. */
export function sprintState(
  sprint: ProjectSprint,
  today: string,
): { label: string; color: TypeChipColor } {
  if (sprint.completedAt) return { label: 'Completed', color: 'gray' };
  if (today < sprint.startDate) return { label: 'Upcoming', color: 'blue' };
  if (today > sprint.endDate) return { label: 'Ended', color: 'gray' };
  return { label: 'Active', color: 'green' };
}

/**
 * The sprint the board follows: the one running today (a completed sprint no longer counts), otherwise
 * the next one to start, otherwise the one that ended most recently. Undefined when there are no sprints.
 */
export function currentSprint(sprints: ProjectSprint[], today: string): ProjectSprint | undefined {
  const active = sprints.find(
    (sp) => !sp.completedAt && sp.startDate <= today && today <= sp.endDate,
  );
  if (active) return active;
  const upcoming = sprints
    .filter((sp) => !sp.completedAt && sp.startDate > today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
  if (upcoming) return upcoming;
  return [...sprints].sort((a, b) => b.endDate.localeCompare(a.endDate))[0];
}
