import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  FiscalPeriodStatus,
  PostingDirection,
  Prisma,
  RecordStatus,
  SourceEventStatus,
} from '../../prisma/generated/client';
import { CreateJournalDto, JournalLineDto } from '../ledger/dto/accounting.dto';
import { JournalsService } from '../ledger/journals.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSourceEventDto, QuerySourceEventsDto } from './dto/posting.dto';

const sourceEventInclude = {
  postingRule: {
    select: {
      id: true,
      name: true,
      sourceModule: true,
      sourceEventType: true,
      version: true,
    },
  },
  journalEntry: {
    select: {
      id: true,
      journalNumber: true,
      status: true,
      transactionDate: true,
      transactionCurrency: true,
      baseCurrency: true,
      postedAt: true,
    },
  },
} satisfies Prisma.SourceEventInboxInclude;

const postingRuleForEngineInclude = {
  lines: {
    orderBy: { sequence: 'asc' as const },
  },
} satisfies Prisma.PostingRuleInclude;

type SourcePayload = Record<string, unknown>;
type EngineRule = Prisma.PostingRuleGetPayload<{
  include: typeof postingRuleForEngineInclude;
}>;

@Injectable()
export class SourceEventsService {
  private readonly logger = new Logger(SourceEventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly journals: JournalsService,
  ) {}

  async receive(user: RequestUser, dto: CreateSourceEventDto) {
    let event;
    try {
      event = await this.prisma.sourceEventInbox.create({
        data: {
          tenantId: user.tenantId,
          sourceModule: dto.sourceModule,
          sourceEventType: dto.sourceEventType,
          sourceRecordId: dto.sourceRecordId,
          sourceDocumentId: dto.sourceDocumentId?.trim() || null,
          idempotencyKey: dto.idempotencyKey,
          payload: dto.payload as Prisma.InputJsonObject,
          receivedByUserId: user.id,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.sourceEventInbox.findUnique({
          where: {
            tenantId_idempotencyKey: {
              tenantId: user.tenantId,
              idempotencyKey: dto.idempotencyKey,
            },
          },
          select: { id: true, status: true },
        });
        throw new ConflictException({
          message: 'Source event idempotency key already exists',
          sourceEventId: existing?.id,
          status: existing?.status,
        });
      }
      throw error;
    }

    return this.process(user, event.id, SourceEventStatus.RECEIVED, false);
  }

  list(tenantId: string, query: QuerySourceEventsDto) {
    return this.prisma.sourceEventInbox.findMany({
      where: {
        tenantId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.sourceModule ? { sourceModule: query.sourceModule } : {}),
        ...(query.sourceEventType
          ? { sourceEventType: query.sourceEventType }
          : {}),
        ...(query.sourceRecordId
          ? { sourceRecordId: query.sourceRecordId }
          : {}),
      },
      include: sourceEventInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, eventId: string) {
    const event = await this.prisma.sourceEventInbox.findFirst({
      where: { id: eventId, tenantId },
      include: sourceEventInclude,
    });
    if (!event) throw new NotFoundException('Source event not found');
    return event;
  }

  async retry(user: RequestUser, eventId: string) {
    await this.findOne(user.tenantId, eventId);
    return this.process(user, eventId, SourceEventStatus.FAILED, true);
  }

  private async process(
    user: RequestUser,
    eventId: string,
    expectedStatus: SourceEventStatus,
    retry: boolean,
  ) {
    const claimed = await this.prisma.sourceEventInbox.updateMany({
      where: {
        id: eventId,
        tenantId: user.tenantId,
        status: expectedStatus,
      },
      data: {
        status: SourceEventStatus.PROCESSING,
        processedAt: null,
        ...(retry ? { retryCount: { increment: 1 } } : {}),
      },
    });
    if (claimed.count !== 1) {
      const current = await this.findOne(user.tenantId, eventId);
      if (current.status === SourceEventStatus.PROCESSING) {
        throw new ConflictException('Source event is already processing');
      }
      if (retry && current.status === SourceEventStatus.POSTED) {
        return current;
      }
      throw new ConflictException(
        retry
          ? 'Only failed source events can be retried'
          : `Source event cannot be processed from ${current.status}`,
      );
    }

    let resolvedRuleId: string | undefined;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const event = await tx.sourceEventInbox.findFirst({
          where: {
            id: eventId,
            tenantId: user.tenantId,
            status: SourceEventStatus.PROCESSING,
          },
        });
        if (!event) {
          throw new ConflictException('Source event processing claim was lost');
        }

        const payload = this.asPayload(event.payload);
        const transactionDate = this.transactionDate(payload);
        const rule = await this.resolveRule(tx, event, transactionDate);
        resolvedRuleId = rule.id;
        const { currency, lines } = await this.resolveLines(
          tx,
          event,
          rule,
          payload,
        );
        const period = await this.resolvePeriod(
          tx,
          user.tenantId,
          transactionDate,
        );

        const journalDto: CreateJournalDto = {
          transactionDate: transactionDate.toISOString(),
          fiscalPeriodId: period.id,
          transactionCurrency: currency,
          exchangeRate: this.optionalExchangeRate(payload),
          reference: event.sourceDocumentId ?? event.sourceRecordId,
          description: `${event.sourceEventType} - ${event.sourceRecordId}`,
          idempotencyKey: `source-event:${event.id}`,
          sourceModule: event.sourceModule,
          sourceRecordType: event.sourceEventType,
          sourceRecordId: event.sourceRecordId,
          lines,
        };
        const journal = await this.journals.createPostedInTransaction(
          tx,
          user,
          journalDto,
        );

        await tx.sourceEventInbox.update({
          where: {
            id_tenantId: { id: event.id, tenantId: user.tenantId },
          },
          data: {
            status: SourceEventStatus.POSTED,
            postingRuleId: rule.id,
            journalEntryId: journal.id,
            failureReason: null,
            processedAt: new Date(),
          },
        });

        return tx.sourceEventInbox.findUniqueOrThrow({
          where: {
            id_tenantId: { id: event.id, tenantId: user.tenantId },
          },
          include: sourceEventInclude,
        });
      });
    } catch (error) {
      if (!(error instanceof HttpException)) {
        this.logger.error(
          `Source event ${eventId} processing failed`,
          error instanceof Error ? error.stack : String(error),
        );
      }
      await this.prisma.sourceEventInbox.updateMany({
        where: {
          id: eventId,
          tenantId: user.tenantId,
          status: SourceEventStatus.PROCESSING,
        },
        data: {
          status: SourceEventStatus.FAILED,
          failureReason: this.failureMessage(error),
          ...(resolvedRuleId ? { postingRuleId: resolvedRuleId } : {}),
          processedAt: new Date(),
        },
      });
      return this.findOne(user.tenantId, eventId);
    }
  }

