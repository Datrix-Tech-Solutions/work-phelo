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

// ── Shared Enums ─────────────────────────────────────────
export type Gender = 'MALE' | 'FEMALE' | 'OTHER';
export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED';
export type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
export type EmploymentStatus =
  | 'ACTIVE'
  | 'PROBATION'
  | 'ON_LEAVE'
  | 'SUSPENDED'
  | 'TERMINATED'
  | 'OFFBOARDED';
export type AllowanceType = 'TRANSPORT' | 'HOUSING' | 'MEDICAL' | 'OTHER';
export type DocumentType =
  | 'CONTRACT'
  | 'ID_CARD'
  | 'PASSPORT'
  | 'CERTIFICATE'
  | 'OFFER_LETTER'
  | 'NDA'
  | 'OTHER';

// ── Employee ─────────────────────────────────────────────
export interface Employee {
  id: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  gender?: Gender;
  dateOfBirth?: string;
  maritalStatus?: MaritalStatus;
  nationality?: string;
  address?: string;
  city?: string;
  region?: string;
  jobTitle: string;
  employmentType: EmploymentType;
  employmentStatus: EmploymentStatus;
  hireDate: string;
  probationEndsAt?: string;
  contractEndDate?: string;
  basicSalary?: number;
  departmentId?: string;
  department?: Department;
  branchId?: string;
  branch?: Branch;
  managerId?: string;
  userId?: string;
  userStatus?: 'PENDING_VERIFICATION' | 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  avatarUrl?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankBranch?: string;
  nationalId?: string;
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
  allowances?: EmployeeAllowance[];
  offboarding?: OffboardingRecord;
}

export interface EmployeeAllowance {
  id: string;
  employeeId: string;
  type: AllowanceType;
  amount: number;
  description?: string;
  effectiveFrom: string;
  createdAt: string;
}

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  type: DocumentType;
  url: string;
  name: string;
  createdAt: string;
}

export interface AddAllowancePayload {
  type: AllowanceType;
  amount: number;
  description?: string;
  effectiveFrom: string;
}

export interface UploadDocumentPayload {
  type: DocumentType;
  url: string;
  name: string;
}

export interface UpdateEmployeePayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: Gender;
  maritalStatus?: MaritalStatus;
  nationality?: string;
  nationalId?: string;
  address?: string;
  city?: string;
  region?: string;
  jobTitle?: string;
  departmentId?: string;
  branchId?: string;
  managerId?: string;
  probationEndsAt?: string;
  contractEndDate?: string;
  employmentType?: EmploymentType;
  employmentStatus?: EmploymentStatus;
  basicSalary?: number;
  bankName?: string;
  bankAccountNumber?: string;
  bankBranch?: string;
  ssnit?: string;
  tinNumber?: string;
  avatarUrl?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
}

export interface CreateEmployeePayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  gender?: Gender;
  dateOfBirth?: string;
  maritalStatus?: MaritalStatus;
  nationality?: string;
  address?: string;
  city?: string;
  region?: string;
  jobTitle: string;
  employmentType: EmploymentType;
  hireDate: string;
  basicSalary?: number;
  departmentId: string;
  branchId?: string;
  managerId?: string;
  probationEndsAt?: string;
  contractEndDate?: string;
  nationalId?: string;
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
export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

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
export type PayrollRunStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PAID';

