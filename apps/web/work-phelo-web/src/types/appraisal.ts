import type { Frequency } from '@/types/hr';

export interface Goal {
  id: string;
  name: string;
  selfAssessmentWeight: number;
  managerAssessmentWeight: number;
  /** The employees the goal is for. */
  employeeIds: string[];
  /** Whether a cycle runs it; such a goal cannot be deleted. */
  inCycle?: boolean;
}
export type GoalInput = Omit<Goal, 'id' | 'inCycle'>;

export type GoalCycleStatus = 'UPCOMING' | 'ACTIVE' | 'CLOSED' | 'CANCELLED';

export interface GoalCycle {
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
  status: GoalCycleStatus;
  cancelledReason?: string;
  /** The day it was cancelled (YYYY-MM-DD). */
  cancelledAt?: string;
  /** The day it was closed (YYYY-MM-DD), by hand or when every assessment was approved. */
  closedAt?: string;
  /** Progress across the cycle's assessments; only on the cycle list. */
  stats?: { employees: number; done: number; allApproved: boolean };
}
export type CycleInput = Pick<
  GoalCycle,
  | 'title'
  | 'description'
  | 'frequency'
  | 'startDate'
  | 'endDate'
  | 'selfAssessmentDeadline'
  | 'managerReviewDeadline'
  | 'goalIds'
>;

export type AssessmentStatus = 'NOT_STARTED' | 'SELF_SUBMITTED' | 'MANAGER_SUBMITTED' | 'FINALIZED';

/** A rating and optional comment on one of the employee's objectives. */
export interface ObjectiveRating {
  score: number;
  comment: string;
}
export type Ratings = Record<string, ObjectiveRating>;

/** A goal in the assessment with the objectives rated under it, as they stood when the cycle started. */
export interface AssessmentEntry {
  goal: {
    id: string;
    name: string;
    selfAssessmentWeight: number;
    managerAssessmentWeight: number;
  };
  objectives: { id: string; name: string }[];
}

/** One employee's appraisal in one cycle. Made when the cycle starts. */
export interface Assessment {
  id: string;
  cycleId: string;
  employeeId: string;
  managerId: string | null;
  status: AssessmentStatus;
  /** Self ratings by objective id. */
  selfRatings: Ratings;
  /** Manager ratings by objective id. */
  managerRatings: Ratings;
  managerComment?: string;
  hrComment?: string;
  /** Why HR sent the manager's review back, while it waits to be redone. */
  rejectionReason?: string;
  entries: AssessmentEntry[];
}

export interface ObjectiveComment {
  id: string;
  body: string;
  createdAt: string;
}

export interface EmployeeObjective {
  id: string;
  employeeId: string;
  /** Empty while the objective has no goal. */
  goalId: string | null;
  goal?: { id: string; name: string } | null;
  name: string;
  createdByName: string;
  /** When it was attached to its goal; the date cycles compare against. */
  linkedAt: string | null;
  createdAt: string;
  comments: ObjectiveComment[];
}
