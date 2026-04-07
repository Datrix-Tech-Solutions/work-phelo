export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  employmentStatus: 'ACTIVE' | 'PROBATION' | 'SUSPENDED' | 'OFFBOARDED';
  employmentType: string;
  hireDate: string;
  dateOfBirth?: string;
  gender?: string;
  maritalStatus?: string;
  nationality?: string;
  address?: string;
  city?: string;
  region?: string;
  emergencyName?: string;
  emergencyPhone?: string;
  emergencyRelation?: string;
  basicSalary?: number;
  bankName?: string;
  bankAccountNumber?: string;
  bankBranch?: string;
  ssnit?: string;
  tinNumber?: string;
  userId?: string | null;
  employeeNumber?: string;
  managerId?: string;
  departmentId?: string;
  department?: { id: string; name: string };
}

export interface Department {
  id: string;
  name: string;
}
