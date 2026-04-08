export type ClockStatus = 'CLOCKED_IN' | 'CLOCKED_OUT' | 'ON_BREAK';

export interface TodaySession {
  entryId?: string;
  status: ClockStatus;
  clockIn?: string;
  clockOut?: string;
  breakStart?: string;
  totalMinutes: number;
  breakMinutes: number;
  isLate: boolean;
}

export interface TimeEntry {
  id: string;
  employeeId: string;
  employeeName?: string;
  avatarUrl?: string;
  department?: string;
  jobTitle?: string;
  date: string;
  clockIn: string;
  clockOut?: string;
  breakMinutes: number;
  totalMinutes: number;
  status: ClockStatus | 'ABSENT';
  isLate: boolean;
  notes?: string;
}

export interface LiveAttendanceEntry {
  id: string;
  employeeId: string;
  employeeName: string;
  avatarUrl?: string;
  department?: string;
  jobTitle?: string;
  clockIn: string;
  breakStart?: string;
  status: ClockStatus;
  isLate: boolean;
}

export interface AttendanceStats {
  clockedIn: number;
  absent: number;
  late: number;
  onBreak: number;
  total: number;
}

export interface CorrectionRequest {
  id: string;
  employeeId: string;
  employeeName?: string;
  date: string;
  requestedClockIn?: string;
  requestedClockOut?: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote?: string;
  reviewedAt?: string;
  createdAt: string;
}
