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
