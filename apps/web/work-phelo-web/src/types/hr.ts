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
  /** Trimmed member list returned by GET /hr/branches/:id (no contact details). */
  employees?: DepartmentMember[];
}

// ── Department ───────────────────────────────────────────
export interface Department {
  id: string;
  name: string;
  description?: string;
  managerId?: string;
  branchId?: string;
  branch?: Pick<Branch, 'id' | 'name'>;
  isActive: boolean;
  _count?: { employees: number };
  /** Trimmed member list returned by GET /hr/departments/:id (no contact details). */
  employees?: DepartmentMember[];
}

export type DepartmentMember = Pick<
  Employee,
  'id' | 'firstName' | 'lastName' | 'jobTitle' | 'employmentStatus'
>;

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
export type EmployeeCompensationType = 'SALARY' | 'COMMISSION' | 'SALARY_PLUS_COMMISSION';
export type PayrollTaxPolicy = 'STANDARD_PAYE' | 'FIXED_AMOUNT' | 'EXEMPT';
export type AllowanceType = 'TRANSPORT' | 'HOUSING' | 'MEDICAL' | 'CLOTHING' | 'OTHER';
export type DocumentType =
  | 'CONTRACT'
  | 'ID_CARD'
  | 'PASSPORT'
  | 'CERTIFICATE'
  | 'OFFER_LETTER'
  | 'NDA'
  | 'DRIVER_LICENCE'
  | 'OTHER';

// ── Employee ─────────────────────────────────────────────
export interface EmployeeOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  jobTitle: string;
  employmentStatus: EmploymentStatus;
  department?: { id: string; name: string };
  branch?: { id: string; name: string };
  avatarUrl?: string;
}

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
  compensationType?: EmployeeCompensationType;
  taxPolicy?: PayrollTaxPolicy;
  fixedTaxAmount?: number | null;
  commissionTaxable?: boolean;
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
  deductions?: EmployeeDeduction[];
  /** The payroll group the employee is paid through, set from the group's own page. */
  payrollGroupId?: string | null;
  offboarding?: OffboardingRecord;
}

export interface EmployeeAllowance {
  id: string;
  employeeId: string;
  type: AllowanceType;
  name: string;
  amount: number;
  effectiveFrom: string;
  effectiveTo?: string | null;
  createdAt: string;
}

