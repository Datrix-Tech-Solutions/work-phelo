import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  AccountingPaymentRequestStatus,
  AccountingReceivableStatus,
  AccountingSettlementMethod,
  AccountingSourceTransactionKind,
  CashbookTransactionStatus,
  CashbookTransactionType,
  PostingDirection,
  Prisma,
  SourceModule,
  TransactionTypeCategory,
} from '../../../prisma/generated/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AccountingMasterDataService } from '../accounting-master-data.service';
import { CashbookService } from '../cashbook.service';
import { ReceivablesService } from '../receivables.service';
import {
  CreateSourceTransactionDto,
  ListSourceTransactionsQueryDto,
  ReceiptsSummaryDto,
} from './dto/source-transaction.dto';
import { SourceProvisioningService } from './source-provisioning.service';
import { registrationFor, SourceRegistration } from './source-registry';

/** Why a module cannot raise transactions yet - the module shows it to its users. */
export type SourceNotReadyReason =
  | 'SOURCE_NOT_LINKED'
  | 'NO_BASE_CURRENCY'
  | 'NO_TRANSACTION_TYPES'
  | 'NO_ENTITY_TYPE';

export interface SourceTransactionOptions {
  ready: boolean;
  reason?: SourceNotReadyReason;
  baseCurrency?: string;
  entityTypes: { id: string; name: string }[];
  transactionTypes: { id: string; name: string; entityTypeIds: string[] }[];
}

type TransactionTypeWithRule = Prisma.TransactionTypeGetPayload<{
  include: { rule: { include: { lines: true } } };
}>;

const STATE_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  POSTED: 'Posted',
  REVERSED: 'Reversed',
  REJECTED: 'Rejected',
};

const PAYMENT_STATE_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  POSTED: 'Received',
  REVERSED: 'Reversed',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

@Injectable()
export class SourceTransactionsService {
  private readonly logger = new Logger(SourceTransactionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly provisioning: SourceProvisioningService,
    private readonly masterData: AccountingMasterDataService,
    private readonly receivables: ReceivablesService,
    private readonly cashbook: CashbookService,
  ) {}

  /** Whether the module can raise transactions, and what its form should offer. */
  async getOptions(
    tenantId: string,
    module: SourceModule,
  ): Promise<SourceTransactionOptions> {
    const registration = this.registration(module);
    const source = await this.provisioning.ensure(tenantId, registration);
    const notReady = (reason: SourceNotReadyReason, baseCurrency?: string) => ({
      ready: false,
      reason,
      ...(baseCurrency ? { baseCurrency } : {}),
      entityTypes: [],
      transactionTypes: [],
    });

    if (!source.isActive) return notReady('SOURCE_NOT_LINKED');

    const config = await this.masterData.getConfig(tenantId);
    if (!config.baseCurrency) return notReady('NO_BASE_CURRENCY');
    const baseCurrency = config.baseCurrency;

    const linked = await this.linkedTransactionTypes(
      tenantId,
      source.id,
      baseCurrency,
      true,
    );
    const usable = linked.filter((t) => !t.problem).map((t) => t.type);
    if (usable.length === 0)
      return notReady('NO_TRANSACTION_TYPES', baseCurrency);

    const { entityTypes, transactionTypes } = await this.offered(
      tenantId,
      usable,
    );
    if (transactionTypes.length === 0)
      return notReady('NO_ENTITY_TYPE', baseCurrency);

    return { ready: true, baseCurrency, entityTypes, transactionTypes };
  }

