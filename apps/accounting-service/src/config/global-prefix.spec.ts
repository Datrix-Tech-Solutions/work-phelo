import { RequestMethod } from '@nestjs/common';
import {
  ACCOUNTING_GLOBAL_PREFIX,
  ACCOUNTING_GLOBAL_PREFIX_EXCLUSIONS,
} from './global-prefix';

describe('Accounting global prefix configuration', () => {
  it('keeps HMAC internal service routes outside the public api prefix', () => {
    expect(ACCOUNTING_GLOBAL_PREFIX).toBe('api');
    expect(ACCOUNTING_GLOBAL_PREFIX_EXCLUSIONS).toEqual(
      expect.arrayContaining([
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
          path: 'internal/payroll-integration/post-accrual',
          method: RequestMethod.POST,
        },
        {
          path: 'internal/payroll-integration/:payrollRunId/settlement-status',
          method: RequestMethod.GET,
        },
      ]),
    );
  });
});