export interface EmployeeDeduction {
  id: string;
  employeeId: string;
  name: string;
  totalAmount: number;
  monthlyRate: number;
  amountPaid: number;
  startDate: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateDeductionPayload {
  name: string;
  totalAmount: number;
  monthlyRate: number;
  startDate: string;
}

export interface UpdateDeductionPayload {
  name?: string;
  totalAmount?: number;
  monthlyRate?: number;
  startDate?: string;
}

export interface EmployeeDocument {
  id: string;
  employeeId: string;
  type: DocumentType;
  customType?: string | null;
  /** Short-lived signed read URL, resolved fresh on every fetch. */
  url: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  uploadedBy: string;
  expiresAt?: string | null;
  createdAt: string;
}

export type DriverLicenceStatus = 'NONE' | 'VALID' | 'EXPIRING' | 'EXPIRED';

/**
 * A driver's licence and what it amounts to. Driving yourself on a company trip needs the licence
 * unexpired and an image of it on file; removing the image switches it off without losing details.
 */
export interface DriverLicenceView {
  licence: {
    id: string;
    licenceNumber: string;
    /** YYYY-MM-DD */
    issuedAt: string;
    /** YYYY-MM-DD */
    expiresAt: string;
  } | null;
  imageOnFile: boolean;
  status: DriverLicenceStatus;
  /** Negative once expired; null when there is no licence. */
  daysLeft: number | null;
  canDrive: boolean;
}

export interface DriverLicenceDetails {
  licenceNumber: string;
  issuedAt: string;
  expiresAt: string;
}

export interface AddAllowancePayload {
  type: AllowanceType;
  amount: number;
  name?: string;
}

export interface UpdateAllowancePayload {
  type?: AllowanceType;
  amount?: number;
  name?: string;
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
  hireDate?: string;
  probationEndsAt?: string;
  contractEndDate?: string;
  employmentType?: EmploymentType;
  employmentStatus?: EmploymentStatus;
  basicSalary?: number;
  compensationType?: EmployeeCompensationType;
  taxPolicy?: PayrollTaxPolicy;
  fixedTaxAmount?: number | null;
  commissionTaxable?: boolean;
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
  dateOfBirth: string;
  maritalStatus?: MaritalStatus;
  nationality?: string;
  address?: string;
  city?: string;
  region?: string;
  jobTitle: string;
  employmentType: EmploymentType;
  hireDate: string;
  basicSalary?: number;
  compensationType?: EmployeeCompensationType;
  taxPolicy?: PayrollTaxPolicy;
  fixedTaxAmount?: number | null;
  commissionTaxable?: boolean;
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
  observedDate: string;
  countryScope: string;
  regionScope: string;
  isObservedShifted: boolean;
  createdAt: string;
}

export interface CreatePublicHolidayDto {
  name: string;
  date: string;
  countryScope?: string;
}

// ── Announcements ───────────────────────────────────────
export type AnnouncementAudienceType = 'ALL' | 'DEPARTMENTS' | 'BRANCHES' | 'EMPLOYEES';
export type AnnouncementDeliveryChannel = 'IN_APP' | 'EMAIL' | 'SMS';

export interface Announcement {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  audienceType: AnnouncementAudienceType;
  targetDepartmentIds: string[];
  targetBranchIds: string[];
  targetEmployeeIds: string[];
  sendEmail: boolean;
  deliveryChannels?: AnnouncementDeliveryChannel[];
  publishedAt: string;
  expiresAt?: string | null;
  createdById?: string | null;
  createdAt: string;
  updatedAt: string;
  isRead?: boolean;
}

export interface QueryAnnouncementsParams {
  page?: number;
  limit?: number;
  search?: string;
  audienceType?: AnnouncementAudienceType;
  sendEmail?: boolean;
  includeExpired?: boolean;
  view?: 'visible' | 'all';
}

export interface PaginatedAnnouncementsResponse {
  items: Announcement[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateAnnouncementPayload {
  title: string;
  body: string;
  audienceType?: AnnouncementAudienceType;
  departmentIds?: string[];
  branchIds?: string[];
  employeeIds?: string[];
  deliveryChannels?: AnnouncementDeliveryChannel[];
  sendEmail?: boolean;
  expiresAt?: string;
}

export type UpdateAnnouncementPayload = Partial<CreateAnnouncementPayload>;

export type UpdatePublicHolidayDto = Partial<CreatePublicHolidayDto>;

// ── Leave Request ─────────────────────────────────────────
export type LeaveRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveRequest {
  id: string;
  tenantSlug: string;
  employeeId: string;
  employeeName: string;
  employeeAvatarUrl?: string;
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
  coverageEmployee?: { id: string; firstName: string; lastName: string };
}

export interface CreateLeaveRequestDto {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason?: string;
  coverageEmployeeId?: string;
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
// All payroll types live in src/types/payroll.ts — re-exported here for backward compatibility.
export type {
  PayrollRunStatus,
  PayrollCountry,
  PayrollRun,
  PayrollRunEmployeeSummary,
  PayrollItemAllowance,
  PayrollItemDeduction,
  PayrollItem,
  PayrollItemLine,
  PayrollRunDetail,
  PayrollLedgerPaymentState,
  PayrollLedgerLineStatus,
  PayrollSettlementStatus,
  PayrollAccountingStatus,
  PayrollDecisionDto,
  RunPayrollDto,
  RunConfiguredPayrollDto,
  ApprovePayrollMonthResult,
  UpdatePayrollItemDto,
  PayrollSettings,
  UpdatePayrollSettingsDto,
  PayslipCompanyInfo,
  PayslipEmployeeInfo,
  PayslipYTD,
  EmployeeOverride,
  DeductionLineItem,
  DraftLoadData,
} from './payroll';

// ── Project ───────────────────────────────────────────────
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

export interface ProjectMilestone {
  id: string;
  name: string;
  amount: number;
  dueDate?: string;
}

/** What a billable client project charges, by how it is billed. */
export type ProjectPricing =
  | { type: 'FLAT_RATE'; price: number }
  | { type: 'TIMED'; hourlyRate: number; estimatedHours: number }
  | { type: 'MILESTONE'; milestones: ProjectMilestone[] }
  | { type: 'RETAINER'; monthlyAmount: number };

/** How a billable client project is charged. */
export type ProjectBillingType = 'FLAT_RATE' | 'TIMED' | 'MILESTONE' | 'RETAINER';

export type ProjectType =
  | 'CLIENT'
  | 'INTERNAL'
  | 'RESEARCH'
  | 'IMPLEMENTATION'
  | 'OPERATIONS'
  | 'OTHER';

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
  progress?: number;
  createdAt: string;
  /** What kind of project it is. Missing for one made before types existed. */
  kind?: ProjectType | null;
  /** Name of the template it started from; null for a blank slate. */
  templateName?: string | null;
  /** The project's own workflow, work types, tabs and priority levels. `{}` for one made before set-ups existed. */
  config?: Partial<ProjectConfig>;
  /** The marketing client a client project is for, with its name as it was last read. */
  clientId?: string | null;
  clientName?: string | null;
  billable?: boolean;
  /** How a billable client project is charged. */
  pricing?: ProjectPricing;
}

export interface CreateProjectDto {
  name: string;
  description?: string;
  startDate: string;
  endDate?: string;
  budget?: number;
  managerId?: string;
  kind: ProjectType;
  config: ProjectConfig;
  templateName?: string;
  clientId?: string;
  clientName?: string;
  billable?: boolean;
  /** Milestones are sent without their local ids. */
  pricing?:
    | ProjectPricing
    | (Omit<Extract<ProjectPricing, { type: 'MILESTONE' }>, 'milestones'> & {
        milestones: Omit<ProjectMilestone, 'id'>[];
      });
}

export type UpdateProjectDto = Partial<CreateProjectDto> & { status?: ProjectStatus };

export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'ON_HOLD' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type ProjectMemberRole = 'OWNER' | 'MANAGER' | 'MEMBER';

export interface ProjectTask {
  id: string;
  tenantId: string;
  projectId: string;
  name: string;
  description?: string | null;
  status: TaskStatus;
  priority?: TaskPriority | null;
  dueDate?: string | null;
  assignedEmployeeId?: string | null;
  assignedEmployeeName?: string;
  completedAt?: string | null;
  createdByUserId?: string;
  createdAt: string;
  updatedAt?: string;
  /** The workflow stage the task sits in; `status` follows it. */
  stage?: string | null;
  /** Names from the project's own set-up. */
  workType?: string | null;
  priorityName?: string | null;
  /** Whether time is tracked on the task. */
  isTimed?: boolean;
  objectiveId?: string | null;
  sprintId?: string | null;
  /** Everyone the task is assigned to. */
  assignees?: TaskAssignee[];
}

/** One person a task is assigned to. */
export interface TaskAssignee {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface ProjectMember {
  id: string;
  employeeId: string;
  role: ProjectMemberRole;
  joinedAt: string;
  name: string;
  email: string;
  jobTitle: string;
  department: string | null;
  avatarUrl?: string;
}

export interface ProjectDetail extends Project {
  tasks: ProjectTask[];
  members: ProjectMember[];
}

export interface MyTask extends ProjectTask {
  project: { id: string; name: string; status: ProjectStatus };
}

export interface ProjectActivity {
  id: string;
  tenantId: string;
  projectId: string;
  taskId?: string | null;
  actorUserId: string;
  actorEmployeeId?: string | null;
  type: string;
  message: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface CreateProjectTaskDto {
  name: string;
  description?: string;
  dueDate?: string;
  priority?: TaskPriority;
  assignedEmployeeId?: string;
  stage?: string;
  workType?: string;
  priorityName?: string;
  isTimed?: boolean;
  objectiveId?: string;
  /** Everyone the task is assigned to. */
  assigneeIds?: string[];
}

export type UpdateProjectTaskDto = Omit<Partial<CreateProjectTaskDto>, 'objectiveId'> & {
  status?: TaskStatus;
  /** null takes the task out of its objective. */
  objectiveId?: string | null;
};

export interface AddProjectMemberDto {
  employeeId: string;
  role?: ProjectMemberRole;
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

export type UpcomingEventType =
  | 'BIRTHDAY'
  | 'WORK_ANNIVERSARY'
  | 'PROBATION_ENDS'
  | 'CONTRACT_ENDS';

export interface UpcomingEvent {
  id: string;
  type: UpcomingEventType;
  employeeId: string;
  employeeName: string;
  department: string | null;
  avatarUrl: string | null;
  /** YYYY-MM-DD. */
  date: string;
  /** Years of service for an anniversary; null for the other types. */
  years: number | null;
}

export interface OutTodayEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  department: string | null;
  avatarUrl: string | null;
  leaveType: string;
  /** Last day of the leave, YYYY-MM-DD. */
  endDate: string;
}

export interface PayrollStatusRun {
  id: string;
  payslipKey: string;
  status: 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PAID';
  totalNet: number;
  employees: number;
}

export interface PayrollStatus {
  period: { month: number; year: number } | null;
  currency: string;
  runs: PayrollStatusRun[];
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

export interface PendingActions {
  leaveRequests: number;
  timeCorrections: number;
  shiftSwaps: number;
  resignations: number;
  payrollApprovals: number;
  appraisalFinalizations: number;
  probationEnding: number;
  contractsEnding: number;
  endingWithinDays: number;
}

export type RecentActivityType =
  | 'HIRED'
  | 'STATUS_CHANGED'
  | 'OFFBOARDED'
  | 'OFFBOARDING_INITIATED'
  | 'RESIGNATION_SUBMITTED'
  | 'RESIGNATION_WITHDRAWN'
  | 'RESIGNATION_DISMISSED'
  | 'LEAVE_APPROVED'
  | 'LEAVE_REJECTED'
  | 'TIME_CORRECTION_APPROVED'
  | 'TIME_CORRECTION_REJECTED';

export interface RecentActivityEvent {
  id: string;
  type: RecentActivityType;
  employeeId: string;
  employeeName: string;
  detail: string | null;
  actor: string | null;
  timestamp: string;
}

export interface DepartmentDistribution {
  distribution: {
    department: string;
    count: number;
    gender: { male: number; female: number; other: number; unspecified: number };
  }[];
  hasData: boolean;
}

export interface HrDashboardKpis {
  headcount: { current: number; previous: number; onProbation: number; suspended: number };
  attendance: {
    rate: number | null;
    previousRate: number | null;
    late: number;
    absent: number;
  };
  onLeave: { current: number; previous: number; today: number; pending: number };
  hiresAndExits: {
    hires: number;
    previousHires: number;
    exits: number;
    previousExits: number;
    turnoverRate: number | null;
    previousTurnoverRate: number | null;
  };
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

export interface UpdateAppraisalSettingsDto {
  appraisalEligibleStatuses?: AppraisalEligibleEmploymentStatus[];
  outstandingThreshold?: number;
  veryGoodThreshold?: number;
  goodThreshold?: number;
  satisfactoryThreshold?: number;
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

export type CompanyAgreementState = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
export type CompanyAgreementSignatureStatus = 'SIGNED' | 'DECLINED' | 'REVOKED';

export interface CompanyAgreement {
  id: string;
  tenantId: string;
  type: CompanyAgreementType;
  title: string;
  details: string;
  documentUrl?: string | null;
  isRequired: boolean;
  state: CompanyAgreementState;
  activeVersionId?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyAgreementSignatureRow {
  employee: {
    id: string;
    employeeNumber: string;
    firstName: string;
    lastName: string;
    email: string;
    department: { id: string; name: string } | null;
  };
  signature: {
    id: string;
    status: CompanyAgreementSignatureStatus;
    typedName?: string | null;
    signedAt?: string | null;
    declinedAt?: string | null;
    declineReason?: string | null;
  } | null;
  status: CompanyAgreementSignatureStatus | 'PENDING';
}

export interface CompanyAgreementSignaturesResponse {
  agreement: CompanyAgreement;
  version: { id: string; version: number; title: string } | null;
  summary: { signed: number; declined: number; pending: number; total: number };
  rows: CompanyAgreementSignatureRow[];
}

export interface MyCompanyAgreementVersion {
  id: string;
  version: number;
  title: string;
  details: string;
  documentUrl?: string | null;
  publishedAt?: string | null;
}

export interface MyCompanyAgreement {
  agreement: CompanyAgreement;
  version: MyCompanyAgreementVersion;
  signature: { id: string; status: CompanyAgreementSignatureStatus } | null;
  status: CompanyAgreementSignatureStatus | 'PENDING';
}

export interface CreateCompanyAgreementDto {
  type: CompanyAgreementType;
  title: string;
  details: string;
}

export interface UpdateCompanyAgreementDto {
  type?: CompanyAgreementType;
  title?: string;
  details?: string;
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

// ── Project templates (front-end / local storage only for now) ──
/** A named group of a project's tasks; it has no status of its own, its progress comes from its tasks. */
export interface ProjectObjective {
  id: string;
  projectId: string;
  name: string;
  description?: string;
  createdAt: string;
}

/** A step towards finishing a task. A subtask always belongs to a task, never directly to an objective or the project. */
export interface ProjectSubtask {
  id: string;
  projectId: string;
  taskId: string;
  name: string;
  done: boolean;
  createdAt: string;
}

/** A time-boxed collection of a project's tasks. A task is in at most one sprint. */
export interface ProjectSprint {
  id: string;
  projectId: string;
  name: string;
  /** YYYY-MM-DD */
  startDate: string;
  endDate: string;
  taskIds: string[];
  /** YYYY-MM-DD, set when the sprint is completed. */
  completedAt?: string;
  createdAt: string;
}

/** Tabs a project can show on its detail page; a template picks which ones it turns on. */
export type ProjectFeature = 'OBJECTIVES' | 'BOARD' | 'BACKLOG' | 'CALENDAR' | 'LIST';

export type WorkTypeIcon =
  | 'EPIC'
  | 'STORY'
  | 'TASK'
  | 'BUG'
  | 'IMPROVEMENT'
  | 'FEATURE'
  | 'SUBTASK';

export type PriorityColor = 'GRAY' | 'BLUE' | 'GREEN' | 'YELLOW' | 'ORANGE' | 'RED' | 'PURPLE';

export interface PriorityLevel {
  name: string;
  color: PriorityColor;
}

export interface ProjectWorkType {
  name: string;
  icon: WorkTypeIcon;
}

export interface TemplateSprint {
  name: string;
  /** How long the sprint runs, in days. */
  days: number;
}

/** What a project starting from a template comes with, beyond its set-up. */
export interface ProjectTemplateContent {
  objectives: string[];
  /** In order; each starts the day after the one before it. */
  sprints: TemplateSprint[];
  /** Names given to the project tabs; a tab left out keeps its own name. */
  featureLabels: Partial<Record<ProjectFeature, string>>;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description?: string;
  /** Workflow: the statuses work moves through, in order (the board columns). */
  workflow: string[];
  /** Kinds of work items a project can hold, e.g. Epic, Story, Bug. */
  workTypes: ProjectWorkType[];
  /** Features turned on for projects using this template; each is a tab on the project details. */
  features: ProjectFeature[];
  /** Levels of importance work can be given, ordered from lowest to highest. */
  priorities: PriorityLevel[];
  content: ProjectTemplateContent;
  /** Built-in templates ship with the app and can't be deleted. */
  isDefault: boolean;
  createdAt: string;
}

/** The part of a template a project actually runs on; a project gets its own editable copy. */
export type ProjectConfig = Pick<
  ProjectTemplate,
  'workflow' | 'workTypes' | 'features' | 'priorities'
> & {
  /** Names given to features in place of the usual ones; a feature left out keeps its own. */
  featureLabels?: ProjectTemplateContent['featureLabels'];
  /** Features added after the project was made; only these can be removed, the template's stay. */
  addedFeatures?: ProjectFeature[];
};

export type CreateProjectTemplateDto = Pick<
  ProjectTemplate,
  'name' | 'description' | 'workflow' | 'workTypes' | 'features' | 'priorities' | 'content'
>;

/** One line of a project invoice: a task's time, the project price, a milestone or a retainer month. */
export interface ProjectInvoiceLine {
  /** Task id, milestone id, a retainer month, or "price". */
  key: string;
  label: string;
  amount: number;
  /** For a task's time: the minutes this invoice billed. */
  minutes?: number;
}

/** An invoice raised from a project and sent to Accounting through marketing. */
export interface ProjectInvoice {
  id: string;
  projectId: string;
  clientId: string;
  /** The Accounting transaction the invoice became, to read its state back. */
  transactionId: string;
  description: string;
  amount: number;
  lines: ProjectInvoiceLine[];
  createdAt: string;
}

export type RecordProjectInvoiceDto = Pick<
  ProjectInvoice,
  'id' | 'transactionId' | 'description' | 'amount' | 'lines'
>;
