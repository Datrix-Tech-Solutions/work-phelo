import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AssessmentStatus = 'NOT_STARTED' | 'SELF_SUBMITTED' | 'MANAGER_SUBMITTED' | 'FINALIZED';

/** A rating and optional comment on one of the employee's objectives. */
export interface ObjectiveRating {
  score: number;
  comment: string;
}
export type Ratings = Record<string, ObjectiveRating>;

/** One employee's appraisal in one cycle. Made when the cycle starts. */
export interface Assessment {
  id: string;
  cycleId: string;
  employeeId: string;
  status: AssessmentStatus;
  /** Self ratings by objective id. */
  selfRatings: Ratings;
  /** Manager ratings by objective id. */
  managerRatings: Ratings;
  managerComment?: string;
  hrComment?: string;
  /** Why HR sent the manager's review back, while it waits to be redone. */
  rejectionReason?: string;
}

interface AppraisalAssessmentsStore {
  assessments: Assessment[];
  /** One assessment per employee; employees who already have one in the cycle are skipped. */
  createForCycle: (cycleId: string, employeeIds: string[]) => void;
  submitSelf: (id: string, ratings: Ratings) => void;
  submitManager: (id: string, ratings: Ratings, comment: string) => void;
  finalize: (id: string, hrComment: string) => void;
  /** HR sends the manager's review back to be redone. */
  rejectReview: (id: string, reason: string) => void;
  /** Cancelling or deleting a cycle takes its assessments with it. */
  removeForCycle: (cycleId: string) => void;
}

// Local-storage only until the appraisal backend exists.
export const useAppraisalAssessmentsStore = create<AppraisalAssessmentsStore>()(
  persist(
    (set) => {
      const patch = (id: string, next: Partial<Assessment>) =>
        set((s) => ({
          assessments: s.assessments.map((a) => (a.id === id ? { ...a, ...next } : a)),
        }));
      return {
        assessments: [],
        createForCycle: (cycleId, employeeIds) =>
          set((s) => {
            const existing = new Set(
              s.assessments.filter((a) => a.cycleId === cycleId).map((a) => a.employeeId),
            );
            const created: Assessment[] = employeeIds
              .filter((employeeId) => !existing.has(employeeId))
              .map((employeeId) => ({
                id: crypto.randomUUID(),
                cycleId,
                employeeId,
                status: 'NOT_STARTED',
                selfRatings: {},
                managerRatings: {},
              }));
            return { assessments: [...created, ...s.assessments] };
          }),
        submitSelf: (id, ratings) => patch(id, { selfRatings: ratings, status: 'SELF_SUBMITTED' }),
        submitManager: (id, ratings, comment) =>
          patch(id, {
            managerRatings: ratings,
            managerComment: comment,
            status: 'MANAGER_SUBMITTED',
          }),
        finalize: (id, hrComment) =>
          patch(id, { hrComment, status: 'FINALIZED', rejectionReason: undefined }),
        rejectReview: (id, reason) =>
          patch(id, { status: 'SELF_SUBMITTED', rejectionReason: reason }),
        removeForCycle: (cycleId) =>
          set((s) => ({ assessments: s.assessments.filter((a) => a.cycleId !== cycleId) })),
      };
    },
    { name: 'appraisal-assessments' },
  ),
);