  /**
   * What an accountant needs to see to finish setting a module up: each step, and for every
   * transaction type linked to the source whether it can be used and, if not, why.
   */
  async getSetup(tenantId: string, sourceTypeId: string) {
    const source = await this.prisma.sourceType.findFirst({
      where: { id: sourceTypeId, tenantId },
    });
    if (!source) throw new NotFoundException('Source type not found');
    const registration = registrationFor(source.module);
    if (!registration) return { supported: false as const };

    const config = await this.masterData.getConfig(tenantId);
    const baseCurrency = config.baseCurrency ?? null;
    const linkedTypes = await this.linkedTransactionTypes(
      tenantId,
      source.id,
      baseCurrency ?? '',
      false,
    );
    const usable = linkedTypes.filter((t) => !t.problem).map((t) => t.type);
    const { entityTypes, transactionTypes } = await this.offered(
      tenantId,
      usable,
    );
    const offeredIds = new Map(
      transactionTypes.map((t) => [t.id, t.entityTypeIds]),
    );
    const reason: SourceNotReadyReason | null = !source.isActive
      ? 'SOURCE_NOT_LINKED'
      : !baseCurrency
        ? 'NO_BASE_CURRENCY'
        : usable.length === 0
          ? 'NO_TRANSACTION_TYPES'
          : transactionTypes.length === 0
            ? 'NO_ENTITY_TYPE'
            : null;

    return {
      supported: true as const,
      module: source.module,
      sourceName: source.name,
      linked: source.isActive,
      baseCurrency,
      entityTypes,
      transactionTypes: linkedTypes.map(({ type, problem }) => {
        const named = (offeredIds.get(type.id)?.length ?? 0) > 0;
        return {
          id: type.id,
          name: type.name,
          usable: !problem && named,
          problem:
            problem ??
            (named
              ? null
              : "Name an existing entity type in the type's business roles"),
        };
      }),
      ready: reason === null,
      reason,
    };
  }

  /**
   * Raises the transaction for the module's record: creates the record's entity the first time, then
   * a draft the accountant completes and posts. The same idempotency key never raises two.
   */
  async create(actingUserId: string, dto: CreateSourceTransactionDto) {
    const registration = this.registration(dto.sourceModule);
    if (!dto.entityId && !dto.entityTypeId) {
      throw new BadRequestException(
        'An entity type is required for the first transaction of a record',
      );
    }
    const user = this.internalUser(dto.tenantId, actingUserId);

    const options = await this.getOptions(dto.tenantId, dto.sourceModule);
    if (!options.ready || !options.baseCurrency) {
      throw new ConflictException(this.notReadyMessage(options.reason));
    }
    const baseCurrency = options.baseCurrency;

    const source = await this.provisioning.ensure(dto.tenantId, registration);
    const transactionType = await this.prisma.transactionType.findFirst({
      where: { id: dto.transactionTypeId, tenantId: dto.tenantId },
      include: {
        rule: { include: { lines: { orderBy: { sequence: 'asc' } } } },
      },
    });
    if (!transactionType || transactionType.sourceTypeId !== source.id) {
      throw new BadRequestException(
        `That transaction type is not linked to ${registration.sourceName}`,
      );
    }
    const offered = options.transactionTypes.find(
      (t) => t.id === transactionType.id,
    );
    if (!offered) {
      throw new BadRequestException(
        `${transactionType.name} cannot be used from ${registration.module}`,
      );
    }

    const reservation = await this.reserve(
      dto,
      actingUserId,
      transactionType.postsToCashbook,
    );
    if (reservation.existing)
      return this.existingResult(dto.tenantId, reservation.existing);

    try {
      const entity = await this.resolveEntity(
        user,
        registration,
        dto,
        offered.entityTypeIds,
      );
      const entityType = await this.prisma.entityType.findFirst({
        where: {
          tenantId: dto.tenantId,
          name: { equals: entity.type, mode: 'insensitive' },
        },
      });
      if (!entityType || !offered.entityTypeIds.includes(entityType.id)) {
        throw new BadRequestException(
          `${transactionType.name} cannot be used with ${entity.type} entities`,
        );
      }

      const documentId = transactionType.postsToCashbook
        ? await this.createReceiptDraft(
            user,
            dto,
            entity,
            transactionType,
            baseCurrency,
          )
        : await this.createInvoiceDraft(
            user,
            dto,
            entity,
            transactionType,
            baseCurrency,
          );

      await this.prisma.accountingSourceTransaction.update({
        where: { id: reservation.id },
        data: { documentId, entityId: entity.id },
      });
      return {
        entityId: entity.id,
        entityTypeId: entityType.id,
        transactionId: documentId,
        state: 'DRAFT',
      };
    } catch (error) {
      // Free the key so the same submission can be tried again once the cause is fixed.
      await this.prisma.accountingSourceTransaction
        .delete({ where: { id: reservation.id } })
        .catch(() => undefined);
      throw error;
    }
  }

