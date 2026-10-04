import { RequestMethod } from '@nestjs/common';
import type { RouteInfo } from '@nestjs/common/interfaces/middleware';

export const ACCOUNTING_GLOBAL_PREFIX = 'api';

export const ACCOUNTING_GLOBAL_PREFIX_EXCLUSIONS: RouteInfo[] = [
  {
    path: 'internal/source-events',
    method: RequestMethod.POST,
  },
  {
    path: 'internal/subledgers/ensure',
    method: RequestMethod.POST,
  },
  {
    path: 'internal/reinsurance/accounting-readiness',
    method: RequestMethod.POST,
  },
  {
    path: 'internal/source-transactions/options',
    method: RequestMethod.GET,
  },
  {
    path: 'internal/source-transactions',
    method: RequestMethod.POST,
  },
  {
    path: 'internal/source-transactions',
    method: RequestMethod.GET,
  },
  {
    path: 'internal/source-transactions/receipts-summary',
    method: RequestMethod.POST,
  },
  {
    path: 'internal/source-transactions/payment-requests',
    method: RequestMethod.POST,
  },
  {
    path: 'internal/source-transactions/payment-requests/:requestId/cancel',
    method: RequestMethod.POST,
  },
  {
    path: 'internal/payroll-integration/post-accrual',
    method: RequestMethod.POST,
  },
  {
    path: 'internal/payroll-integration/:payrollRunId/settlement-status',
    method: RequestMethod.GET,
  },
];
