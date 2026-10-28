import { api } from '@/lib/api';
import type { ProjectTemplateContent } from '@/types/hr';

const DAY_MS = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD for a day count after a start date, worked in UTC so time zones can't shift it. */
function dayAfter(start: string, days: number): string {
  return new Date(Date.parse(`${start}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * Adds a template's objectives and sprints to a newly created project. Sprints run back to back
 * from the project's start date.
 */
export async function seedProjectFromTemplate(
  projectId: string,
  content: Pick<ProjectTemplateContent, 'objectives' | 'sprints'>,
  startDate: string,
) {
  for (const name of content.objectives) {
    await api.post(`/hr/projects/${projectId}/objectives`, { name });
  }
  let from = startDate;
  for (const sprint of content.sprints) {
    const endDate = dayAfter(from, sprint.days - 1);
    await api.post(`/hr/projects/${projectId}/sprints`, {
      name: sprint.name,
      startDate: from,
      endDate,
      taskIds: [],
    });
    from = dayAfter(endDate, 1);
  }
}