  /** Everything raised for an entity, whoever raised it, with the state Accounting holds now. */
  async list(query: ListSourceTransactionsQueryDto) {
    const { tenantId, entityId } = query;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const take = page * limit;
    // A receipt applied to an invoice shows under that invoice, not again on its own.
    const unallocated = { allocations: { none: { reversedAt: null } } };

    const [
      documents,
      receipts,
      entries,
      documentCount,
      receiptCount,
      entryCount,
    ] = await Promise.all([
      this.prisma.accountingReceivableDocument.findMany({
        where: {
          tenantId,
          customerId: entityId,
          status: { not: AccountingReceivableStatus.VOIDED },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take,
      }),
      this.prisma.accountingReceivableReceipt.findMany({
        where: {
          tenantId,
          customerId: entityId,
          status: { not: AccountingReceivableStatus.VOIDED },
          ...unallocated,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take,
      }),
      this.prisma.cashbookTransaction.findMany({
        where: {
          tenantId,
          offsetSubledgerAccountId: entityId,
          status: { not: CashbookTransactionStatus.VOIDED },
          // A customer receipt already shows as a receipt - not twice.
          receivableReceipt: { is: null },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take,
      }),
      this.prisma.accountingReceivableDocument.count({
        where: {
          tenantId,
          customerId: entityId,
          status: { not: AccountingReceivableStatus.VOIDED },
        },
      }),
      this.prisma.accountingReceivableReceipt.count({
        where: {
          tenantId,
          customerId: entityId,
          status: { not: AccountingReceivableStatus.VOIDED },
          ...unallocated,
        },
      }),
      this.prisma.cashbookTransaction.count({
        where: {
          tenantId,
          offsetSubledgerAccountId: entityId,
          status: { not: CashbookTransactionStatus.VOIDED },
          receivableReceipt: { is: null },
        },
      }),
    ]);

    const entryTypeIds = await this.sourceTypeIdsFor(
      tenantId,
      entries.map((e) => e.id),
    );
    const typeNames = await this.transactionTypeNames(tenantId, [
      ...documents.map((d) => d.transactionTypeId),
      ...entryTypeIds.values(),
    ]);
    const received = await this.receivedByInvoice(
      tenantId,
      documents.map((d) => d.id),
      null,
    );
    const invoices = await this.invoiceDetails(
      tenantId,
      documents.filter((d) => d.documentType === 'INVOICE'),
    );

    const items = [
      ...documents.map((d) => ({
        createdAt: d.createdAt,
        item: this.item({
          kind: d.documentType === 'INVOICE' ? 'INVOICE' : 'CREDIT_NOTE',
          extra: invoices.get(d.id),
          id: d.id,
          status: d.status,
          label:
            d.documentType === 'CREDIT_NOTE'
              ? 'Credit Note'
              : (typeNames.get(d.transactionTypeId ?? '') ?? 'Invoice'),
          amount: d.totalAmount,
          currency: d.currency,
          reference: d.documentNumber,
          reason: d.rejectionReason,
          received: received.get(d.id) ?? new Prisma.Decimal(0),
          createdAt: d.createdAt,
        }),
      })),
      ...receipts.map((r) => ({
        createdAt: r.createdAt,
        item: this.item({
          kind: 'RECEIPT',
          id: r.id,
          status: r.status,
          label: 'Receipt',
          amount: r.amount,
          currency: r.currency,
          reference: r.receiptNumber,
          reason: null,
          received:
            r.status === AccountingReceivableStatus.POSTED
              ? r.amount
              : new Prisma.Decimal(0),
          createdAt: r.createdAt,
        }),
      })),
      ...entries.map((e) => ({
        createdAt: e.createdAt,
        item: this.item({
          kind: 'CASHBOOK',
          id: e.id,
          status: e.status,
          label:
            typeNames.get(entryTypeIds.get(e.id) ?? '') ??
            this.cashbookLabel(e.transactionType),
          amount: e.amount,
          currency: e.currency,
          reference: e.transactionNumber,
          reason: e.rejectionReason,
          received:
            e.transactionType === CashbookTransactionType.RECEIPT &&
            e.status === CashbookTransactionStatus.POSTED
              ? e.amount
              : new Prisma.Decimal(0),
          createdAt: e.createdAt,
        }),
      })),
    ]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice((page - 1) * limit, page * limit)
      .map((row) => row.item);

    const total = documentCount + receiptCount + entryCount;
    return {
      items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  /**
   * Money received: for each entity every posted, not-reversed receipt (customer receipts go
   * through the cashbook too, so they are counted once there), and for each asked-about transaction
   * what was received against it. Totals are in the base currency.
   */
  async receiptsSummary(dto: ReceiptsSummaryDto) {
    this.registration(dto.sourceModule);
    const config = await this.masterData.getConfig(dto.tenantId);
    const currency = config.baseCurrency ?? '';
    const range = this.dateRange(dto.from, dto.to);

    const totals = await this.prisma.cashbookTransaction.groupBy({
      by: ['offsetSubledgerAccountId'],
      where: {
        tenantId: dto.tenantId,
        offsetSubledgerAccountId: { in: dto.entityIds },
        transactionType: CashbookTransactionType.RECEIPT,
        status: CashbookTransactionStatus.POSTED,
        ...(currency ? { currency } : {}),
        ...(range ? { transactionDate: range } : {}),
      },
      _sum: { amount: true },
    });
    const byEntity = new Map(
      totals.map((row) => [
        row.offsetSubledgerAccountId,
        row._sum.amount ?? new Prisma.Decimal(0),
      ]),
    );

    const transactionIds = dto.transactionIds ?? [];
    const transactions = transactionIds.length
      ? await this.receivedForTransactions(dto.tenantId, transactionIds, range)
      : [];

    return {
      currency,
      entities: dto.entityIds.map((entityId) => ({
        entityId,
        receivedAmount: (
          byEntity.get(entityId) ?? new Prisma.Decimal(0)
        ).toFixed(2),
      })),
      transactions,
    };
  }

  /** Whole days, inclusive at both ends; null when neither end is given. */
  private dateRange(from?: string, to?: string) {
    if (!from && !to) return null;
    return {
      ...(from ? { gte: new Date(`${from}T00:00:00.000Z`) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
    };
  }

  private async receivedForTransactions(
    tenantId: string,
    ids: string[],
    range: { gte?: Date; lte?: Date } | null,
  ) {
    const [invoices, entries] = await Promise.all([
      this.prisma.accountingReceivableDocument.findMany({
        where: { tenantId, id: { in: ids } },
        select: { id: true },
      }),
      this.prisma.cashbookTransaction.findMany({
        where: {
          tenantId,
          id: { in: ids },
          transactionType: CashbookTransactionType.RECEIPT,
          status: CashbookTransactionStatus.POSTED,
          ...(range ? { transactionDate: range } : {}),
        },
        select: { id: true, amount: true },
      }),
    ]);
    const receivedByInvoice = await this.receivedByInvoice(
      tenantId,
      invoices.map((i) => i.id),
      range,
    );
    const entryAmount = new Map(entries.map((e) => [e.id, e.amount]));

    return ids.map((transactionId) => ({
      transactionId,
      receivedAmount: (
        receivedByInvoice.get(transactionId) ??
        entryAmount.get(transactionId) ??
        new Prisma.Decimal(0)
      ).toFixed(2),
    }));
  }

  /** What posted receipts have been allocated to each invoice (reversed allocations don't count). */
  private async receivedByInvoice(
    tenantId: string,
    invoiceIds: string[],
    range: { gte?: Date; lte?: Date } | null,
  ) {
    if (invoiceIds.length === 0) return new Map<string, Prisma.Decimal>();
    const rows = await this.prisma.accountingReceivableAllocation.groupBy({
      by: ['invoiceId'],
      where: {
        tenantId,
        invoiceId: { in: invoiceIds },
        sourceType: 'RECEIPT',
        reversedAt: null,
        ...(range ? { receipt: { receiptDate: range } } : {}),
      },
      _sum: { amount: true },
    });
    return new Map(
      rows.map((row) => [
        row.invoiceId,
        row._sum.amount ?? new Prisma.Decimal(0),
      ]),
    );
  }

  /**
   * The transaction types linked to the source, each with what stops it being used (or null). Billing
   * only ever offers receivable types that are not credit notes; `onlyCandidates` leaves the others
   * out, while the setup view keeps them so the accountant can see why they are not on offer.
   */
  private async linkedTransactionTypes(
    tenantId: string,
    sourceTypeId: string,
    baseCurrency: string,
    onlyCandidates: boolean,
  ): Promise<Array<{ type: TransactionTypeWithRule; problem: string | null }>> {
    const types = await this.prisma.transactionType.findMany({
      where: {
        tenantId,
        sourceTypeId,
        ...(onlyCandidates
          ? { category: TransactionTypeCategory.RECEIVABLE, isLinked: false }
          : {}),
      },
      include: {
        rule: { include: { lines: { orderBy: { sequence: 'asc' } } } },
      },
      orderBy: { name: 'asc' },
    });

    const cashAccountIds = types
      .filter((t) => t.postsToCashbook && t.rule?.defaultCashAccountId)
      .map((t) => t.rule!.defaultCashAccountId as string);
    const usableCashAccounts = new Set(
      cashAccountIds.length
        ? (
            await this.prisma.accountingCashAccount.findMany({
              where: {
                tenantId,
                id: { in: cashAccountIds },
                isActive: true,
                currency: baseCurrency,
              },
              select: { id: true },
            })
          ).map((a) => a.id)
        : [],
    );

    return types.map((type) => ({
      type,
      problem: this.problemFor(type, usableCashAccounts),
    }));
  }

  private problemFor(
    type: TransactionTypeWithRule,
    usableCashAccounts: Set<string>,
  ): string | null {
    if (type.category !== TransactionTypeCategory.RECEIVABLE) {
      return 'Only receivable transaction types can be used';
    }
    if (type.isLinked) {
      return 'Credit-note types cannot be used - they need an original invoice';
    }
    // Settlement lines apply when the invoice is paid, so they play no part in raising it.
    const lines = (type.rule?.lines ?? []).filter((l) => !l.settlementKind);
    if (!type.rule || lines.length === 0) {
      return 'Configure the rule for this type first';
    }

    if (type.postsToCashbook) {
      // A direct receipt needs the type to say which cash account it goes to.
      if (!type.rule.defaultCashAccountId) {
        return 'Set a default cash account on the rule';
      }
      if (!usableCashAccounts.has(type.rule.defaultCashAccountId)) {
        return 'The default cash account must be active and in the base currency';
      }
      return null;
    }
    // An invoice needs the receivable line and a main line - the same lines invoice creation resolves.
    const untaxed = lines.filter((l) => !l.taxTypeId);
    const receivable = untaxed.find((l) => l.direction === PostingDirection.DR);
    if (!receivable) return 'The rule needs a receivable (debit) line';
    const main = untaxed.find((l) => l.id !== receivable.id);
    if (!main) {
      return 'The rule needs a main line besides the receivable line';
    }
    if (!main.accountId) {
      return 'The rule lets the user choose the account — set a fixed account for invoices raised from other modules';
    }
    return null;
  }

  /** Entity types are the ones named on the usable transaction types - nothing is configured twice. */
  private async offered(tenantId: string, usable: TransactionTypeWithRule[]) {
    const entityTypes = await this.prisma.entityType.findMany({
      where: { tenantId },
    });
    const entityTypeByRole = new Map(
      entityTypes.map((t) => [t.name.trim().toUpperCase(), t]),
    );
    const transactionTypes = usable
      .map((type) => ({
        id: type.id,
        name: type.name,
        entityTypeIds: [
          ...new Set(
            type.businessRoles
              .map(
                (role) => entityTypeByRole.get(role.trim().toUpperCase())?.id,
              )
              .filter((id): id is string => Boolean(id)),
          ),
        ],
      }))
      .filter((type) => type.entityTypeIds.length > 0);
    const offeredIds = new Set(
      transactionTypes.flatMap((t) => t.entityTypeIds),
    );
    return {
      entityTypes: entityTypes
        .filter((t) => offeredIds.has(t.id))
        .map((t) => ({ id: t.id, name: t.name })),
      transactionTypes,
    };
  }

  private async resolveEntity(
    user: RequestUser,
    registration: SourceRegistration,
    dto: CreateSourceTransactionDto,
    allowedEntityTypeIds: string[],
  ) {
    const externalRef = `${registration.module}:${dto.externalRef}`;

    if (dto.entityId) {
      const entity = await this.prisma.subledgerAccount.findFirst({
        where: { id: dto.entityId, tenantId: dto.tenantId },
      });
      // Only the entity this record already has - never one that belongs to something else.
      if (!entity || entity.externalRef !== externalRef) {
        throw new NotFoundException('Entity not found for this record');
      }
      return entity;
    }

    const entityType = await this.prisma.entityType.findFirst({
      where: { id: dto.entityTypeId, tenantId: dto.tenantId },
    });
    if (!entityType || !allowedEntityTypeIds.includes(entityType.id)) {
      throw new BadRequestException(
        'That entity type cannot be used with this transaction type',
      );
    }
    return this.masterData.ensureSourceEntity(user.id, {
      tenantId: dto.tenantId,
      type: entityType.name,
      externalRef,
      name: dto.entityName,
    });
  }

  private async createInvoiceDraft(
    user: RequestUser,
    dto: CreateSourceTransactionDto,
    entity: { id: string },
    transactionType: TransactionTypeWithRule,
    baseCurrency: string,
  ) {
    const invoice = await this.receivables.createInvoice(user, {
      customerId: entity.id,
      documentDate: this.today(),
      currency: baseCurrency,
      amount: dto.amount,
      // Locked on the draft, like the amount: the breakdown is simply the amount at quantity one.
      quantity: 1,
      unitPrice: dto.amount,
      transactionTypeId: transactionType.id,
      description: dto.description,
      sourceModule: dto.sourceModule,
      sourceRecordId: dto.externalRef,
    });
    return invoice.id;
  }

  private async createReceiptDraft(
    user: RequestUser,
    dto: CreateSourceTransactionDto,
    entity: { id: string; name: string },
    transactionType: TransactionTypeWithRule,
    baseCurrency: string,
  ) {
    const rule = transactionType.rule;
    const cashAccountId = rule?.defaultCashAccountId;
    const offset = rule?.lines[0];
    if (!cashAccountId || !offset?.accountId) {
      throw new ConflictException(
        `${transactionType.name} has no default cash account or account to credit`,
      );
    }
    const receipt = await this.cashbook.createReceipt(user, {
      cashAccountId,
      transactionTypeId: transactionType.id,
      amount: dto.amount,
      quantity: 1,
      unitPrice: dto.amount,
      currency: baseCurrency,
      transactionDate: this.today(),
      // Not known here; the accountant sets the real method before posting.
      settlementMethod: AccountingSettlementMethod.OTHER,
      description:
        dto.description ?? `${transactionType.name} — ${entity.name}`,
      offsetGlAccountId: offset.accountId,
      offsetSubledgerAccountId: entity.id,
      counterpartyType: 'CUSTOMER',
      counterpartyId: entity.id,
      sourceModule: dto.sourceModule,
      sourceRecordId: dto.externalRef,
    });
    return receipt.id;
  }

  /** Reserves the idempotency key, or finds the request that already holds it. */
  private async reserve(
    dto: CreateSourceTransactionDto,
    actingUserId: string,
    isReceipt: boolean,
  ): Promise<{
    id: string;
    existing?: { documentId: string | null; entityId: string; id: string };
  }> {
    try {
      const created = await this.prisma.accountingSourceTransaction.create({
        data: {
          tenantId: dto.tenantId,
          sourceModule: dto.sourceModule,
          idempotencyKey: dto.idempotencyKey,
          sourceRecordId: dto.externalRef,
          entityId: dto.entityId ?? '',
          transactionTypeId: dto.transactionTypeId,
          kind: isReceipt
            ? AccountingSourceTransactionKind.RECEIPT
            : AccountingSourceTransactionKind.INVOICE,
          amount: dto.amount,
          requestedByUserId: actingUserId,
        },
      });
      return { id: created.id };
    } catch (error) {
      if (
        !(
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        )
      ) {
        throw error;
      }
      const existing = await this.prisma.accountingSourceTransaction.findUnique(
        {
          where: {
            tenantId_sourceModule_idempotencyKey: {
              tenantId: dto.tenantId,
              sourceModule: dto.sourceModule,
              idempotencyKey: dto.idempotencyKey,
            },
          },
        },
      );
      if (!existing) throw error;
      return { id: existing.id, existing };
    }
  }

  private async existingResult(
    tenantId: string,
    existing: {
      documentId: string | null;
      entityId: string;
      transactionTypeId?: string;
    },
  ) {
    if (!existing.documentId) {
      throw new ConflictException(
        'This transaction is still being created. Please try again shortly.',
      );
    }
    const entity = await this.prisma.subledgerAccount.findFirst({
      where: { id: existing.entityId, tenantId },
    });
    const entityType = entity
      ? await this.prisma.entityType.findFirst({
          where: {
            tenantId,
            name: { equals: entity.type, mode: 'insensitive' },
          },
        })
      : null;
    return {
      entityId: existing.entityId,
      entityTypeId: entityType?.id ?? '',
      transactionId: existing.documentId,
      state: 'DRAFT',
    };
  }

  private async transactionTypeNames(
    tenantId: string,
    ids: Array<string | null | undefined>,
  ) {
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (unique.length === 0) return new Map<string, string>();
    const types = await this.prisma.transactionType.findMany({
      where: { tenantId, id: { in: unique } },
      select: { id: true, name: true },
    });
    return new Map(types.map((t) => [t.id, t.name]));
  }

  /** The transaction type a cashbook entry was raised with, for entries that came through a source. */
  private async sourceTypeIdsFor(tenantId: string, documentIds: string[]) {
    if (documentIds.length === 0) return new Map<string, string>();
    const rows = await this.prisma.accountingSourceTransaction.findMany({
      where: { tenantId, documentId: { in: documentIds } },
      select: { documentId: true, transactionTypeId: true },
    });
    return new Map(
      rows.map((r) => [r.documentId as string, r.transactionTypeId]),
    );
  }

  /**
   * What an invoice is still owed, what is already claimed by waiting payment requests, and every
   * payment on it: requests in any state, plus receipts applied without one. A request that was
   * completed shows as its allocation (reversed if that was undone).
   */
  private async invoiceDetails(
    tenantId: string,
    invoices: Array<{
      id: string;
      status: string;
      totalAmount: Prisma.Decimal;
      currency: string;
    }>,
  ) {
    const details = new Map<string, Record<string, unknown>>();
    if (invoices.length === 0) return details;
    const invoiceIds = invoices.map((i) => i.id);
    const [allocations, requests] = await Promise.all([
      this.prisma.accountingReceivableAllocation.findMany({
        where: { tenantId, invoiceId: { in: invoiceIds } },
        include: { receipt: true },
        orderBy: { allocatedAt: 'asc' },
      }),
      this.prisma.accountingPaymentRequest.findMany({
        where: { tenantId, invoiceId: { in: invoiceIds } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    for (const invoice of invoices) {
      const mine = allocations.filter((a) => a.invoiceId === invoice.id);
      const applied = mine
        .filter((a) => a.reversedAt === null)
        .reduce((sum, a) => sum.plus(a.amount), new Prisma.Decimal(0));
      const outstanding =
        invoice.status === AccountingReceivableStatus.POSTED
          ? Prisma.Decimal.max(
              invoice.totalAmount.minus(applied),
              new Prisma.Decimal(0),
            )
          : new Prisma.Decimal(0);
      const myRequests = requests.filter((r) => r.invoiceId === invoice.id);
      const pending = myRequests
        .filter((r) => r.status === AccountingPaymentRequestStatus.PENDING)
        .reduce((sum, r) => sum.plus(r.amount), new Prisma.Decimal(0));
      const claimable = Prisma.Decimal.max(
        outstanding.minus(pending),
        new Prisma.Decimal(0),
      );

      const payments: Array<Record<string, unknown>> = [];
      const requestReceiptIds = new Set<string>();
      for (const r of myRequests) {
        let state: string = r.status;
        if (r.status === AccountingPaymentRequestStatus.COMPLETED) {
          if (r.receiptId) requestReceiptIds.add(r.receiptId);
          const allocation = mine.find(
            (a) => a.receiptId !== null && a.receiptId === r.receiptId,
          );
          state = allocation?.reversedAt ? 'REVERSED' : 'POSTED';
        }
        payments.push({
          id: r.id,
          kind: 'PAYMENT_REQUEST',
          state,
          stateLabel: PAYMENT_STATE_LABELS[state] ?? state,
          amount: r.amount.toFixed(2),
          currency: r.currency,
          paymentDate: r.paymentDate.toISOString().slice(0, 10),
          reference: r.reference,
          requestedByName: r.requestedByName,
          reason: r.rejectionReason,
          createdAt: r.createdAt.toISOString(),
        });
      }
      for (const a of mine) {
        if (
          a.sourceType !== 'RECEIPT' ||
          !a.receipt ||
          (a.receiptId && requestReceiptIds.has(a.receiptId))
        ) {
          continue;
        }
        const state = a.reversedAt ? 'REVERSED' : 'POSTED';
        payments.push({
          id: a.id,
          kind: 'RECEIPT',
          state,
          stateLabel: PAYMENT_STATE_LABELS[state],
          amount: a.amount.toFixed(2),
          currency: a.currency,
          paymentDate: a.allocatedAt.toISOString().slice(0, 10),
          reference: a.receipt.receiptNumber,
          requestedByName: null,
          reason: a.reversalReason,
          createdAt: a.allocatedAt.toISOString(),
        });
      }
      payments.sort((x, y) =>
        String(x.createdAt).localeCompare(String(y.createdAt)),
      );

      details.set(invoice.id, {
        outstandingAmount: outstanding.toFixed(2),
        pendingAmount: pending.toFixed(2),
        claimableAmount: claimable.toFixed(2),
        canRequestPayment:
          invoice.status === AccountingReceivableStatus.POSTED &&
          claimable.gt(0),
        payments,
      });
    }
    return details;
  }

  private item(input: {
    kind: 'INVOICE' | 'CREDIT_NOTE' | 'RECEIPT' | 'CASHBOOK';
    extra?: Record<string, unknown>;
    id: string;
    status: string;
    label: string;
    amount: Prisma.Decimal;
    currency: string;
    reference: string | null;
    reason: string | null;
    received: Prisma.Decimal;
    createdAt: Date;
  }) {
    return {
      kind: input.kind,
      id: input.id,
      state: input.status,
      stateLabel: STATE_LABELS[input.status] ?? input.status,
      amount: input.amount.toFixed(2),
      currency: input.currency,
      transactionTypeName: input.label,
      documentNumber: input.reference,
      reason: input.reason,
      receivedAmount: input.received.toFixed(2),
      createdAt: input.createdAt.toISOString(),
      ...input.extra,
    };
  }

  private cashbookLabel(type: CashbookTransactionType): string {
    return type === CashbookTransactionType.RECEIPT
      ? 'Receipt'
      : type.charAt(0) + type.slice(1).toLowerCase();
  }

  private notReadyMessage(reason: SourceNotReadyReason | undefined): string {
    switch (reason) {
      case 'SOURCE_NOT_LINKED':
        return 'Link the source in Accounting settings first';
      case 'NO_BASE_CURRENCY':
        return 'Set the base currency in Accounting settings first';
      case 'NO_ENTITY_TYPE':
        return 'No entity type is named on the linked transaction types';
      default:
        return 'No usable transaction type is linked to this source yet';
    }
  }

  private registration(module: string): SourceRegistration {
    const registration = registrationFor(module);
    if (!registration) {
      throw new BadRequestException(
        `${module} cannot raise transactions in Accounting`,
      );
    }
    return registration;
  }

  /** Drafts are attributed to the person who asked, not to the calling service. */
  private internalUser(tenantId: string, actingUserId: string): RequestUser {
    return {
      id: actingUserId,
      email: '',
      role: 'SYSTEM',
      tenantId,
      tenantSlug: '',
      tenantName: '',
      firstName: '',
      moduleConfig: {},
      featureConfig: {},
      permissions: [],
    } as RequestUser;
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