export interface PayrollRun {
  id: string;
  month: number;
  year: number;
  status: PayrollRunStatus;
  notes?: string;
  totalGross: string;
  totalNet: string;
  totalSSNIT: string;
  totalTier3: string;
  totalPAYE: string;
  runBy: string;
  submittedBy?: string | null;
  submittedAt?: string | null;
  approvedBy?: string;
  approvedAt?: string;
  paidAt?: string;
  tier3Enabled: boolean;
  tier3Rate?: string | null;
  tier3SchemeName?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface PayrollRunEmployeeSummary {
  firstName: string;
  lastName: string;
  employeeNumber: string;
  jobTitle: string;
  bankName?: string | null;
  bankAccountNumber?: string | null;
}

export interface PayrollItem {
  id: string;
  tenantId: string;
  payrollRunId: string;
  employeeId: string;
  basicSalary: string;
  totalAllowances: string;
  transportAmount: string;
  otherDeductions: string;
  overtimePay: string;
  bonus: string;
  thirteenthMonth: string;
  grossSalary: string;
  employeeSSNIT: string;
  employerSSNIT: string;
  tier3Employee: string;
  taxableIncome: string;
  payeTax: string;
  totalDeductions: string;
  netSalary: string;
  createdAt: string;
  updatedAt?: string;
  employee?: PayrollRunEmployeeSummary;
  payrollRun?: {
    month: number;
    year: number;
    status: PayrollRunStatus;
    paidAt?: string | null;
    tier3Enabled: boolean;
    tier3Rate?: string | null;
    tier3SchemeName?: string | null;
  };
}

export interface PayrollRunDetail extends PayrollRun {
  items: PayrollItem[];
}

export interface RunPayrollDto {
  month: number;
  year: number;
  notes?: string;
}

export interface UpdatePayrollItemDto {
  basicSalary?: number;
  totalAllowances?: number;
  transportAmount?: number;
  otherDeductions?: number;
}

export interface PayrollSettings {
  payrollTier3Enabled: boolean;
  payrollTier3Rate: number | null;
  payrollTier3SchemeName: string | null;
}

export interface UpdatePayrollSettingsDto {
  payrollTier3Enabled?: boolean;
  payrollTier3Rate?: number;
  payrollTier3SchemeName?: string;
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
  name: string;
  department: string;
  dateOfBirth: string;
  upcomingBirthday: string;
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

export type ResignationReason =
  | 'PERSONAL_REASONS'
  | 'BETTER_OPPORTUNITY'
  | 'RELOCATION'
  | 'FURTHER_EDUCATION'
  | 'HEALTH_REASONS'
  | 'OTHER';

export type ResignationStatus = 'PENDING' | 'DISMISSED' | 'WITHDRAWN' | 'OFFBOARDING_INITIATED';

export interface ResignationRecord {
  id: string;
  tenantId: string;
  employeeId: string;
  lastWorkingDate: string;
  reason?: ResignationReason;
  additionalNotes?: string;
  status: ResignationStatus;
  submittedAt: string;
  withdrawnAt?: string;
  dismissedAt?: string;
  offboardingInitiatedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResignationPayload {
  lastWorkingDate: string;
  reason?: ResignationReason;
  additionalNotes?: string;
}

export interface UpdateChecklistDto {
  item: 'assetReturn' | 'hrClearance' | 'financeClearance' | 'reportingClearance';
  done: boolean;
}

// ── Pagination ────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  totalPages: number;
  totalCount: number;
  currentPage: number;
}

// ── Appraisal ─────────────────────────────────────────────
export type Frequency = 'ANNUAL' | 'SEMI_ANNUAL' | 'QUARTERLY' | 'AD_HOC';
export type AppraisalStatus = 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type AppraisalEligibleEmploymentStatus = 'ACTIVE' | 'PROBATION' | 'SUSPENDED';
export type SectionType = 'RatingScale' | 'FreeText' | 'YesNo';
export type ResponseRole = 'Self' | 'Reviewer';
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
  selfAssessmentWeight: number;
  managerAssessmentWeight: number;
  kpis: AppraisalTemplateKpi[];
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface AppraisalTemplateKpi {
  id: string;
  templateId: string;
  title: string;
  weight: number;
  maxScore: number;
  description?: string;
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
  frequency?: Frequency;
  description?: string;
  startDate: string;
  endDate: string;
  selfAssessmentDeadline?: string;
  managerReviewDeadline?: string;
  templateId?: string;
  departmentIds?: string[];
  employmentTypes?: string[];
  employmentStatuses?: AppraisalEligibleEmploymentStatus[];
  employeeIds?: string[];
  selfAssessmentWeight?: number;
  managerAssessmentWeight?: number;
  status?: AppraisalStatus;
  isActive: boolean;
  activatedAt?: string;
  cancelledAt?: string;
  cancelledReason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  completionRate?: number;
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
  name: string;
  selfAssessmentWeight: number;
  managerAssessmentWeight: number;
  kpis: Omit<AppraisalTemplateKpi, 'id' | 'templateId'>[];
}

export interface CreateAppraisalCycleDto {
  title: string;
  frequency: Frequency;
  description?: string;
  startDate: string;
  endDate: string;
  selfAssessmentDeadline: string;
  managerReviewDeadline: string;
  templateId: string;
  departmentIds?: string[];
  employmentTypes?: string[];
  employmentStatuses?: AppraisalEligibleEmploymentStatus[];
  employeeIds?: string[];
}

export interface AppraisalSettings {
  appraisalEligibleStatuses: AppraisalEligibleEmploymentStatus[];
  outstandingThreshold: number;
  veryGoodThreshold: number;
  goodThreshold: number;
  satisfactoryThreshold: number;
}

export type CompanyPolicyProbationPeriod = '3' | '4' | '5' | '6' | 'undefined';

export type CompanyPolicyResignationWindow = '1w' | '2w' | '1m' | '2m' | '3m' | '6m' | '1y' | '2y';

export type CompanyPolicyCycleRecipient =
  | 'all'
  | 'permanent'
  | 'contractual'
  | 'probation'
  | 'interns';

export interface CompanyPoliciesSettings {
  probationPeriod: CompanyPolicyProbationPeriod;
  resignationWindow: CompanyPolicyResignationWindow;
  cycleRecipients: CompanyPolicyCycleRecipient[];
  defaultProbationPeriodMonths: number | null;
  resignationNoticePeriodDays: number;
}

export interface UpdateCompanyPoliciesDto {
  probationPeriod?: CompanyPolicyProbationPeriod;
  resignationWindow?: CompanyPolicyResignationWindow;
  cycleRecipients?: CompanyPolicyCycleRecipient[];
}

export type CompanyAgreementType =
  | 'NDA'
  | 'EMPLOYMENT_CONTRACT'
  | 'CONFIDENTIALITY'
  | 'NON_COMPETE'
  | 'CODE_OF_CONDUCT'
  | 'IP_ASSIGNMENT'
  | 'PROBATION_AGREEMENT'
  | 'OTHER';

export interface CompanyAgreement {
  id: string;
  tenantId: string;
  type: CompanyAgreementType;
  title: string;
  details: string;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyAgreementDto {
  type: CompanyAgreementType;
  title: string;
  details: string;
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
  selfScore?: number;
  managerScore?: number;
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
