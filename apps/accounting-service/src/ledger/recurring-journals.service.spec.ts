import { BadRequestException, ConflictException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  GLAccountCategory,
  NormalBalance,
  Prisma,
  RecordStatus,
  RecurrenceFrequency,
  RecurringJournalStatus,
  RecurringOnGeneration,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { JournalPolicy } from './journal.policy';
import { JournalsService } from './journals.service';
import { RecurringJournalsService } from './recurring-journals.service';

const actor = {
  id: 'user-1',
  tenantId: 'tenant-1',
} as RequestUser;

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const line = (glAccountId: string, debit: number, credit: number) => ({
  id: `line-${glAccountId}`,
  tenantId: actor.tenantId,
  recurringJournalId: 'rec-1',
  lineNumber: 1,
  glAccountId,
  description: null,
  debit: new Prisma.Decimal(debit),
  credit: new Prisma.Decimal(credit),
  glAccount: { id: glAccountId, code: glAccountId, name: glAccountId },
});

function template(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-1',
    tenantId: actor.tenantId,
    name: 'Monthly rent',
    description: 'Office rent',
    frequency: RecurrenceFrequency.MONTHLY,
    startDate: d('2026-08-01'),
    endDate: null as Date | null,
    nextRunDate: d('2026-09-01'),
    onGeneration: RecurringOnGeneration.CREATE_DRAFT,
    status: RecurringJournalStatus.ACTIVE as RecurringJournalStatus,
    transactionCurrency: 'GHS',
    lastRunAt: null,
    lastError: null,
    lastErrorAt: null,
    createdByUserId: 'creator-1',
    updatedByUserId: 'creator-1',
    lines: [line('rent', 500, 0), line('bank', 0, 500)],
    ...overrides,
  };
}

