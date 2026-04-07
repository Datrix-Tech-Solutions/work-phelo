export type LeaveApplicability = 'All' | 'FullTime' | 'PartTime' | 'Contract';

// ── Leave Type ───────────────────────────────────────────
export interface LeaveType {
  id: string;
  tenantSlug: string;
  name: string;
  description?: string;
  isPaid: boolean;
  daysPerYear: number;
  carryOver: boolean;
  maxCarryOverDays?: number;
  requiresDocumentation: boolean;
  documentationDescription?: string;
  applicableTo: LeaveApplicability[];
  isDefault: boolean;
  hasExistingRequests?: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateLeaveTypeDto {
  name: string;
  description?: string;
  isPaid: boolean;
  daysPerYear: number;
  carryOver: boolean;
  maxCarryOverDays?: number;
  requiresDocumentation: boolean;
  documentationDescription?: string;
  applicableTo: LeaveApplicability[];
}

export type UpdateLeaveTypeDto = Partial<CreateLeaveTypeDto>;

// ── Public Holiday ───────────────────────────────────────
export interface PublicHoliday {
  id: string;
  tenantSlug: string;
  name: string;
  startDate: string; // ISO: YYYY-MM-DD
  endDate: string; // ISO: YYYY-MM-DD
  createdAt: string;
  updatedAt?: string;
}

export interface CreatePublicHolidayDto {
  name: string;
  startDate: string; // ISO: YYYY-MM-DD
  endDate: string; // ISO: YYYY-MM-DD
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
  isPaid: boolean; // denormalised from leave type
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
  entitled: number; // days per year
  used: number; // approved days taken this cycle
  pending: number; // days in pending requests
  remaining: number; // entitled - used - pending
  carriedOver: number; // days carried over from previous cycle
}
