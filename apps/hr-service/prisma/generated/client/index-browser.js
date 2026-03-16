
Object.defineProperty(exports, "__esModule", { value: true });

const {
  Decimal,
  objectEnumValues,
  makeStrictEnum,
  Public,
  getRuntime,
  skip
} = require('./runtime/index-browser.js')


const Prisma = {}

exports.Prisma = Prisma
exports.$Enums = {}

/**
 * Prisma Client JS version: 5.22.0
 * Query Engine version: 605197351a3c8bdd595af2d2a9bc3025bca48ea2
 */
Prisma.prismaVersion = {
  client: "5.22.0",
  engine: "605197351a3c8bdd595af2d2a9bc3025bca48ea2"
}

Prisma.PrismaClientKnownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientKnownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)};
Prisma.PrismaClientUnknownRequestError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientUnknownRequestError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientRustPanicError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientRustPanicError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientInitializationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientInitializationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.PrismaClientValidationError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`PrismaClientValidationError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.NotFoundError = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`NotFoundError is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.Decimal = Decimal

/**
 * Re-export of sql-template-tag
 */
Prisma.sql = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`sqltag is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.empty = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`empty is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.join = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`join is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.raw = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`raw is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.validator = Public.validator

/**
* Extensions
*/
Prisma.getExtensionContext = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.getExtensionContext is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}
Prisma.defineExtension = () => {
  const runtimeName = getRuntime().prettyName;
  throw new Error(`Extensions.defineExtension is unable to run in this browser environment, or has been bundled for the browser (running in ${runtimeName}).
In case this error is unexpected for you, please report it in https://pris.ly/prisma-prisma-bug-report`,
)}

/**
 * Shorthand utilities for JSON filtering
 */
Prisma.DbNull = objectEnumValues.instances.DbNull
Prisma.JsonNull = objectEnumValues.instances.JsonNull
Prisma.AnyNull = objectEnumValues.instances.AnyNull

Prisma.NullTypes = {
  DbNull: objectEnumValues.classes.DbNull,
  JsonNull: objectEnumValues.classes.JsonNull,
  AnyNull: objectEnumValues.classes.AnyNull
}



/**
 * Enums
 */

exports.Prisma.TransactionIsolationLevel = makeStrictEnum({
  ReadUncommitted: 'ReadUncommitted',
  ReadCommitted: 'ReadCommitted',
  RepeatableRead: 'RepeatableRead',
  Serializable: 'Serializable'
});

exports.Prisma.DepartmentScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  name: 'name',
  description: 'description',
  managerId: 'managerId',
  parentId: 'parentId',
  isActive: 'isActive',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EmployeeScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  userId: 'userId',
  employeeNumber: 'employeeNumber',
  firstName: 'firstName',
  lastName: 'lastName',
  email: 'email',
  phone: 'phone',
  gender: 'gender',
  dateOfBirth: 'dateOfBirth',
  maritalStatus: 'maritalStatus',
  nationality: 'nationality',
  address: 'address',
  city: 'city',
  region: 'region',
  emergencyName: 'emergencyName',
  emergencyPhone: 'emergencyPhone',
  emergencyRelation: 'emergencyRelation',
  departmentId: 'departmentId',
  jobTitle: 'jobTitle',
  employmentType: 'employmentType',
  employmentStatus: 'employmentStatus',
  hireDate: 'hireDate',
  probationEndsAt: 'probationEndsAt',
  offboardedAt: 'offboardedAt',
  offboardReason: 'offboardReason',
  bankName: 'bankName',
  bankAccountNumber: 'bankAccountNumber',
  bankBranch: 'bankBranch',
  ssnit: 'ssnit',
  tinNumber: 'tinNumber',
  basicSalary: 'basicSalary',
  avatarUrl: 'avatarUrl',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.EmployeeDocumentScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  employeeId: 'employeeId',
  type: 'type',
  name: 'name',
  url: 'url',
  uploadedBy: 'uploadedBy',
  expiresAt: 'expiresAt',
  createdAt: 'createdAt'
};

