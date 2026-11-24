'use client';

import { useProjectMembers, useProjectTasks } from '@/hooks/hr/useProjects';
import { useProjectTimers } from '@/hooks/hr/useProjectTime';
import {
  useProjectObjectives,
  useProjectSprints,
  useProjectSubtasks,
} from '@/hooks/hr/useProjectWork';

/**
 * Starts loading what the project's tabs share as soon as the project opens, all at once, so each tab finds
 * its data in the cache instead of fetching it on arrival. Renders nothing; it's its own component so the
 * data arriving doesn't re-render the tab bar.
 */
export function WarmProjectData({ projectId }: { projectId: string }) {
  useProjectTasks(projectId);
  useProjectObjectives(projectId);
  useProjectSubtasks(projectId);
  useProjectSprints(projectId);
  useProjectMembers(projectId);
  useProjectTimers(projectId);
  return null;
}