  private async resolveRule(
    tx: Prisma.TransactionClient,
    event: {
      tenantId: string;
      sourceModule: string;
      sourceEventType: string;
    },
    transactionDate: Date,
  ): Promise<EngineRule> {
    const rule = await tx.postingRule.findFirst({
      where: {
        tenantId: event.tenantId,
        sourceModule: event.sourceModule,
        sourceEventType: event.sourceEventType,
        active: true,
        effectiveFrom: { lte: transactionDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: transactionDate } }],
      },
      include: postingRuleForEngineInclude,
      orderBy: { version: 'desc' },
    });
    if (rule) return rule;

    const configured = await tx.postingRule.findFirst({
      where: {
        tenantId: event.tenantId,
        sourceModule: event.sourceModule,
        sourceEventType: event.sourceEventType,
      },
      orderBy: { version: 'desc' },
    });
    if (!configured) {
      throw new BadRequestException(
        'No posting rule is configured for this source event',
      );
    }
    if (!configured.active) {
      throw new BadRequestException(
        'No active posting rule is available for this source event',
      );
    }
    throw new BadRequestException(
      'No posting rule is effective for the source event transaction date',
    );
  }

  private async resolveLines(
    tx: Prisma.TransactionClient,
    event: {
      tenantId: string;
      sourceRecordId: string;
      sourceDocumentId: string | null;
    },
    rule: EngineRule,
    payload: SourcePayload,
  ) {
    if (rule.lines.length < 2) {
      throw new BadRequestException(
        'Posting rule requires at least two configured lines',
      );
    }

    const currencies = new Set<string>();
    const lines: JournalLineDto[] = [];
    for (const ruleLine of rule.lines) {
      const amount = this.positiveAmount(
        this.readPayload(payload, ruleLine.amountSource),
        ruleLine.amountSource,
      );
      const currency = this.currency(
        this.readPayload(payload, ruleLine.currencySource),
        ruleLine.currencySource,
      );
      currencies.add(currency);

      let subledgerAccountId: string | undefined;
      if (ruleLine.subledgerType) {
        if (!ruleLine.subledgerExternalRefSource) {
          throw new BadRequestException(
            `Posting rule line ${ruleLine.sequence} is missing its subledger reference source`,
          );
        }
        const externalRef = String(
          this.readPayload(payload, ruleLine.subledgerExternalRefSource),
        ).trim();
        const subledger = await tx.subledgerAccount.findFirst({
          where: {
            tenantId: event.tenantId,
            type: ruleLine.subledgerType,
            externalRef,
            status: RecordStatus.ACTIVE,
          },
        });
        if (!subledger) {
          throw new BadRequestException(
            `Active ${ruleLine.subledgerType.toLowerCase()} subledger not found for rule line ${ruleLine.sequence}`,
          );
        }
        subledgerAccountId = subledger.id;
      }

      lines.push({
        glAccountId: ruleLine.glAccountId,
        subledgerAccountId,
        description: this.renderDescription(
          ruleLine.descriptionTemplate,
          event,
          payload,
        ),
        debit: ruleLine.direction === PostingDirection.DR ? amount : 0,
        credit: ruleLine.direction === PostingDirection.CR ? amount : 0,
      });
    }

    if (currencies.size !== 1) {
      throw new BadRequestException(
        'All posting rule lines must resolve to the same transaction currency',
      );
    }
    return { currency: [...currencies][0], lines };
  }

  private async resolvePeriod(
    tx: Prisma.TransactionClient,
    tenantId: string,
    transactionDate: Date,
  ) {
    const period = await tx.fiscalPeriod.findFirst({
      where: {
        tenantId,
        startDate: { lte: transactionDate },
        endDate: { gte: transactionDate },
      },
      orderBy: { startDate: 'desc' },
    });
    if (!period) {
      throw new BadRequestException(
        'No fiscal period contains the source event transaction date',
      );
    }
    if (period.status !== FiscalPeriodStatus.OPEN) {
      throw new ConflictException(
        `Cannot post source event into a ${period.status.toLowerCase()} fiscal period`,
      );
    }
    return period;
  }

  private transactionDate(payload: SourcePayload) {
    const raw = this.readPayload(payload, 'transactionDate');
    if (typeof raw !== 'string') {
      throw new BadRequestException(
        'Source event payload transactionDate must be an ISO date string',
      );
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException(
        'Source event payload transactionDate is invalid',
      );
    }
    return date;
  }

  private optionalExchangeRate(payload: SourcePayload) {
    const raw = payload.exchangeRate;
    if (raw === undefined || raw === null) return undefined;
    const rate = Number(raw);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new BadRequestException(
        'Source event payload exchangeRate must be greater than zero',
      );
    }
    return rate;
  }

  private readPayload(payload: SourcePayload, path: string): unknown {
    let current: unknown = payload;
    for (const segment of path.split('.')) {
      if (
        typeof current !== 'object' ||
        current === null ||
        Array.isArray(current) ||
        !(segment in current)
      ) {
        throw new BadRequestException(
          `Source event payload is missing ${path}`,
        );
      }
      current = (current as SourcePayload)[segment];
    }
    return current;
  }

  private positiveAmount(value: unknown, path: string) {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException(
        `Source event amount ${path} must be greater than zero`,
      );
    }
    return amount;
  }

  private currency(value: unknown, path: string) {
    if (typeof value !== 'string' || !/^[A-Za-z]{3}$/.test(value.trim())) {
      throw new BadRequestException(
        `Source event currency ${path} must be a three-letter code`,
      );
    }
    return value.trim().toUpperCase();
  }

  private renderDescription(
    template: string,
    event: {
      sourceRecordId: string;
      sourceDocumentId: string | null;
    },
    payload: SourcePayload,
  ) {
    return template.replace(/\{\{([^}]+)}}/g, (_match, rawToken: string) => {
      const token = rawToken.trim();
      if (token === 'sourceRecordId') return event.sourceRecordId;
      if (token === 'sourceDocumentId') {
        return event.sourceDocumentId ?? '';
      }
      if (token.startsWith('payload.')) {
        const value = this.readPayload(payload, token.slice(8));
        if (
          typeof value !== 'string' &&
          typeof value !== 'number' &&
          typeof value !== 'boolean'
        ) {
          throw new BadRequestException(
            `Description placeholder ${token} must resolve to a scalar value`,
          );
        }
        return String(value);
      }
      throw new BadRequestException(
        `Unsupported description placeholder ${token}`,
      );
    });
  }

  private asPayload(value: Prisma.JsonValue): SourcePayload {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new BadRequestException(
        'Source event payload must be a JSON object',
      );
    }
    return value as SourcePayload;
  }

  private failureMessage(error: unknown) {
    const message =
      error instanceof HttpException
        ? error.message
        : 'Unexpected posting engine failure';
    return message.slice(0, 1000);
  }
}
