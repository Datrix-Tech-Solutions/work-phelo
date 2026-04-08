export type Frequency = 'Annual' | 'Semi-annual' | 'Quarterly' | 'Ad-hoc';
export type AppraisalStatus = 'Upcoming' | 'InProgress' | 'Completed' | 'Cancelled';
export type SectionType = 'RatingScale' | 'FreeText' | 'YesNo';
export type ResponseRole = 'Self' | 'Manager';
export type FinalizedStatus = 'Pending' | 'Approved' | 'Cancelled';
export type EmployeeAppraisalStatus =
  | 'NotStarted'
  | 'SelfSubmitted' // employee done and waiting on manager
  | 'ManagerSubmitted' // manager done and waiting on HR
  | 'HRPending' // HR has opened it and is actively reviewing
  | 'Finalized'; // HR approved or cancelled

export type FinalRating =
  | 'Outstanding' // >= 90
  | 'Very Good' // >= 80
  | 'Good' // >= 70
  | 'Satisfactory' // >= 60
  | 'Needs Improvement'; // < 60

// ── Performance Band ─────────────────────────────────────
// Supports future dynamic configuration (bands can be fetched from the API)
export interface PerformanceBand {
  rating: FinalRating;
  minPercent: number; // lower bound (inclusive)
  maxPercent: number; // upper bound (exclusive), 100 for top band
  label: string; // display label — matches rating by default
  textColor: string; // e.g. '#ffffff'
  backgroundColor: string; // e.g. '#16a34a'
}

// Default bands — used as fallback when no dynamic config is loaded
export const DEFAULT_PERFORMANCE_BANDS: PerformanceBand[] = [
  {
    rating: 'Outstanding',
    minPercent: 90,
    maxPercent: 100,
    label: 'Outstanding',
    textColor: '#ffffff',
    backgroundColor: '#16a34a',
  },
  {
    rating: 'Very Good',
    minPercent: 80,
    maxPercent: 90,
    label: 'Very Good',
    textColor: '#ffffff',
    backgroundColor: '#2563eb',
  },
  {
    rating: 'Good',
    minPercent: 70,
    maxPercent: 80,
    label: 'Good',
    textColor: '#ffffff',
    backgroundColor: '#0891b2',
  },
  {
    rating: 'Satisfactory',
    minPercent: 60,
    maxPercent: 70,
    label: 'Satisfactory',
    textColor: '#92400e',
    backgroundColor: '#fef3c7',
  },
  {
    rating: 'Needs Improvement',
    minPercent: 0,
    maxPercent: 60,
    label: 'Needs Improvement',
    textColor: '#ffffff',
    backgroundColor: '#dc2626',
  },
];