describe('RecurringJournalsService', () => {
  const openPeriod = { id: 'period-1', tenantId: actor.tenantId };

  function setup(initial: ReturnType<typeof template>[] = []) {
    // A tiny in-memory store so the catch-up loop sees its own updates.
    const store = new Map(initial.map((t) => [t.id, t]));
    const prisma = {
      recurringJournal: {
        findMany: jest.fn(() =>
          Promise.resolve(
            [...store.values()].filter(
              (t) =>
                t.status === RecurringJournalStatus.ACTIVE &&
                t.nextRunDate <= d('2026-09-21'),
            ),
          ),
        ),
        findFirst: jest.fn((args: { where: { id: string } }) =>
          Promise.resolve(store.get(args.where.id) ?? null),
        ),
        create: jest.fn((args: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'rec-new', ...args.data }),
        ),
        update: jest.fn((args: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'rec-1', ...args.data }),
        ),
        updateMany: jest.fn(
          (args: {
            where: { id: string; nextRunDate?: Date };
            data: Record<string, unknown>;
          }) => {
            const current = store.get(args.where.id);
            if (
              !current ||
              (args.where.nextRunDate &&
                current.nextRunDate.getTime() !==
                  args.where.nextRunDate.getTime())
            ) {
              return Promise.resolve({ count: 0 });
            }
            Object.assign(current, args.data);
            return Promise.resolve({ count: 1 });
          },
        ),
      },
      recurringJournalLine: { deleteMany: jest.fn() },
      gLAccount: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'rent',
            status: RecordStatus.ACTIVE,
            allowPosting: true,
            category: GLAccountCategory.EXPENSE,
            normalBalance: NormalBalance.DEBIT,
            _count: { childAccounts: 0 },
          },
          {
            id: 'bank',
            status: RecordStatus.ACTIVE,
            allowPosting: true,
            category: GLAccountCategory.ASSET,
            normalBalance: NormalBalance.DEBIT,
            _count: { childAccounts: 0 },
          },
        ]),
      },
      accountingTenantConfig: {
        findUnique: jest.fn().mockResolvedValue({ baseCurrency: 'GHS' }),
      },
      fiscalPeriod: { findFirst: jest.fn().mockResolvedValue(openPeriod) },
      $transaction: jest.fn(),
    };
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
    const journals = {
      create: jest.fn().mockResolvedValue({
        id: 'journal-1',
        journalNumber: 'JE-RCR2609-0000',
        status: 'DRAFT',
      }),
      post: jest.fn().mockResolvedValue({ id: 'journal-1', status: 'POSTED' }),
    };
    const service = new RecurringJournalsService(
      prisma as unknown as PrismaService,
      journals as unknown as JournalsService,
      new JournalPolicy(),
    );
    return { prisma, journals, service, store };
  }

  const createDto = {
    name: 'Monthly rent',
    description: 'Office rent',
    frequency: RecurrenceFrequency.MONTHLY,
    startDate: '2099-01-15',
    onGeneration: RecurringOnGeneration.CREATE_DRAFT,
    lines: [
      { glAccountId: 'rent', debit: 500 },
      { glAccountId: 'bank', credit: 500 },
    ],
  };

  describe('create', () => {
    it('stores the template with a server-calculated next run and the base currency', async () => {
      const { prisma, service } = setup();

      await service.create(actor, createDto);

      const data = (
        prisma.recurringJournal.create.mock.calls[0] as [
          { data: Record<string, unknown> },
        ]
      )[0].data;
      expect(data.transactionCurrency).toBe('GHS');
      // A start date still ahead is itself the first run.
      expect((data.nextRunDate as Date).toISOString().slice(0, 10)).toBe(
        '2099-01-15',
      );
      expect(data.endDate).toBeNull();
    });

    it('rejects an unbalanced template', async () => {
      const { prisma, service } = setup();

      await expect(
        service.create(actor, {
          ...createDto,
          lines: [
            { glAccountId: 'rent', debit: 500 },
            { glAccountId: 'bank', credit: 400 },
          ],
        }),
      ).rejects.toThrow('unbalanced');
      expect(prisma.recurringJournal.create).not.toHaveBeenCalled();
    });

    it('rejects an end date before the start date', async () => {
      const { service } = setup();

      await expect(
        service.create(actor, { ...createDto, endDate: '2099-01-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a duplicate name', async () => {
      const { prisma, service } = setup();
      prisma.recurringJournal.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', {
          code: 'P2002',
          clientVersion: 'test',
        }),
      );

      await expect(service.create(actor, createDto)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });
  });

  describe('generateDue', () => {
    it('creates a RECURRING journal for the due date and moves the schedule on', async () => {
      const { journals, service, store } = setup([template()]);

      const result = await service.generateDue(d('2026-09-21'));

      expect(result).toEqual({ generated: 1, failed: 0 });
      const [user, dto, link] = journals.create.mock.calls[0] as [
        { id: string; tenantId: string },
        Record<string, unknown>,
        { recurringJournalId: string; recurringRunDate: Date },
      ];
      // Attributed to whoever created the template.
      expect(user).toMatchObject({ id: 'creator-1', tenantId: actor.tenantId });
      expect(dto).toMatchObject({
        entryType: 'RECURRING',
        transactionDate: '2026-09-01',
        fiscalPeriodId: 'period-1',
        transactionCurrency: 'GHS',
        idempotencyKey: 'recurring:rec-1:2026-09-01',
      });
      expect(link).toMatchObject({ recurringJournalId: 'rec-1' });
      expect(link.recurringRunDate.toISOString().slice(0, 10)).toBe(
        '2026-09-01',
      );
      expect(store.get('rec-1')?.nextRunDate.toISOString().slice(0, 10)).toBe(
        '2026-10-01',
      );
      expect(journals.post).not.toHaveBeenCalled();
    });

    it('posts the journal when the template is set to auto post', async () => {
      const { journals, service } = setup([
        template({ onGeneration: RecurringOnGeneration.AUTO_POST }),
      ]);

      await service.generateDue(d('2026-09-21'));

      expect(journals.post).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'creator-1' }),
        'journal-1',
      );
    });

    it('keeps the draft and notes the problem when auto posting fails, but still advances', async () => {
      const { journals, service, store } = setup([
        template({ onGeneration: RecurringOnGeneration.AUTO_POST }),
      ]);
      journals.post.mockRejectedValue(new Error('Period is closed'));

      const result = await service.generateDue(d('2026-09-21'));

      expect(result.generated).toBe(1);
      const saved = store.get('rec-1');
      expect(saved?.lastError).toContain('JE-RCR2609-0000');
      expect(saved?.lastError).toContain('Period is closed');
      expect(saved?.nextRunDate.toISOString().slice(0, 10)).toBe('2026-10-01');
    });

    it('catches up every missed date, one journal each', async () => {
      const { journals, service, store } = setup([
        template({ nextRunDate: d('2026-07-01') }),
      ]);

      const result = await service.generateDue(d('2026-09-21'));

      // 1 Jul, 1 Aug, 1 Sep were all due.
      expect(result.generated).toBe(3);
      expect(
        (
          journals.create.mock.calls as Array<
            [unknown, { transactionDate: string }]
          >
        ).map((call) => call[1].transactionDate),
      ).toEqual(['2026-07-01', '2026-08-01', '2026-09-01']);
      expect(store.get('rec-1')?.nextRunDate.toISOString().slice(0, 10)).toBe(
        '2026-10-01',
      );
    });

    it('completes the template when the next run would pass its end date', async () => {
      const { service, store } = setup([
        template({ endDate: d('2026-09-30') }),
      ]);

      await service.generateDue(d('2026-09-21'));

      expect(store.get('rec-1')?.status).toBe(RecurringJournalStatus.COMPLETED);
    });

    it('records the reason and leaves the schedule alone when no period is open', async () => {
      const { prisma, journals, service, store } = setup([template()]);
      prisma.fiscalPeriod.findFirst.mockResolvedValue(null);

      const result = await service.generateDue(d('2026-09-21'));

      expect(result).toEqual({ generated: 0, failed: 1 });
      expect(journals.create).not.toHaveBeenCalled();
      const saved = store.get('rec-1');
      expect(saved?.lastError).toContain('No open fiscal period');
      // Still due, so tomorrow's run tries again.
      expect(saved?.nextRunDate.toISOString().slice(0, 10)).toBe('2026-09-01');
    });

    it('does not let one failing template block the others', async () => {
      const { journals, service } = setup([
        template({ id: 'rec-bad', name: 'Bad', nextRunDate: d('2026-09-01') }),
        template({ id: 'rec-ok', name: 'Good', nextRunDate: d('2026-09-02') }),
      ]);
      journals.create
        .mockRejectedValueOnce(new Error('Account was deactivated'))
        .mockResolvedValue({
          id: 'journal-2',
          journalNumber: 'JE-RCR2609-0001',
          status: 'DRAFT',
        });

      const result = await service.generateDue(d('2026-09-21'));

      expect(result).toEqual({ generated: 1, failed: 1 });
    });

    it('only moves the schedule once if another instance already did', async () => {
      const { prisma, service, store } = setup([template()]);
      // Another instance advanced the template between our read and our write.
      prisma.recurringJournal.updateMany.mockImplementationOnce(() => {
        const current = store.get('rec-1');
        if (current) current.nextRunDate = d('2026-10-01');
        return Promise.resolve({ count: 0 });
      });

      await service.generateDue(d('2026-09-21'));

      expect(store.get('rec-1')?.nextRunDate.toISOString().slice(0, 10)).toBe(
        '2026-10-01',
      );
    });

    it('ignores paused templates', async () => {
      const { journals, service } = setup([
        template({ status: RecurringJournalStatus.PAUSED }),
      ]);

      const result = await service.generateDue(d('2026-09-21'));

      expect(result).toEqual({ generated: 0, failed: 0 });
      expect(journals.create).not.toHaveBeenCalled();
    });
  });

  describe('status changes', () => {
    it('resuming skips runs missed while paused', async () => {
      const { prisma, service } = setup([
        template({
          status: RecurringJournalStatus.PAUSED,
          nextRunDate: d('2026-06-01'),
        }),
      ]);

      await service.resume(actor, 'rec-1');

      const data = (
        prisma.recurringJournal.update.mock.calls[0] as [
          { data: { nextRunDate: Date; status: string } },
        ]
      )[0].data;
      expect(data.status).toBe('ACTIVE');
      expect(data.nextRunDate.getTime()).toBeGreaterThan(
        d('2026-06-01').getTime(),
      );
    });

    it('only lets an active entry run now', async () => {
      const { journals, service } = setup([
        template({ status: RecurringJournalStatus.PAUSED }),
      ]);

      await expect(service.runNow(actor, 'rec-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(journals.create).not.toHaveBeenCalled();
    });

    it('cannot edit a cancelled entry', async () => {
      const { service } = setup([
        template({ status: RecurringJournalStatus.CANCELLED }),
      ]);

      await expect(
        service.update(actor, 'rec-1', { name: 'Renamed' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
});
