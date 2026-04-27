export type BackendShiftType = 'MORNING' | 'AFTERNOON' | 'NIGHT';

export interface ShiftSchedule {
  id: string;
  tenantId: string;
  employeeId: string;
  shiftType: BackendShiftType;
  startTime: string;
  endTime: string;
  dayOfWeek: number[];
  effectiveFrom: string;
  effectiveTo: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  employee: {
    firstName: string;
    lastName: string;
  };
}

export interface CreateShiftSchedulePayload {
  employeeId: string;
  shiftType: BackendShiftType;
  startTime: string;
  endTime: string;
  /** JS getDay() values: 0=Sun, 1=Mon … 6=Sat */
  dayOfWeek: number[];
  effectiveFrom: string;
  effectiveTo?: string;
}