exports.Prisma.EmployeeAllowanceScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  employeeId: 'employeeId',
  type: 'type',
  name: 'name',
  amount: 'amount',
  isRecurring: 'isRecurring',
  effectiveFrom: 'effectiveFrom',
  effectiveTo: 'effectiveTo',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LeaveTypeScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  name: 'name',
  daysAllowed: 'daysAllowed',
  isCarryOver: 'isCarryOver',
  maxCarryOverDays: 'maxCarryOverDays',
  requiresApproval: 'requiresApproval',
  isPaid: 'isPaid',
  isActive: 'isActive',
  isDefault: 'isDefault',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.LeaveBalanceScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  employeeId: 'employeeId',
  leaveTypeId: 'leaveTypeId',
  year: 'year',
  totalDays: 'totalDays',
  usedDays: 'usedDays',
  pendingDays: 'pendingDays',
  remainingDays: 'remainingDays'
};

exports.Prisma.LeaveRequestScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  employeeId: 'employeeId',
  leaveTypeId: 'leaveTypeId',
  startDate: 'startDate',
  endDate: 'endDate',
  totalDays: 'totalDays',
  reason: 'reason',
  status: 'status',
  approvedBy: 'approvedBy',
  approvedAt: 'approvedAt',
  rejectedBy: 'rejectedBy',
  rejectedAt: 'rejectedAt',
  rejectionNote: 'rejectionNote',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ClockRecordScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  employeeId: 'employeeId',
  clockIn: 'clockIn',
  clockOut: 'clockOut',
  date: 'date',
  hoursWorked: 'hoursWorked',
  ipAddress: 'ipAddress',
  location: 'location',
  note: 'note',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TimesheetScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  employeeId: 'employeeId',
  weekStart: 'weekStart',
  weekEnd: 'weekEnd',
  totalHours: 'totalHours',
  regularHours: 'regularHours',
  overtimeHours: 'overtimeHours',
  isApproved: 'isApproved',
  approvedBy: 'approvedBy',
  approvedAt: 'approvedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.TimeCorrectionScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  employeeId: 'employeeId',
  date: 'date',
  originalIn: 'originalIn',
  originalOut: 'originalOut',
  requestedIn: 'requestedIn',
  requestedOut: 'requestedOut',
  reason: 'reason',
  status: 'status',
  reviewedBy: 'reviewedBy',
  reviewedAt: 'reviewedAt',
  reviewNote: 'reviewNote',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.ShiftScheduleScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  employeeId: 'employeeId',
  shiftType: 'shiftType',
  startTime: 'startTime',
  endTime: 'endTime',
  dayOfWeek: 'dayOfWeek',
  effectiveFrom: 'effectiveFrom',
  effectiveTo: 'effectiveTo',
  createdBy: 'createdBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PayrollRunScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  month: 'month',
  year: 'year',
  status: 'status',
  totalGross: 'totalGross',
  totalNet: 'totalNet',
  totalSSNIT: 'totalSSNIT',
  totalPAYE: 'totalPAYE',
  runBy: 'runBy',
  approvedBy: 'approvedBy',
  approvedAt: 'approvedAt',
  paidAt: 'paidAt',
  notes: 'notes',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.PayrollItemScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  payrollRunId: 'payrollRunId',
  employeeId: 'employeeId',
  basicSalary: 'basicSalary',
  totalAllowances: 'totalAllowances',
  overtimePay: 'overtimePay',
  bonus: 'bonus',
  thirteenthMonth: 'thirteenthMonth',
  grossSalary: 'grossSalary',
  employeeSSNIT: 'employeeSSNIT',
  employerSSNIT: 'employerSSNIT',
  payeTax: 'payeTax',
  totalDeductions: 'totalDeductions',
  netSalary: 'netSalary',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AppraisalCycleScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  title: 'title',
  description: 'description',
  startDate: 'startDate',
  endDate: 'endDate',
  isActive: 'isActive',
  createdBy: 'createdBy',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.AppraisalScalarFieldEnum = {
  id: 'id',
  tenantId: 'tenantId',
  cycleId: 'cycleId',
  employeeId: 'employeeId',
  managerId: 'managerId',
  status: 'status',
  selfScore: 'selfScore',
  selfComment: 'selfComment',
  selfStatus: 'selfStatus',
  selfSubmittedAt: 'selfSubmittedAt',
  managerScore: 'managerScore',
  managerComment: 'managerComment',
  managerStatus: 'managerStatus',
  managerSubmittedAt: 'managerSubmittedAt',
  finalScore: 'finalScore',
  finalComment: 'finalComment',
  completedAt: 'completedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt'
};

