import { ExecutionContext, ServiceUnavailableException } from '@nestjs/common';
import { InternalServiceAuthGuard } from '../auth/guards/internal-service-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { JournalsService } from '../ledger/journals.service';
import { JournalPolicy } from '../ledger/journal.policy';
import { RecurringJournalsService } from '../ledger/recurring-journals.service';
import { RecurringJournalsCron } from '../ledger/recurring-journals.cron';
import { accountingActivation } from './activation';
import { assertAccountingRuntimeEnv } from './runtime-env';

describe('Accounting production activation safety', () => {
  const original = process.env;
  beforeEach(() => {
    process.env = {
      NODE_ENV: 'production',
      DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:1/fixture',
      JWT_SECRET: 'fixture-only',
    };
  });
  afterEach(() => {
    process.env = original;
    jest.restoreAllMocks();
  });
  it('defaults both automatic journals and internal integrations off in production', () => {
    expect(accountingActivation('ACCOUNTING_RECURRING_JOURNALS_ENABLED')).toBe(
      false,
    );
    expect(
      accountingActivation('ACCOUNTING_INTERNAL_INTEGRATION_ENABLED'),
    ).toBe(false);
    expect(() => assertAccountingRuntimeEnv()).not.toThrow();
  });
  it.each([
    'ACCOUNTING_RECURRING_JOURNALS_ENABLED',
    'ACCOUNTING_INTERNAL_INTEGRATION_ENABLED',
  ])('rejects ambiguous %s flags', (flag) => {
    process.env[flag] = 'yes';
    expect(() => assertAccountingRuntimeEnv()).toThrow(
      `${flag} must be true or false`,
    );
  });
  it('does not invoke the recurring service when the cron is disabled', async () => {
    const generateDue = jest.fn();
    await new RecurringJournalsCron({
      generateDue,
    } as unknown as RecurringJournalsService).generateDueEntries();
    expect(generateDue).not.toHaveBeenCalled();
  });
  it('cannot bypass the automatic gate by invoking the due-service directly', async () => {
    const findMany = jest.fn();
    const service = new RecurringJournalsService(
      { recurringJournal: { findMany } } as unknown as PrismaService,
      {} as JournalsService,
      {} as JournalPolicy,
    );
    expect(await service.generateDue()).toEqual({ generated: 0, failed: 0 });
    expect(findMany).not.toHaveBeenCalled();
  });
  it('requires an independent explicit integration opt-in before trusted credentials are evaluated', () => {
    expect(() =>
      new InternalServiceAuthGuard().canActivate({} as ExecutionContext),
    ).toThrow(ServiceUnavailableException);
  });
  it('allows explicitly approved recurring processing without enabling internal integrations', async () => {
    process.env.ACCOUNTING_RECURRING_JOURNALS_ENABLED = 'true';
    const generateDue = jest
      .fn()
      .mockResolvedValue({ generated: 0, failed: 0 });
    await new RecurringJournalsCron({
      generateDue,
    } as unknown as RecurringJournalsService).generateDueEntries();
    expect(generateDue).toHaveBeenCalledTimes(1);
    expect(
      accountingActivation('ACCOUNTING_INTERNAL_INTEGRATION_ENABLED'),
    ).toBe(false);
  });
});
