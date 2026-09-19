import { FiscalPeriodStatus } from '@/types/accounting';

export const FISCAL_STATUS_VARIANT: Record<
  FiscalPeriodStatus,
  'success' | 'info' | 'warning' | 'neutral'
> = {
  OPEN: 'success',
  SOFT_CLOSED: 'info',
  CLOSED: 'warning',
  LOCKED: 'neutral',
};

export const FISCAL_STATUS_LABEL: Record<FiscalPeriodStatus, string> = {
  OPEN: 'Open',
  SOFT_CLOSED: 'Soft Closed',
  CLOSED: 'Closed',
  LOCKED: 'Locked',
};
