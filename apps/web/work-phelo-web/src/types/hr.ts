export interface Department {
  id: string;
  name: string;
  description?: string;
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
  jobTitle: string;
  employmentType: 'FULL_TIME' | 'PART_TIME' | 'CONTRACT' | 'INTERN';
  employmentStatus: 'ACTIVE' | 'PROBATION' | 'ON_LEAVE' | 'SUSPENDED' | 'TERMINATED';
  hireDate: string;
  basicSalary: number;
  departmentId?: string;
  department?: Department;
  userId?: string;
  avatarUrl?: string;
  bankName?: string;
  bankAccountNumber?: string;
  ssnit?: string;
  tinNumber?: string;
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
  basicSalary: number;
  departmentId?: string;
  bankName?: string;
  bankAccountNumber?: string;
  ssnit?: string;
  tinNumber?: string;
}

export interface LeaveType {
  id: string;
  name: string;
  defaultDays: number;
  isPaid: boolean;
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

export interface DashboardSummary {
  adminFirstName: string;
  companyName: string;
  totalEmployees: number;
  activeEmployees: number;
  pendingLeaveRequests: number;
  assignedAssetsCount: number;
  hasEmployees: boolean;
}
