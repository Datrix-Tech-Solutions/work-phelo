import type { Project, ProjectConfig, ProjectPricing, ProjectType } from '@/types/hr';

/** What a project was set up with, read from the project itself. */
export interface ProjectSetup {
  /** Undefined for a project made before set-ups existed. */
  config?: ProjectConfig;
  projectType?: ProjectType;
  templateName: string | null;
  billable: boolean;
  pricing?: ProjectPricing;
  client?: { id: string; name: string };
}

/** A project's set-up, or undefined while the project is still loading. */
export function projectSetup(project: Project | undefined): ProjectSetup | undefined {
  if (!project) return undefined;
  const c = project.config;
  // `{}` is what a project made before set-ups existed carries.
  const config =
    c?.workflow && c.workTypes && c.features && c.priorities
      ? {
          workflow: c.workflow,
          workTypes: c.workTypes,
          features: c.features,
          priorities: c.priorities,
        }
      : undefined;
  return {
    config,
    projectType: project.kind ?? undefined,
    templateName: project.templateName ?? null,
    billable: !!project.billable,
    pricing: project.pricing,
    client: project.clientId ? { id: project.clientId, name: project.clientName ?? '' } : undefined,
  };
}