// ── Template ─────────────────────────────────────────────
export interface AppraisalTemplate {
  id: string;
  tenantSlug: string;
  name: string;
  description?: string;
  sections: AppraisalSection[];
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AppraisalSection {
  id: string;
  templateId: string;
  name: string;
  type: SectionType;
  ratingScaleRange?: number; // 3, 5, 10 (only for RatingScale)
  order: number;
  isRequired: boolean;
}

// ── Cycle ────────────────────────────────────────────────
export interface AppraisalCycle {
  id: string;
  tenantId: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  _count?: { appraisals: number };
}

// ── KPI Definition (HR sets per cycle) ───────────────────
export interface AppraisalKpi {
  id: string;
  cycleId: string;
  tenantSlug: string;
  title: string;
  description?: string;
  weight: number; // % contribution to total score (all must sum to 100)
  maxScore: number; // e.g. 5 or 10
  selfWeight: number; // 0–100, employee's share of the blended score
  managerWeight: number; // 0–100, manager's share (selfWeight + managerWeight = 100)
}

// ── One Employee's Appraisal Instance ────────────────────
// Central entity that moves through the full workflow
export interface EmployeeAppraisal {
  id: string;
  cycleId: string;
  employeeId: string;
  tenantSlug: string;
  selfResponse?: AppraisalResponse;
  managerResponse?: AppraisalResponse;
  finalizedAppraisal?: FinalizedAppraisal;
  overallStatus: EmployeeAppraisalStatus;
  createdAt: string;
  updatedAt: string;
}

// ── Response (Self or Manager) ───────────────────────────
export interface AppraisalResponse {
  id: string;
  employeeAppraisalId: string;
  role: ResponseRole;
  kpiScores: KpiScore[];
  sectionResponses: SectionResponse[];
  submittedAt?: string; // undefined while status = 'Draft'
  status: 'Draft' | 'Submitted';
}

export interface KpiScore {
  kpiId: string;
  score: number; // raw score (e.g. 4 out of 5)
  comment?: string; // optional comment from the respondent
}

export interface SectionResponse {
  sectionId: string;
  rating?: number; // for RatingScale
  comment?: string; // for FreeText / Comments
  yesNo?: boolean; // for YesNo
}

// ── Score Breakdown (computed at finalization) ───────────

export interface KpiScoreBreakdown {
  kpiId: string;
  kpiTitle: string;
  weight: number;
  maxScore: number;
  selfWeight: number;
  managerWeight: number;
  selfScore: number;
  selfComment?: string; // employee's comment on this KPI
  managerScore: number;
  managerComment?: string; // manager's comment on this KPI
  selfWeighted: number; // (selfScore / maxScore) * weight
  managerWeighted: number; // (managerScore / maxScore) * weight
  weightedContribution: number; // (selfWeighted * selfWeight%) + (managerWeighted * managerWeight%)
}

// ── HR List View ─────────────────────────────────────────
// One row in the HR review list — pre-computed from the two submitted responses
export interface AppraisalReviewSummary {
  employeeAppraisalId: string;
  cycleId: string;
  tenantSlug: string;
  employeeId: string;
  employeeName: string;
  department: string;
  selfScorePercent: number; // employee's weighted score as % of 100
  managerScorePercent: number; // manager's weighted score as % of 100
  selfSubmittedAt: string;
  managerSubmittedAt: string;
  finalizationStatus: FinalizedStatus;
}

// ── Finalized by HR ──────────────────────────────────────
export interface FinalizedAppraisal {
  id: string;
  employeeAppraisalId: string;
  cycleId: string;
  tenantSlug: string;
  employeeId: string;
  kpiBreakdown: KpiScoreBreakdown[]; // full per-KPI audit trail with both sides comments
  overallScore: number; // 0 – 100
  finalRating: FinalRating;
  status: FinalizedStatus; // Pending → Approved | Cancelled
  hrComments?: string;
  finalizedBy: string;
  finalizedAt: string; // when HR created this finalization record
  actionedAt?: string; // when HR approved or cancelled
  employeeVisible: boolean; // true once HR approves and releases to employee
}

// ── DTOs ─────────────────────────────────────────────────
export interface CreateAppraisalTemplateDto {
  tenantSlug: string;
  name: string;
  description?: string;
  sections: Omit<AppraisalSection, 'id' | 'templateId'>[];
}

export interface CreateAppraisalCycleDto {
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
}

export interface CreateAppraisalKpiDto {
  cycleId: string;
  title: string;
  description?: string;
  weight: number;
  maxScore: number;
  selfWeight: number;
  managerWeight: number;
}

export interface SubmitAppraisalResponseDto {
  employeeAppraisalId: string;
  role: ResponseRole;
  kpiScores: KpiScore[];
  sectionResponses: SectionResponse[];
}

export interface ReleaseAppraisalResultDto {
  employeeAppraisalIds: string[]; // release one or many at once
}

export interface FinalizeAppraisalDto {
  status: 'Approved' | 'Cancelled';
  hrComments?: string;
}

// ── Cycle summary (list view — includes computed completion stats) ─────────
export interface AppraisalCycleSummary extends AppraisalCycle {
  totalEmployees: number;
  completedCount: number;
  completionRate: number; // 0–100
}

// ── Cycle results (HR results view) ──────────────────────────────────────
export interface CycleResultItem {
  id: string; // employeeAppraisalId
  employeeId: string;
  employeeName: string;
  department: string;
  jobTitle: string;
  managerName: string;
  overallScore: number; // 0–100
  finalRating: FinalRating;
  reviewCompletedAt: string;
}

export interface CycleResultsSummary {
  totalEmployees: number;
  reviewedCount: number;
  completionRate: number; // 0–100
  ratingDistribution: {
    rating: FinalRating;
    count: number;
    percentage: number;
  }[];
  results: CycleResultItem[];
}

// ── Page-level View Models ────────────────────────────────
// Employee's own appraisal row (self view)
export interface MyAppraisalRow {
  id: string;
  cycleId: string;
  cycleName: string;
  cycleStatus: AppraisalStatus;
  overallStatus: EmployeeAppraisalStatus;
  overallScore?: number;
  finalRating?: FinalRating;
  selfAssessmentDeadline: string;
}

// Manager's team review row
export interface TeamReviewRow {
  id: string;
  employeeId: string;
  employeeName: string;
  cycleId: string;
  cycleName: string;
  selfSubmittedAt?: string;
  managerReviewDeadline: string;
  overallStatus: EmployeeAppraisalStatus;
}
