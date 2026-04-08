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

export interface Department {
  id: string;
  name: string;
  description?: string;
  managerId?: string;
  isActive: boolean;
  _count?: { employees: number };
}

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
}

export interface UpdateEmployeePayload {
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  maritalStatus?: string;
  nationality?: string;
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
  bankName?: string;
  bankAccountNumber?: string;
  bankBranch?: string;
  ssnit?: string;
  tinNumber?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
}

export interface LeaveType {
  id: string;
  name: string;
  daysAllowed: number;
  defaultDays?: number;
  isPaid: boolean;
  isDefault?: boolean;
  isActive?: boolean;
  requiresApproval?: boolean;
  isCarryOver?: boolean;
  description?: string;
}

export interface LeaveRequest {
  id: string;
  leaveTypeId: string;
  leaveType?: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  employeeId: string;
  reviewedById?: string;
  reviewNote?: string;
}

export interface PayrollRun {
  id: string;
  month: number;
  year: number;
  status: 'DRAFT' | 'APPROVED' | 'PAID';
  description?: string;
  totalGross: number;
  totalNet: number;
  totalTax: number;
  createdAt: string;
}

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
