import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface EmployeeObjective {
  id: string;
  employeeId: string;
  goalId: string;
  goal: string;
  name: string;
  createdBy: string;
  comments: string[];
}
export type EmployeeObjectiveInput = Pick<
  EmployeeObjective,
  'employeeId' | 'goalId' | 'goal' | 'name' | 'createdBy' | 'comments'
>;

interface EmployeeObjectivesStore {
  objectives: EmployeeObjective[];
  addObjective: (dto: EmployeeObjectiveInput) => void;
  addComment: (id: string, text: string) => void;
}

// Local-storage only until the appraisal backend exists. Keyed by employee, so HR's view of an
// employee and the employee's own profile show the same objectives.
export const useEmployeeObjectivesStore = create<EmployeeObjectivesStore>()(
  persist(
    (set) => ({
      objectives: [],
      addObjective: (dto) =>
        set((s) => ({ objectives: [{ id: crypto.randomUUID(), ...dto }, ...s.objectives] })),
      addComment: (id, text) =>
        set((s) => ({
          objectives: s.objectives.map((o) =>
            o.id === id ? { ...o, comments: [...o.comments, text] } : o,
          ),
        })),
    }),
    { name: 'employee-objectives' },
  ),
);
