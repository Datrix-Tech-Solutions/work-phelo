import { BadRequestException } from '@nestjs/common';
import { Prisma, ProjectTaskStatus } from '../../prisma/generated/client';

/** The parts of a project's own set-up the server needs; older projects may have none of it. */
export interface StoredProjectConfig {
  workflow?: string[];
  workTypes?: { name: string }[];
  priorities?: { name: string }[];
}

export function readConfig(config: Prisma.JsonValue): StoredProjectConfig {
  return config && typeof config === 'object' && !Array.isArray(config)
    ? (config as StoredProjectConfig)
    : {};
}

/** The last stage is Done; the first is To Do; anything between is In Progress. */
export function statusForStage(
  config: Prisma.JsonValue,
  stage: string,
): ProjectTaskStatus {
  const workflow = readConfig(config).workflow ?? [];
  const index = workflow.indexOf(stage);
  if (index === -1) {
    throw new BadRequestException(`"${stage}" is not a stage of this project`);
  }
  if (index === workflow.length - 1) return ProjectTaskStatus.DONE;
  return index === 0 ? ProjectTaskStatus.TODO : ProjectTaskStatus.IN_PROGRESS;
}

/** The stage a new task starts in, or null for a project with no set-up. */
export function firstStage(config: Prisma.JsonValue): string | null {
  return readConfig(config).workflow?.[0] ?? null;
}

/** Checks a task's work type and priority name against the project's own lists. */
export function assertTaskMeta(
  config: Prisma.JsonValue,
  meta: { workType?: string; priorityName?: string },
) {
  const { workTypes, priorities } = readConfig(config);
  if (
    meta.workType &&
    workTypes?.length &&
    !workTypes.some((w) => w.name === meta.workType)
  ) {
    throw new BadRequestException(
      `"${meta.workType}" is not a work type of this project`,
    );
  }
  if (
    meta.priorityName &&
    priorities?.length &&
    !priorities.some((p) => p.name === meta.priorityName)
  ) {
    throw new BadRequestException(
      `"${meta.priorityName}" is not a priority level of this project`,
    );
  }
}
