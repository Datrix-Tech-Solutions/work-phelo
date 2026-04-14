// ── Leave Type ───────────────────────────────────────────
export type LeaveApplicableTo = 'ALL' | 'FULL_TIME' | 'PART_TIME' | 'CONTRACT';

export interface LeaveType {
  id: string;
  tenantId: string;
  name: string;
  isPaid: boolean;
  daysAllowed: number;
  isCarryOver: boolean;
  maxCarryOverDays?: number;
  requiresApproval: boolean;
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
  applicableTo?: LeaveApplicableTo[];
}

export type UpdateLeaveTypeDto = Partial<CreateLeaveTypeDto>;

// ── Public Holiday ───────────────────────────────────────
export interface PublicHoliday {
  id: string;
  tenantId: string;
  name: string;
  date: string; // ISO date string
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
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
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
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason?: string;
  documentationUrl?: string;
}

export interface ReviewLeaveRequestDto {
  status: 'Approved' | 'Rejected';
  reviewNote?: string;
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

// ── Pagination ────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  totalPages: number;
  totalCount: number;
  currentPage: number;
}
