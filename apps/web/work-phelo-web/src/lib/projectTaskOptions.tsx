import { SearchSelectOption } from '@/components/atoms/SearchSelect';
import { PriorityDot } from '@/lib/priorityColors';
import { WorkTypeIconBadge } from '@/lib/workTypeIcons';
import { ProjectConfig } from '@/types/hr';

/** Dropdown options and defaults for a task's work type and priority, from the project's own setup. */
export function projectTaskOptions(config: ProjectConfig | undefined) {
  const workTypeOptions: SearchSelectOption[] = (config?.workTypes ?? []).map((w) => ({
    value: w.name,
    label: w.name,
    icon: <WorkTypeIconBadge icon={w.icon} />,
  }));
  const priorityOptions: SearchSelectOption[] = (config?.priorities ?? []).map((p) => ({
    value: p.name,
    label: p.name,
    icon: <PriorityDot color={p.color} />,
  }));
  const priorities = config?.priorities ?? [];
  return {
    workTypeOptions,
    priorityOptions,
    defaultWorkType: config?.workTypes[0]?.name ?? '',
    // The middle level, e.g. Medium of Low / Medium / High.
    defaultPriority: priorities[Math.floor((priorities.length - 1) / 2)]?.name ?? '',
  };
}
