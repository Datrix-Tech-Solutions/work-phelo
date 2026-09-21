import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  FiscalPeriodStatus,
  JournalEntryType,
  Prisma,
  RecordStatus,
  RecurringJournalStatus,
  RecurringOnGeneration,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRecurringJournalDto,
  QueryRecurringJournalsDto,
  RecurringJournalLineDto,
  UpdateRecurringJournalDto,
} from './dto/accounting.dto';
import { JournalPolicy } from './journal.policy';
import { JournalsService } from './journals.service';
import {
  addRecurrenceInterval,
  calculateNextRunDate,
  dateOnly,
  isoDay,
} from './recurrence';

/** A template that has fallen this many runs behind is caught up over several days, not at once. */
const MAX_CATCH_UP_RUNS = 31;

const recurringInclude = {
  lines: {
    include: { glAccount: { select: { id: true, code: true, name: true } } },
    orderBy: { lineNumber: 'asc' as const },
  },
} satisfies Prisma.RecurringJournalInclude;

type RecurringRecord = Prisma.RecurringJournalGetPayload<{
  include: typeof recurringInclude;
}>;

export interface RecurringRunResult {
  generated: number;
  failed: number;
}

@Injectable()
export class RecurringJournalsService {
  private readonly logger = new Logger(RecurringJournalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly journals: JournalsService,
    private readonly policy: JournalPolicy,
  ) {}

  list(tenantId: string, query: QueryRecurringJournalsDto) {
    return this.prisma.recurringJournal.findMany({
      where: { tenantId, ...(query.status ? { status: query.status } : {}) },
      include: recurringInclude,
      orderBy: [{ status: 'asc' }, { nextRunDate: 'asc' }, { name: 'asc' }],
    });
  }

  async findOne(tenantId: string, id: string): Promise<RecurringRecord> {
    const recurring = await this.prisma.recurringJournal.findFirst({
      where: { id, tenantId },
      include: recurringInclude,
    });
    if (!recurring) throw new NotFoundException('Recurring entry not found');
    return recurring;
  }

  async create(user: RequestUser, dto: CreateRecurringJournalDto) {
    this.assertDates(dto.startDate, dto.endDate);
    this.assertLines(dto.lines);
    await this.assertAccounts(user.tenantId, dto.lines);

    const config = await this.prisma.accountingTenantConfig.findUnique({
      where: { tenantId: user.tenantId },
    });
    if (!config) {
      throw new BadRequestException(
        'Accounting tenant configuration is required before creating recurring entries',
      );
    }

    // The server decides the next run: the start date while it is still ahead, otherwise the
    // first occurrence from today (dates that already passed are not backfilled).
    const nextRunDate = calculateNextRunDate(dto.startDate, dto.frequency);
    if (dto.endDate && nextRunDate > dto.endDate.slice(0, 10)) {
      throw new BadRequestException(
        'The end date is before the first date this entry would run',
      );
    }

    try {
      return await this.prisma.recurringJournal.create({
        data: {
          tenantId: user.tenantId,
          name: dto.name,
          description: dto.description,
          frequency: dto.frequency,
          startDate: dateOnly(dto.startDate),
          endDate: dto.endDate ? dateOnly(dto.endDate) : null,
          nextRunDate: dateOnly(nextRunDate),
          onGeneration: dto.onGeneration,
          transactionCurrency: config.baseCurrency,
          createdByUserId: user.id,
          updatedByUserId: user.id,
          lines: { create: this.lineData(user.tenantId, dto.lines) },
        },
        include: recurringInclude,
      });
    } catch (error) {
      this.rethrowUniqueName(error);
    }
  }