exports.Prisma.SortOrder = {
  asc: 'asc',
  desc: 'desc'
};

exports.Prisma.QueryMode = {
  default: 'default',
  insensitive: 'insensitive'
};

exports.Prisma.NullsOrder = {
  first: 'first',
  last: 'last'
};
exports.Gender = exports.$Enums.Gender = {
  MALE: 'MALE',
  FEMALE: 'FEMALE',
  OTHER: 'OTHER',
  PREFER_NOT_TO_SAY: 'PREFER_NOT_TO_SAY'
};

exports.MaritalStatus = exports.$Enums.MaritalStatus = {
  SINGLE: 'SINGLE',
  MARRIED: 'MARRIED',
  DIVORCED: 'DIVORCED',
  WIDOWED: 'WIDOWED'
};

exports.EmploymentType = exports.$Enums.EmploymentType = {
  FULL_TIME: 'FULL_TIME',
  PART_TIME: 'PART_TIME',
  CONTRACT: 'CONTRACT',
  INTERN: 'INTERN'
};

exports.EmploymentStatus = exports.$Enums.EmploymentStatus = {
  ACTIVE: 'ACTIVE',
  PROBATION: 'PROBATION',
  SUSPENDED: 'SUSPENDED',
  OFFBOARDED: 'OFFBOARDED'
};

exports.DocumentType = exports.$Enums.DocumentType = {
  CONTRACT: 'CONTRACT',
  ID_CARD: 'ID_CARD',
  PASSPORT: 'PASSPORT',
  CERTIFICATE: 'CERTIFICATE',
  OFFER_LETTER: 'OFFER_LETTER',
  NDA: 'NDA',
  OTHER: 'OTHER'
};

exports.AllowanceType = exports.$Enums.AllowanceType = {
  TRANSPORT: 'TRANSPORT',
  HOUSING: 'HOUSING',
  MEDICAL: 'MEDICAL',
  OTHER: 'OTHER'
};

exports.LeaveRequestStatus = exports.$Enums.LeaveRequestStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED'
};

exports.TimeCorrectionStatus = exports.$Enums.TimeCorrectionStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED'
};

exports.ShiftType = exports.$Enums.ShiftType = {
  MORNING: 'MORNING',
  AFTERNOON: 'AFTERNOON',
  NIGHT: 'NIGHT',
  FLEXIBLE: 'FLEXIBLE'
};

exports.PayrollStatus = exports.$Enums.PayrollStatus = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  PAID: 'PAID'
};

exports.AppraisalStatus = exports.$Enums.AppraisalStatus = {
  DRAFT: 'DRAFT',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED'
};

exports.ReviewStatus = exports.$Enums.ReviewStatus = {
  PENDING: 'PENDING',
  SUBMITTED: 'SUBMITTED'
};

exports.Prisma.ModelName = {
  Department: 'Department',
  Employee: 'Employee',
  EmployeeDocument: 'EmployeeDocument',
  EmployeeAllowance: 'EmployeeAllowance',
  LeaveType: 'LeaveType',
  LeaveBalance: 'LeaveBalance',
  LeaveRequest: 'LeaveRequest',
  ClockRecord: 'ClockRecord',
  Timesheet: 'Timesheet',
  TimeCorrection: 'TimeCorrection',
  ShiftSchedule: 'ShiftSchedule',
  PayrollRun: 'PayrollRun',
  PayrollItem: 'PayrollItem',
  AppraisalCycle: 'AppraisalCycle',
  Appraisal: 'Appraisal'
};

/**
 * This is a stub Prisma Client that will error at runtime if called.
 */
class PrismaClient {
  constructor() {
    return new Proxy(this, {
      get(target, prop) {
        let message
        const runtime = getRuntime()
        if (runtime.isEdge) {
          message = `PrismaClient is not configured to run in ${runtime.prettyName}. In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters
`;
        } else {
          message = 'PrismaClient is unable to run in this browser environment, or has been bundled for the browser (running in `' + runtime.prettyName + '`).'
        }
        
        message += `
If this is unexpected, please open an issue: https://pris.ly/prisma-prisma-bug-report`

        throw new Error(message)
      }
    })
  }
}

exports.PrismaClient = PrismaClient

Object.assign(exports, Prisma)
