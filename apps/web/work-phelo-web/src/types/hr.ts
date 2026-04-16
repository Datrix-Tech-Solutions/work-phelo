// ── Branch ───────────────────────────────────────────────
export interface Branch {
  id: string;
  name: string;
  code?: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  phone?: string;
  email?: string;
  managerId?: string;
  isActive: boolean;
  isHeadOffice: boolean;
  _count?: { employees: number };
}

// ── Department ───────────────────────────────────────────
export interface Department {
  id: string;
  name: string;
  description?: string;
  managerId?: string;
  isActive: boolean;
  _count?: { employees: number };
}

// ── Employee ─────────────────────────────────────────────
export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  gender?: 'MALE' | 'FEMALE' | 'OTHER';
  dateOfBirth?: string;
  maritalStatus?: string;
  nationality?: string;
  nationalID?: string;
  address?: string;
  city?: string;
  region?: string;
  jobTitle: string;
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
  employmentStatus: 'ACTIVE' | 'PROBATION' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED' | 'OFFBOARDED';
  hireDate: string;
  basicSalary?: number;
  departmentId?: string;
  department?: Department;
  branchId?: string;
  branch?: Branch;
  managerId?: string;
  userId?: string;
  avatarUrl?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankBranch?: string;
  ssnit?: string;
  tinNumber?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
  statusChangedAt?: string;
  statusChangedByEmail?: string;
  offboardedAt?: string;
  createdAt?: string;
  assets?: import('@/types/asset').EmployeeAsset[];
  offboarding?: OffboardingRecord;
}

export interface UpdateEmployeePayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  maritalStatus?: string;
  nationality?: string;
  nationalID?: string;
  address?: string;
  city?: string;
  region?: string;
  jobTitle?: string;
  departmentId?: string;
  branchId?: string;
  employmentType?: string;
  employmentStatus?: string;
  basicSalary?: number;
  bankName?: string;
  bankAccountNumber?: string;
  bankBranch?: string;
  ssnit?: string;
  tinNumber?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
}

export interface CreateEmployeePayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  jobTitle: string;
  employmentType: string;
  hireDate: string;
  basicSalary?: number;
  departmentId: string;
  branchId?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankBranch?: string;
  ssnit?: string;
  tinNumber?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
}

// ── Leave Type ───────────────────────────────────────────
export type LeaveApplicableTo = 'ALL' | 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';

export interface LeaveType {
  id: string;
  tenantId: string;
  name: string;
  isPaid: boolean;
  daysAllowed: number;
  isCarryOver: boolean;
  maxCarryOverDays?: number | null;
  requiresApproval: boolean;
  requiresDocument?: boolean;
  documentTemplateUrl?: string;
  applicableTo?: LeaveApplicableTo[];
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateLeaveTypeDto {
  name: string;
  isPaid: boolean;
  daysAllowed: number;
  isCarryOver: boolean;
  maxCarryOverDays?: number;
  requiresApproval: boolean;
  requiresDocument?: boolean;
  documentTemplateUrl?: string;
  applicableTo?: LeaveApplicableTo[];
}

export type UpdateLeaveTypeDto = Partial<CreateLeaveTypeDto>;

// ── Public Holiday ───────────────────────────────────────
export interface PublicHoliday {
  id: string;
  tenantId: string;
  name: string;
  date: string;
  createdAt: string;
}

export interface CreatePublicHolidayDto {
  name: string;
  date: string;
}

export type UpdatePublicHolidayDto = Partial<CreatePublicHolidayDto>;

// ── Leave Request ─────────────────────────────────────────
export type LeaveRequestStatus = 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export interface LeaveRequest {
  id: string;
  tenantSlug: string;
  employeeId: string;
  employeeName: string;
  leaveTypeId: string;
  leaveTypeName: string;
  isPaid: boolean;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
  documentationUrl?: string;
  status: LeaveRequestStatus;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateLeaveRequestDto {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
  documentationUrl?: string;
}

export interface ReviewLeaveRequestDto {
  action: 'APPROVED' | 'REJECTED';
  note?: string;
}

// ── Leave Balance ─────────────────────────────────────────
export interface LeaveBalance {
  leaveTypeId: string;
  leaveTypeName: string;
  entitled: number;
  used: number;
  pending: number;
  remaining: number;
  carriedOver: number;
}

// ── Payroll ───────────────────────────────────────────────
export interface PayrollRun {
  id: string;
  month: number;
  year: number;
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'PAID';
  notes?: string;
  totalGross: string;
  totalNet: string;
  totalSSNIT: string;
  totalPAYE: string;
  runBy: string;
  approvedBy?: string;
  approvedAt?: string;
  paidAt?: string;
  createdAt: string;
}

// ── Project ───────────────────────────────────────────────
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  startDate: string;
  endDate?: string;
  budget?: number;
  managerId?: string;
  managerName?: string;
  assignedCount: number;
  createdAt: string;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  budget?: number;
  managerId?: string;
}

// ── Dashboard ─────────────────────────────────────────────
export interface UpcomingBirthday {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  avatarUrl?: string;
}

export interface DashboardSummary {
  adminFirstName: string;
  companyName: string;
  totalEmployees: number;
  activeEmployees: number;
  pendingLeaveRequests: number;
  assignedAssetsCount: number;
  hasEmployees: boolean;
}

// ── Employee Query Params ─────────────────────────────────
export interface EmployeeQuery {
  page?: number;
  limit?: number;
  search?: string;
  departmentId?: string;
  status?: string;
}

export type OffboardReason =
  | 'RESIGNATION'
  | 'TERMINATION'
  | 'CONTRACT_ENDED'
  | 'RETIREMENT'
  | 'REDUNDANCY'
  | 'OTHER';

export interface OffboardingRecord {
  id: string;
  tenantId: string;
  employeeId: string;
  reason: OffboardReason;
  otherReason?: string;
  lastWorkingDate: string;
  exitNotes?: string;
  isDraft: boolean;
  completedAt?: string;
  completedById?: string;
  completedByEmail?: string;
  assetReturnDone: boolean;
  assetReturnDoneById?: string;
  assetReturnDoneByEmail?: string;
  assetReturnDoneAt?: string;
  hrClearanceDone: boolean;
  hrClearanceDoneById?: string;
  hrClearanceDoneByEmail?: string;
  hrClearanceDoneAt?: string;
  financeClearanceDone: boolean;
  financeClearanceDoneById?: string;
  financeClearanceDoneByEmail?: string;
  financeClearanceDoneAt?: string;
  managerApprovalDone: boolean;
  managerApprovalDoneById?: string;
  managerApprovalDoneByEmail?: string;
  managerApprovalDoneAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InitiateOffboardDto {
  reason: OffboardReason;
  otherReason?: string;
  lastWorkingDate: string;
  exitNotes?: string;
}

export interface UpdateChecklistDto {
  item: 'assetReturn' | 'hrClearance' | 'financeClearance' | 'managerApproval';
  done: boolean;
}

export interface OffboardPayload {
  employeeId: string;
  offboardedAt: string;
  reason: string;
}

// ── Pagination ────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  totalPages: number;
  totalCount: number;
  currentPage: number;
}

// ── Appraisal ─────────────────────────────────────────────
export type Frequency = 'Annual' | 'Semi-annual' | 'Quarterly' | 'Ad-hoc';
export type AppraisalStatus = 'Upcoming' | 'InProgress' | 'Completed' | 'Cancelled';
export type SectionType = 'RatingScale' | 'FreeText' | 'YesNo';
export type ResponseRole = 'Self' | 'Manager';
export type FinalizedStatus = 'Pending' | 'Approved' | 'Cancelled';
export type EmployeeAppraisalStatus =
  | 'NotStarted'
  | 'SelfSubmitted'
  | 'ManagerSubmitted'
  | 'HRPending'
  | 'Finalized';

export type FinalRating =
  | 'Outstanding'
  | 'Very Good'
  | 'Good'
  | 'Satisfactory'
  | 'Needs Improvement';

export interface PerformanceBand {
  rating: FinalRating;
  minPercent: number;
  maxPercent: number;
  label: string;
  textColor: string;
  backgroundColor: string;
}

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
  ratingScaleRange?: number;
  order: number;
  isRequired: boolean;
}

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

