import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Frequency } from '@/types/hr';

export interface Goal {
  id: string;
  name: string;
  selfAssessmentWeight: number;
  managerAssessmentWeight: number;
  /** The employees the goal is for. */
  employeeIds: string[];
}
export type GoalInput = Omit<Goal, 'id'>;

export type LocalCycleStatus = 'UPCOMING' | 'ACTIVE' | 'CANCELLED';

export interface LocalCycle {
  id: string;
  title: string;
  description?: string;
  frequency: Frequency | '';
  startDate: string;
  endDate: string;
  selfAssessmentDeadline: string;
  managerReviewDeadline: string;
  /** The goals the cycle runs; a cycle can run several. */
  goalIds: string[];
  status: LocalCycleStatus;
  cancelledReason?: string;
}
export type CycleInput = Omit<LocalCycle, 'id' | 'status' | 'cancelledReason'>;

interface AppraisalGoalsStore {
  goals: Goal[];
  cycles: LocalCycle[];
  addGoal: (dto: GoalInput) => void;
  updateGoal: (id: string, dto: GoalInput) => void;
  /** Removes the goal, and takes it out of every cycle that ran it. */
  removeGoal: (id: string) => void;
  addCycle: (dto: CycleInput) => void;
  updateCycle: (id: string, dto: CycleInput) => void;
  removeCycle: (id: string) => void;
  startCycle: (id: string) => void;
  cancelCycle: (id: string, reason: string) => void;
}

// Local-storage only until the appraisal backend takes goals and cycles over.
export const useAppraisalGoalsStore = create<AppraisalGoalsStore>()(
  persist(
    (set) => ({
      goals: [],
      cycles: [],
      addGoal: (dto) => set((s) => ({ goals: [{ id: crypto.randomUUID(), ...dto }, ...s.goals] })),
      updateGoal: (id, dto) =>
        set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, ...dto } : g)) })),
      removeGoal: (id) =>
        set((s) => ({
          goals: s.goals.filter((g) => g.id !== id),
          cycles: s.cycles.map((c) => ({ ...c, goalIds: c.goalIds.filter((g) => g !== id) })),
        })),
      addCycle: (dto) =>
        set((s) => ({
          cycles: [{ id: crypto.randomUUID(), status: 'UPCOMING', ...dto }, ...s.cycles],
        })),
      updateCycle: (id, dto) =>
        set((s) => ({ cycles: s.cycles.map((c) => (c.id === id ? { ...c, ...dto } : c)) })),
      removeCycle: (id) => set((s) => ({ cycles: s.cycles.filter((c) => c.id !== id) })),
      startCycle: (id) =>
        set((s) => ({
          cycles: s.cycles.map((c) => (c.id === id ? { ...c, status: 'ACTIVE' } : c)),
        })),
      cancelCycle: (id, reason) =>
        set((s) => ({
          cycles: s.cycles.map((c) =>
            c.id === id ? { ...c, status: 'CANCELLED', cancelledReason: reason } : c,
          ),
        })),
    }),
    { name: 'appraisal-goals' },
  ),
);