  async update(user: RequestUser, id: string, dto: UpdateRecurringJournalDto) {
    const current = await this.findOne(user.tenantId, id);
    if (
      current.status !== RecurringJournalStatus.ACTIVE &&
      current.status !== RecurringJournalStatus.PAUSED
    ) {
      throw new ConflictException(
        `A ${current.status.toLowerCase()} recurring entry cannot be edited`,
      );
    }

    const startIso = isoDay(current.startDate);
    const endIso =
      dto.endDate === undefined
        ? current.endDate
          ? isoDay(current.endDate)
          : null
        : dto.endDate
          ? dto.endDate.slice(0, 10)
          : null;
    this.assertDates(startIso, endIso);
    if (dto.lines) {
      this.assertLines(dto.lines);
      await this.assertAccounts(user.tenantId, dto.lines);
    }

    const frequency = dto.frequency ?? current.frequency;
    const nextRunDate =
      dto.frequency && dto.frequency !== current.frequency
        ? calculateNextRunDate(startIso, frequency)
        : isoDay(current.nextRunDate);
    if (endIso && nextRunDate > endIso) {
      throw new BadRequestException(
        'The end date is before the next date this entry would run',
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.lines) {
          await tx.recurringJournalLine.deleteMany({
            where: { recurringJournalId: id, tenantId: user.tenantId },
          });
        }
        return tx.recurringJournal.update({
          where: { id_tenantId: { id, tenantId: user.tenantId } },
          data: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.description !== undefined
              ? { description: dto.description }
              : {}),
            frequency,
            nextRunDate: dateOnly(nextRunDate),
            endDate: endIso ? dateOnly(endIso) : null,
            ...(dto.onGeneration !== undefined
              ? { onGeneration: dto.onGeneration }
              : {}),
            updatedByUserId: user.id,
            ...(dto.lines
              ? { lines: { create: this.lineData(user.tenantId, dto.lines) } }
              : {}),
          },
          include: recurringInclude,
        });
      });
    } catch (error) {
      this.rethrowUniqueName(error);
    }
  }

  pause(user: RequestUser, id: string) {
    return this.transition(
      user,
      id,
      [RecurringJournalStatus.ACTIVE],
      RecurringJournalStatus.PAUSED,
    );
  }

  /** Resuming skips the runs missed while paused: the next run is recalculated from today. */
  async resume(user: RequestUser, id: string) {
    const current = await this.findOne(user.tenantId, id);
    if (current.status !== RecurringJournalStatus.PAUSED) {
      throw new ConflictException(
        'Only a paused recurring entry can be resumed',
      );
    }
    const nextRunDate = calculateNextRunDate(
      isoDay(current.startDate),
      current.frequency,
    );
    if (current.endDate && nextRunDate > isoDay(current.endDate)) {
      return this.prisma.recurringJournal.update({
        where: { id_tenantId: { id, tenantId: user.tenantId } },
        data: {
          status: RecurringJournalStatus.COMPLETED,
          updatedByUserId: user.id,
        },
        include: recurringInclude,
      });
    }
    return this.prisma.recurringJournal.update({
      where: { id_tenantId: { id, tenantId: user.tenantId } },
      data: {
        status: RecurringJournalStatus.ACTIVE,
        nextRunDate: dateOnly(nextRunDate),
        lastError: null,
        lastErrorAt: null,
        updatedByUserId: user.id,
      },
      include: recurringInclude,
    });
  }

  cancel(user: RequestUser, id: string) {
    return this.transition(
      user,
      id,
      [RecurringJournalStatus.ACTIVE, RecurringJournalStatus.PAUSED],
      RecurringJournalStatus.CANCELLED,
    );
  }

  /** Generates the next scheduled occurrence now, whatever today's date is (for testing or to
   *  bring one forward). It advances the schedule exactly as a normal run would. */
  async runNow(user: RequestUser, id: string) {
    const template = await this.findOne(user.tenantId, id);
    if (template.status !== RecurringJournalStatus.ACTIVE) {
      throw new ConflictException('Only an active recurring entry can be run');
    }
    const journal = await this.generateOccurrence(template);
    return { journal, recurring: await this.findOne(user.tenantId, id) };
  }

  /**
   * Generates every occurrence that is due (on or before `today`), across all tenants. Called
   * by the daily job. A template that fails (no open period, an account since deactivated) is
   * marked with the reason and retried on the next run; it never blocks the others.
   */
  async generateDue(today: Date = new Date()): Promise<RecurringRunResult> {
    const result: RecurringRunResult = { generated: 0, failed: 0 };
    const todayIso = isoDay(today);
    const due = await this.prisma.recurringJournal.findMany({
      where: {
        status: RecurringJournalStatus.ACTIVE,
        nextRunDate: { lte: dateOnly(todayIso) },
      },
      include: recurringInclude,
      orderBy: { nextRunDate: 'asc' },
    });

    for (const initial of due) {
      let template: RecurringRecord | null = initial;
      for (
        let runs = 0;
        template &&
        runs < MAX_CATCH_UP_RUNS &&
        template.status === RecurringJournalStatus.ACTIVE &&
        isoDay(template.nextRunDate) <= todayIso;
        runs++
      ) {
        const current: RecurringRecord = template;
        try {
          await this.generateOccurrence(current);
          result.generated++;
          template = await this.prisma.recurringJournal.findFirst({
            where: { id: current.id, tenantId: current.tenantId },
            include: recurringInclude,
          });
        } catch (error) {
          result.failed++;
          await this.recordFailure(current, error);
          break;
        }
      }
    }
    if (result.generated || result.failed) {
      this.logger.log(
        `Recurring entries: ${result.generated} generated, ${result.failed} failed`,
      );
    }
    return result;
  }

  /** Creates the journal for the template's current next-run date and advances the schedule. */
  private async generateOccurrence(template: RecurringRecord) {
    const runIso = isoDay(template.nextRunDate);
    const user = {
      id: template.createdByUserId,
      tenantId: template.tenantId,
    } as RequestUser;

    const period = await this.prisma.fiscalPeriod.findFirst({
      where: {
        tenantId: template.tenantId,
        status: FiscalPeriodStatus.OPEN,
        startDate: { lte: dateOnly(runIso) },
        endDate: { gte: dateOnly(runIso) },
      },
    });
    if (!period) {
      throw new BadRequestException(`No open fiscal period covers ${runIso}`);
    }

    // create() returns the existing journal for a repeated idempotency key, so a retried or
    // concurrent run for the same date cannot produce a duplicate.
    const created = await this.journals.create(
      user,
      {
        entryType: JournalEntryType.RECURRING,
        transactionDate: runIso,
        fiscalPeriodId: period.id,
        transactionCurrency: template.transactionCurrency,
        description: template.description,
        idempotencyKey: `recurring:${template.id}:${runIso}`,
        lines: template.lines.map((line) => ({
          glAccountId: line.glAccountId,
          description: line.description ?? undefined,
          debit: Number(line.debit.toString()),
          credit: Number(line.credit.toString()),
        })),
      },
      { recurringJournalId: template.id, recurringRunDate: dateOnly(runIso) },
    );

    let postError: string | null = null;
    let journal = created;
    if (
      template.onGeneration === RecurringOnGeneration.AUTO_POST &&
      created.status === 'DRAFT'
    ) {
      try {
        journal = await this.journals.post(user, created.id);
      } catch (error) {
        // The draft exists and can be posted by hand; the schedule still moves on.
        postError = `Generated ${created.journalNumber} as a draft but could not post it: ${this.message(error)}`;
      }
    }

    await this.advance(template, runIso, postError);
    return journal;
  }

  private async advance(
    template: RecurringRecord,
    runIso: string,
    note: string | null,
  ) {
    const next = addRecurrenceInterval(
      runIso,
      template.frequency,
      isoDay(template.startDate),
    );
    const finished = template.endDate && next > isoDay(template.endDate);
    // Only move the schedule if nobody else already did (guards two service instances).
    await this.prisma.recurringJournal.updateMany({
      where: {
        id: template.id,
        tenantId: template.tenantId,
        nextRunDate: dateOnly(runIso),
        status: RecurringJournalStatus.ACTIVE,
      },
      data: {
        nextRunDate: dateOnly(next),
        lastRunAt: new Date(),
        lastError: note,
        lastErrorAt: note ? new Date() : null,
        ...(finished ? { status: RecurringJournalStatus.COMPLETED } : {}),
      },
    });
  }

  private async recordFailure(template: RecurringRecord, error: unknown) {
    const message = this.message(error);
    this.logger.warn(`Recurring entry "${template.name}" failed: ${message}`);
    await this.prisma.recurringJournal.updateMany({
      where: { id: template.id, tenantId: template.tenantId },
      data: { lastError: message, lastErrorAt: new Date() },
    });
  }

  private async transition(
    user: RequestUser,
    id: string,
    from: RecurringJournalStatus[],
    to: RecurringJournalStatus,
  ) {
    const current = await this.findOne(user.tenantId, id);
    if (!from.includes(current.status)) {
      throw new ConflictException(
        `A ${current.status.toLowerCase()} recurring entry cannot become ${to.toLowerCase()}`,
      );
    }
    return this.prisma.recurringJournal.update({
      where: { id_tenantId: { id, tenantId: user.tenantId } },
      data: { status: to, updatedByUserId: user.id },
      include: recurringInclude,
    });
  }

  private assertDates(startDate: string, endDate?: string | null) {
    if (endDate && endDate.slice(0, 10) < startDate.slice(0, 10)) {
      throw new BadRequestException('End date cannot be before the start date');
    }
  }

  private assertLines(lines: RecurringJournalLineDto[]) {
    this.policy.validateBalanced(lines);
  }

  private async assertAccounts(
    tenantId: string,
    lines: RecurringJournalLineDto[],
  ) {
    const ids = [...new Set(lines.map((line) => line.glAccountId))];
    const accounts = await this.prisma.gLAccount.findMany({
      where: { tenantId, id: { in: ids } },
      include: { _count: { select: { childAccounts: true } } },
    });
    if (accounts.length !== ids.length) {
      throw new BadRequestException(
        'One or more GL accounts do not belong to this tenant',
      );
    }
    if (
      accounts.some(
        (account) =>
          account.status !== RecordStatus.ACTIVE ||
          !account.allowPosting ||
          account._count.childAccounts > 0,
      )
    ) {
      throw new BadRequestException(
        'Recurring entry lines require active leaf posting-enabled GL accounts',
      );
    }
  }

  private lineData(tenantId: string, lines: RecurringJournalLineDto[]) {
    return lines.map((line, index) => ({
      tenantId,
      lineNumber: index + 1,
      glAccountId: line.glAccountId,
      description: line.description?.trim() || null,
      debit: new Prisma.Decimal(line.debit ?? 0),
      credit: new Prisma.Decimal(line.credit ?? 0),
    }));
  }

  private rethrowUniqueName(error: unknown): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A recurring entry with this name already exists',
      );
    }
    throw error;
  }

  private message(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
