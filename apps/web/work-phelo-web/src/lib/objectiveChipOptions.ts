import type { TypeChipColor } from '@/components/atoms/TypeChip';
import type { TypeChipOption } from '@/components/atoms/TypeChipSelect';

/** Objective colours in the order objectives are made; after the sixth they start over. Gray is kept for "no objective". */
const OBJECTIVE_COLORS: TypeChipColor[] = ['purple', 'blue', 'teal', 'amber', 'green', 'red'];

/** The choices a task's objective chip offers: no objective, or any of the project's objectives. */
export function objectiveChipOptions(objectives: { id: string; name: string }[]): TypeChipOption[] {
  return [
    { value: '', label: 'No objective', color: 'gray' },
    ...objectives.map((o, i) => ({
      value: o.id,
      label: o.name,
      color: OBJECTIVE_COLORS[i % OBJECTIVE_COLORS.length],
    })),
  ];
}
