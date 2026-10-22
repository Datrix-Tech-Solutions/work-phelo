import type { TypeChipOption } from '@/components/atoms/TypeChipSelect';

/** The choices a task's objective chip offers: no objective, or any of the project's objectives. */
export function objectiveChipOptions(objectives: { id: string; name: string }[]): TypeChipOption[] {
  return [
    { value: '', label: 'No objective', color: 'gray' },
    ...objectives.map((o) => ({ value: o.id, label: o.name, color: 'purple' as const })),
  ];
}
