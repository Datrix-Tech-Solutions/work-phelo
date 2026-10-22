import { ProjectConfig } from '@/types/hr';

/** The config part of a template, as an independent copy a project or form can edit freely. */
export function pickConfig({
  workflow,
  workTypes,
  features,
  priorities,
}: ProjectConfig): ProjectConfig {
  return {
    workflow: [...workflow],
    workTypes: workTypes.map((w) => ({ ...w })),
    features: [...features],
    priorities: priorities.map((p) => ({ ...p })),
  };
}