export interface AppraisalKpi {
  id: string;
  cycleId: string;
  tenantSlug: string;
  title: string;
  description?: string;
  weight: number;
  maxScore: number;
  selfWeight: number;
  managerWeight: number;
}

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

export interface AppraisalResponse {
  id: string;
  employeeAppraisalId: string;
  role: ResponseRole;
  kpiScores: KpiScore[];
  sectionResponses: SectionResponse[];
  submittedAt?: string;
  status: 'Draft' | 'Submitted';
}

export interface KpiScore {
  kpiId: string;
  score: number;
  comment?: string;
}

export interface SectionResponse {
  sectionId: string;
  rating?: number;
  comment?: string;
  yesNo?: boolean;
}

export interface KpiScoreBreakdown {
  kpiId: string;
  kpiTitle: string;
  weight: number;
  maxScore: number;
  selfWeight: number;
  managerWeight: number;
  selfScore: number;
  selfComment?: string;
  managerScore: number;
  managerComment?: string;
  selfWeighted: number;
  managerWeighted: number;
  weightedContribution: number;
}

export interface AppraisalReviewSummary {
  employeeAppraisalId: string;
  cycleId: string;
  tenantSlug: string;
  employeeId: string;
  employeeName: string;
  department: string;
  selfScorePercent: number;
  managerScorePercent: number;
  selfSubmittedAt: string;
  managerSubmittedAt: string;
  finalizationStatus: FinalizedStatus;
}

export interface FinalizedAppraisal {
  id: string;
  employeeAppraisalId: string;
  cycleId: string;
  tenantSlug: string;
  employeeId: string;
  kpiBreakdown: KpiScoreBreakdown[];
  overallScore: number;
  finalRating: FinalRating;
  status: FinalizedStatus;
  hrComments?: string;
  finalizedBy: string;
  finalizedAt: string;
  actionedAt?: string;
  employeeVisible: boolean;
}

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
  employeeAppraisalIds: string[];
}

export interface FinalizeAppraisalDto {
  status: 'Approved' | 'Cancelled';
  hrComments?: string;
}

export interface AppraisalCycleSummary extends AppraisalCycle {
  totalEmployees: number;
  completedCount: number;
  completionRate: number;
}

export interface CycleResultItem {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string;
  jobTitle: string;
  managerName: string;
  overallScore: number;
  finalRating: FinalRating;
  reviewCompletedAt: string;
}

export interface CycleResultsSummary {
  totalEmployees: number;
  reviewedCount: number;
  completionRate: number;
  ratingDistribution: { rating: FinalRating; count: number; percentage: number }[];
  results: CycleResultItem[];
}

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
