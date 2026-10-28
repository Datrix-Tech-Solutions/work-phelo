'use client';

import { OrderedItemsField } from '@/components/molecules/hr/projects/OrderedItemsField';
import { PriorityLevelsField } from '@/components/molecules/hr/projects/PriorityLevelsField';
import { WorkTypesField } from '@/components/molecules/hr/projects/WorkTypesField';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { PROJECT_FEATURE_OPTIONS } from '@/lib/projectFeatures';
import { ProjectConfig, ProjectFeature } from '@/types/hr';

/** What's missing from a config, by field; empty when it is valid. */
export function getProjectConfigErrors(config: ProjectConfig) {
  const errors: Partial<Record<keyof ProjectConfig, string>> = {};
  if (config.workflow.length < 2) errors.workflow = 'Add at least two workflow statuses';
  if (config.workTypes.length < 1) errors.workTypes = 'Add at least one work type';
  if (config.features.length < 1) errors.features = 'Turn on at least one feature';
  if (config.priorities.length < 2) errors.priorities = 'Add at least two priority levels';
  const hasBlankOrRepeat = (names: string[]) =>
    names.some((n) => !n.trim()) ||
    new Set(names.map((n) => n.trim().toLowerCase())).size !== names.length;
  if (!errors.workflow && hasBlankOrRepeat(config.workflow))
    errors.workflow = 'Give every status its own name';
  if (!errors.workTypes && hasBlankOrRepeat(config.workTypes.map((w) => w.name)))
    errors.workTypes = 'Give every work type its own name';
  if (!errors.priorities && hasBlankOrRepeat(config.priorities.map((p) => p.name)))
    errors.priorities = 'Give every priority level its own name';
  return errors;
}

interface Props {
  value: ProjectConfig;
  onChange: (value: ProjectConfig) => void;
  /** Show the validation messages (after a failed submit). */
  showErrors?: boolean;
}

/** The workflow, work types, features and priority levels, shared by the template form and the new-project form. */
export function ProjectConfigFields({ value, onChange, showErrors }: Props) {
  const errors = showErrors ? getProjectConfigErrors(value) : {};

  return (
    <>
      <OrderedItemsField
        label="Workflow"
        placeholder="e.g. In Review"
        value={value.workflow}
        onChange={(workflow) => onChange({ ...value, workflow })}
        error={errors.workflow}
      />
      <WorkTypesField
        label="Work Types"
        placeholder="e.g. Story"
        value={value.workTypes}
        onChange={(workTypes) => onChange({ ...value, workTypes })}
        error={errors.workTypes}
      />
      <MultiSelect
        label="View"
        placeholder="Select the project tabs to turn on"
        options={PROJECT_FEATURE_OPTIONS}
        value={value.features}
        onChange={(features) => onChange({ ...value, features: features as ProjectFeature[] })}
        error={errors.features}
      />
      <PriorityLevelsField
        label="Priority Levels"
        placeholder="e.g. Critical"
        value={value.priorities}
        onChange={(priorities) => onChange({ ...value, priorities })}
        error={errors.priorities}
      />
    </>
  );
}
