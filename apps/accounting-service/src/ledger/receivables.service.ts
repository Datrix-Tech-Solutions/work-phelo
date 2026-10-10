import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  AccountingPaymentRequestStatus,
  AccountingReceivableAllocationSource,
  AccountingReceivableDocumentType,
  AccountingReceivableStatus,
  FiscalPeriodStatus,
  GLAccountCategory,
  JournalStatus,
  PostingDirection,
  Prisma,
  RecordStatus,
  TransactionTypeCategory,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { agingBucket, partyAging } from './aging.util';
import { CashbookService } from './cashbook.service';
import { CreateJournalDto, VoidEntryDto } from './dto/accounting.dto';
import { CreateCashbookReceiptDto } from './dto/cashbook.dto';
import {
  RejectDraftDto,
  UpdateReceivableInvoiceDraftDto,
} from './dto/draft-actions.dto';
import {
  CreateCreditNoteAllocationDto,
  CreateReceivableCreditNoteDto,
  EditReceivableInvoiceDto,
  EditReceivableNoteDto,
  EditReceivableReceiptDto,
  RestoreReceivableInvoiceDto,
  CreateReceivableInvoiceDto,
  CreateReceivableReceiptDto,
  CreateReceiptAllocationDto,
  QueryReceiptsDto,
  QueryReceivableAgingDto,
  QueryReceivableDocumentsDto,
  ReverseAllocationDto,
  ReverseReceivableDto,
} from './dto/receivables.dto';
import { JournalsService } from './journals.service';
import { normalizeDocumentLines } from './document-lines';
import { settlementEntryLines } from './cashbook-lines.util';
import {
  BreakdownEntry,
  buildFormBreakdown,
  FormAdjustment,
  FormTax,
  hasFormBreakdown,
} from './document-adjustments';
import { resolveMainLineAccount } from './rule-account-scope';
import {
  SourceTransactionEvent,
  SourceEventsNotifier,
} from './source-transactions/source-events.notifier';

const zero = new Prisma.Decimal(0);
/** Marks an allocation released because its receipt or credit note was voided, so a restore can re-apply it. */
const RELEASED_BY_VOID = 'VOIDED_WITH_SOURCE';
const RESTORED_AFTER_VOID = 'VOIDED_WITH_SOURCE_RESTORED';
// SubledgerAccount (the generic Entity behind every customer/vendor) doesn't carry a
// payment-terms field the way the old AccountingCustomer master record did — fall back to
// the same 30-day default that record always used unless the invoice sets an explicit due date.
const DEFAULT_PAYMENT_TERMS_DAYS = 30;

const receivableDocumentInclude = {
  customer: {
    select: {
      id: true,
      code: true,
      name: true,
      currency: true,
      type: true,
      contactName: true,
      phone: true,
      address: true,
    },
  },
  offsetGlAccount: { select: { id: true, code: true, name: true } },
  costCentre: { select: { id: true, code: true, name: true } },
  lines: {
    orderBy: { sequence: 'asc' as const },
    include: {
      glAccount: { select: { id: true, code: true, name: true } },
      costCentre: { select: { id: true, code: true, name: true } },
    },
  },
  arAccount: { select: { id: true, code: true, name: true } },
  postedJournalEntry: {
    select: { id: true, journalNumber: true, status: true, postedAt: true },
  },
  reversalJournalEntry: {
    select: { id: true, journalNumber: true, status: true, postedAt: true },
  },
  originalInvoice: {
    select: {
      id: true,
      documentNumber: true,
      totalAmount: true,
      status: true,
    },
  },
} satisfies Prisma.AccountingReceivableDocumentInclude;

const receivableReceiptInclude = {
  customer: {
    select: { id: true, code: true, name: true, currency: true },
  },
  cashbookTransaction: {
    select: {
      id: true,
      status: true,
      reference: true,
      postedJournalEntryId: true,
      reversalJournalEntryId: true,
    },
  },
} satisfies Prisma.AccountingReceivableReceiptInclude;

type TransactionClient = Prisma.TransactionClient;
type ReceivableDocument = Prisma.AccountingReceivableDocumentGetPayload<{
  include: typeof receivableDocumentInclude;
}>;

@Injectable()
export class ReceivablesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cashbook: CashbookService,
    private readonly journals: JournalsService,
    @Optional() private readonly sourceEvents?: SourceEventsNotifier,
  ) {}

  async summary(tenantId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() + 6);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const [invoices, allocations, receipts] = await Promise.all([
      this.prisma.accountingReceivableDocument.findMany({
        where: {
          tenantId,
          documentType: AccountingReceivableDocumentType.INVOICE,
          status: AccountingReceivableStatus.POSTED,
        },
        select: { id: true, totalAmount: true, currency: true, dueDate: true },
      }),
      this.prisma.accountingReceivableAllocation.findMany({
        where: { tenantId, reversedAt: null },
        select: { invoiceId: true, amount: true },
      }),
      this.prisma.accountingReceivableReceipt.findMany({
        where: {
          tenantId,
          status: AccountingReceivableStatus.POSTED,
          receiptDate: { gte: monthStart },
        },
        select: { currency: true, amount: true },
      }),
    ]);
    const applied = new Map<string, Prisma.Decimal>();
    for (const allocation of allocations)
      applied.set(
        allocation.invoiceId,
        (applied.get(allocation.invoiceId) ?? zero).plus(allocation.amount),
      );
    const outstanding = new Map<string, Prisma.Decimal>();
    let overdueInvoices = 0;
    let dueThisWeek = 0;
    for (const invoice of invoices) {
      const balance = invoice.totalAmount.minus(
        applied.get(invoice.id) ?? zero,
      );
      if (balance.lessThanOrEqualTo(0)) continue;
      outstanding.set(
        invoice.currency,
        (outstanding.get(invoice.currency) ?? zero).plus(balance),
      );
      if (invoice.dueDate && invoice.dueDate < today) overdueInvoices += 1;
      if (
        invoice.dueDate &&
        invoice.dueDate >= today &&
        invoice.dueDate <= weekEnd
      )
        dueThisWeek += 1;
    }
    const collected = new Map<string, Prisma.Decimal>();
    for (const receipt of receipts)
      collected.set(
        receipt.currency,
        (collected.get(receipt.currency) ?? zero).plus(receipt.amount),
      );
    return {
      outstandingByCurrency: this.summaryTotals(outstanding),
      overdueInvoices,
      dueThisWeek,
      collectedMtdByCurrency: this.summaryTotals(collected),
    };
  }

  private summaryTotals(totals: Map<string, Prisma.Decimal>) {
    return Array.from(totals.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([currency, amount]) => ({ currency, amount: this.money(amount) }));
  }

  async aging(tenantId: string, query: QueryReceivableAgingDto) {
    const asOfDate = this.asOfDate(query.asOfDate);
    const rows = await this.openItems(tenantId, asOfDate, query.customerId);
    return {
      asOfDate,
      ...this.agingResult(asOfDate, rows),
      parties: partyAging(
        asOfDate,
        rows,
        (row) => row.customer,
        (value) => this.money(value),
      ),
    };
  }

  async statement(tenantId: string, customerId: string, asOf?: string) {
    const asOfDate = this.asOfDate(asOf);
    const customer = await this.resolveCustomer(tenantId, customerId);
    const rows = await this.openItems(tenantId, asOfDate, customerId);
    return {
      asOfDate,
      customer: {
        id: customer.id,
        code: customer.code,
        name: customer.name,
      },
      ...this.agingResult(asOfDate, rows),
      documents: rows,
    };
  }

  private async openItems(
    tenantId: string,
    asOfDate: Date,
    customerId?: string,
  ) {
    const [invoices, allocations] = await Promise.all([
      this.prisma.accountingReceivableDocument.findMany({
        where: {
          tenantId,
          customerId,
          documentType: AccountingReceivableDocumentType.INVOICE,
          status: AccountingReceivableStatus.POSTED,
          documentDate: { lte: asOfDate },
        },
        select: {
          id: true,
          documentNumber: true,
          documentDate: true,
          dueDate: true,
          currency: true,
          totalAmount: true,
          customer: { select: { id: true, code: true, name: true } },
        },
        orderBy: [{ dueDate: 'asc' }, { documentDate: 'asc' }],
      }),
      this.prisma.accountingReceivableAllocation.findMany({
        where: { tenantId, reversedAt: null, allocatedAt: { lte: asOfDate } },
        select: { invoiceId: true, amount: true },
      }),
    ]);
    const applied = new Map<string, Prisma.Decimal>();
    for (const allocation of allocations)
      applied.set(
        allocation.invoiceId,
        (applied.get(allocation.invoiceId) ?? zero).plus(allocation.amount),
      );
    return invoices
      .map((invoice) => ({
        ...invoice,
        outstandingAmount: this.money(
          invoice.totalAmount.minus(applied.get(invoice.id) ?? zero),
        ),
      }))
      .filter((invoice) =>
        new Prisma.Decimal(invoice.outstandingAmount).greaterThan(0),
      );
  }

  private agingResult(
    asOfDate: Date,
    rows: Awaited<ReturnType<ReceivablesService['openItems']>>,
  ) {
    const buckets = ['CURRENT', '1_30', '31_60', '61_90', 'OVER_90'] as const;
    const totals = new Map<
      string,
      Record<(typeof buckets)[number], Prisma.Decimal>
    >();
    for (const row of rows) {
      const total =
        totals.get(row.currency) ??
        (Object.fromEntries(buckets.map((bucket) => [bucket, zero])) as Record<
          (typeof buckets)[number],
          Prisma.Decimal
        >);
      const { bucket } = agingBucket(asOfDate, row.dueDate);
      total[bucket] = total[bucket].plus(row.outstandingAmount);
      totals.set(row.currency, total);
    }
    return {
      agingByCurrency: Array.from(totals.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([currency, amounts]) => ({
          currency,
          ...Object.fromEntries(
            buckets.map((bucket) => [bucket, this.money(amounts[bucket])]),
          ),
        })),
    };
  }

  private asOfDate(value?: string) {
    const date = value ? new Date(value) : new Date();
    date.setHours(23, 59, 59, 999);
    return date;
  }

  /**
   * Everything an invoice form decides - the customer, items, taxes and accounts - worked out and
   * checked, without writing anything. Creating an invoice and editing a posted one share it, so
   * both hold an invoice to exactly the same rules.
   */
  private async prepareInvoice(
    user: RequestUser,
    dto: CreateReceivableInvoiceDto,
  ) {
    const [customer] = await Promise.all([
      this.resolveCustomer(user.tenantId, dto.customerId),
      this.assertActiveCurrency(user.tenantId, dto.currency),
    ]);
    this.assertCustomerCurrency(customer.currency, dto.currency);

    const { lines: itemLines, subtotal: subtotalAmount } =
      await this.resolveDocumentLines(user.tenantId, dto);
    const {
      arAccountId,
      taxAmount,
      taxBreakdown,
      netAdjustment,
      lineAccounts,
      transactionTypeCode,
    } = await this.resolveRulePosting(
      user.tenantId,
      dto.transactionTypeId,
      TransactionTypeCategory.RECEIVABLE,
      subtotalAmount,
      dto.selectedTaxTypeIds,
      false,
      {
        lineAccountIds: itemLines.map((line) => line.glAccountId),
        taxes: dto.taxes,
        adjustments: dto.adjustments,
        documentDate: dto.documentDate,
      },
    );
    for (const accountId of new Set(lineAccounts)) {
      await this.assertPostingOffsetAccount(user.tenantId, accountId);
    }
    // Taxes and charges add to what is owed; deductions take away from it.
    const totalAmount = subtotalAmount.plus(taxAmount).plus(netAdjustment);
    if (totalAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'The deductions leave nothing owed — the total must be above zero',
      );
    }
    return {
      transactionTypeCode,
      lineWrites: this.documentLineWrites(itemLines, lineAccounts),
      totalAmount,
      fields: {
        customerId: customer.id,
        documentDate: new Date(dto.documentDate),
        dueDate: new Date(
          dto.dueDate ??
            this.addDays(dto.documentDate, DEFAULT_PAYMENT_TERMS_DAYS),
        ),
        currency: dto.currency,
        exchangeRate: dto.exchangeRate,
        subtotalAmount,
        // A single item keeps its quantity × price on the document; with several, each line
        // carries its own.
        quantity: itemLines.length === 1 ? itemLines[0].quantity : undefined,
        unitPrice: itemLines.length === 1 ? itemLines[0].unitPrice : undefined,
        taxAmount,
        totalAmount,
        description: this.optional(dto.description),
        externalReference: this.optional(dto.externalReference),
        offsetGlAccountId: lineAccounts[0],
        costCentreId:
          itemLines.length === 1
            ? this.optional(itemLines[0].costCentreId)
            : null,
        arAccountId,
        transactionTypeId: dto.transactionTypeId,
        taxBreakdown,
      },
    };
  }

  async createInvoice(user: RequestUser, dto: CreateReceivableInvoiceDto) {
    const prepared = await this.prepareInvoice(user, dto);
    const document = await this.withDocumentNumberLock(
      user.tenantId,
      `invoice:${prepared.transactionTypeCode}`,
      async (tx) => {
        const documentNumber = await this.nextRuleDocumentNumber(
          tx,
          user.tenantId,
          prepared.transactionTypeCode,
        );
        return tx.accountingReceivableDocument.create({
          data: {
            tenantId: user.tenantId,
            documentType: AccountingReceivableDocumentType.INVOICE,
            documentNumber,
            ...prepared.fields,
            sourceModule: this.optional(dto.sourceModule),
            sourceRecordId: this.optional(dto.sourceRecordId),
            lines: { create: prepared.lineWrites },
            createdByUserId: user.id,
            updatedByUserId: user.id,
          },
          include: receivableDocumentInclude,
        });
      },
    );
    await this.recordAudit(
      user,
      'RECEIVABLE_INVOICE_CREATED',
      'AccountingReceivableDocument',
      document.id,
      {
        documentNumber: document.documentNumber,
        totalAmount: prepared.totalAmount,
      },
    );
    return document;
  }

  async createCreditNote(
    user: RequestUser,
    dto: CreateReceivableCreditNoteDto,
  ) {
    if (dto.transactionTypeId) {
      return this.createRuleCreditNote(user, dto, dto.transactionTypeId);
    }
    if (!dto.offsetGlAccountId || !dto.arAccountId) {
      throw new BadRequestException(
        'offsetGlAccountId and arAccountId are required unless a transactionTypeId is given',
      );
    }
    if (dto.amount === undefined) {
      throw new BadRequestException('amount is required');
    }
    const manualAmount = dto.amount;
    const { offsetGlAccountId, arAccountId } = dto;
    const [customer] = await Promise.all([
      this.resolveCustomer(user.tenantId, dto.customerId),
      this.assertActiveCurrency(user.tenantId, dto.currency),
      this.assertActiveCostCentre(user.tenantId, dto.costCentreId),
      this.assertPostingOffsetAccount(user.tenantId, offsetGlAccountId),
      this.assertArAccount(user.tenantId, arAccountId),
    ]);
    this.assertCustomerCurrency(customer.currency, dto.currency);
    if (dto.originalInvoiceId) {
      const invoice = await this.getDocumentForTenant(
        user.tenantId,
        dto.originalInvoiceId,
      );
      if (
        invoice.documentType !== AccountingReceivableDocumentType.INVOICE ||
        invoice.customerId !== customer.id ||
        invoice.status !== AccountingReceivableStatus.POSTED
      ) {
        throw new BadRequestException(
          'Credit notes can only reference a posted invoice for the same customer',
        );
      }
      if (invoice.currency !== dto.currency) {
        throw new BadRequestException(
          'Cross-currency invoice credit allocation is not supported in Phase 1',
        );
      }
      const outstanding = await this.invoiceOutstandingAmount(
        user.tenantId,
        invoice.id,
      );
      if (new Prisma.Decimal(manualAmount).greaterThan(outstanding)) {
        throw new ConflictException(
          'Invoice-specific credit note cannot exceed invoice outstanding balance',
        );
      }
    }

    const { subtotalAmount, taxAmount, totalAmount } = this.documentAmounts({
      ...dto,
      amount: manualAmount,
    });
    const document = await this.withDocumentNumberLock(
      user.tenantId,
      'ARC',
      async (tx) => {
        const documentNumber = await this.nextDocumentNumber(
          tx,
          user.tenantId,
          'ARC',
        );
        return tx.accountingReceivableDocument.create({
          data: {
            tenantId: user.tenantId,
            customerId: customer.id,
            documentType: AccountingReceivableDocumentType.CREDIT_NOTE,
            documentNumber,
            documentDate: new Date(dto.documentDate),
            currency: dto.currency,
            exchangeRate: dto.exchangeRate,
            subtotalAmount,
            taxAmount,
            totalAmount,
            description: this.optional(dto.description),
            externalReference: this.optional(dto.externalReference),
            sourceModule: this.optional(dto.sourceModule),
            sourceRecordId: this.optional(dto.sourceRecordId),
            offsetGlAccountId,
            costCentreId: this.optional(dto.costCentreId),
            arAccountId,
            originalInvoiceId: this.optional(dto.originalInvoiceId),
            createdByUserId: user.id,
            updatedByUserId: user.id,
          },
          include: receivableDocumentInclude,
        });
      },
    );
    await this.recordAudit(
      user,
      'RECEIVABLE_CREDIT_NOTE_CREATED',
      'AccountingReceivableDocument',
      document.id,
      { documentNumber: document.documentNumber, totalAmount },
    );
    return document;
  }

  /** Rule-driven credit note: created from a linked Receivable transaction type. The
   *  accounts and tax lines come from the type's rule (written in the note's own direction)
   *  and it must reference an original posted invoice, which it reduces once posted. */
  private async createRuleCreditNote(
    user: RequestUser,
    dto: CreateReceivableCreditNoteDto,
    transactionTypeId: string,
  ) {
    const [customer] = await Promise.all([
      this.resolveCustomer(user.tenantId, dto.customerId),
      this.assertActiveCurrency(user.tenantId, dto.currency),
    ]);
    this.assertCustomerCurrency(customer.currency, dto.currency);
    if (!dto.originalInvoiceId) {
      throw new BadRequestException(
        'A linked transaction must reference an original invoice',
      );
    }

    const { lines: itemLines, subtotal: subtotalAmount } =
      await this.resolveDocumentLines(user.tenantId, dto);
    const {
      arAccountId,
      taxAmount,
      taxBreakdown,
      netAdjustment,
      lineAccounts,
      transactionTypeCode,
    } = await this.resolveRulePosting(
      user.tenantId,
      transactionTypeId,
      TransactionTypeCategory.RECEIVABLE,
      subtotalAmount,
      dto.selectedTaxTypeIds,
      true,
      {
        lineAccountIds: itemLines.map((line) => line.glAccountId),
        taxes: dto.taxes,
        adjustments: dto.adjustments,
        documentDate: dto.documentDate,
      },
    );
    for (const accountId of new Set(lineAccounts)) {
      await this.assertPostingOffsetAccount(user.tenantId, accountId);
    }
    // Taxes and charges add to what is owed; deductions take away from it.
    const totalAmount = subtotalAmount.plus(taxAmount).plus(netAdjustment);
    if (totalAmount.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'The deductions leave nothing owed — the total must be above zero',
      );
    }

    const original = await this.getDocumentForTenant(
      user.tenantId,
      dto.originalInvoiceId,
    );
    if (
      original.documentType !== AccountingReceivableDocumentType.INVOICE ||
      original.customerId !== customer.id ||
      original.status !== AccountingReceivableStatus.POSTED
    ) {
      throw new BadRequestException(
        'Credit notes can only reference a posted invoice for the same customer',
      );
    }
    if (original.currency !== dto.currency) {
      throw new BadRequestException(
        'Cross-currency invoice credit allocation is not supported in Phase 1',
      );
    }
    if (original.arAccountId !== arAccountId) {
      throw new BadRequestException(
        'This credit note type posts to a different receivable account than the invoice — use a rule with the same receivable account',
      );
    }
    const outstanding = await this.invoiceOutstandingAmount(
      user.tenantId,
      original.id,
    );
    if (totalAmount.greaterThan(outstanding)) {
      throw new ConflictException(
        'Credit note cannot exceed the invoice outstanding balance',
      );
    }

    const document = await this.withDocumentNumberLock(
      user.tenantId,
      `credit-note:${transactionTypeCode}`,
      async (tx) => {
        const documentNumber = await this.nextRuleDocumentNumber(
          tx,
          user.tenantId,
          transactionTypeCode,
        );
        return tx.accountingReceivableDocument.create({
          data: {
            tenantId: user.tenantId,
            customerId: customer.id,
            documentType: AccountingReceivableDocumentType.CREDIT_NOTE,
            documentNumber,
            documentDate: new Date(dto.documentDate),
            currency: dto.currency,
            exchangeRate: dto.exchangeRate,
            subtotalAmount,
            // A single item keeps its quantity × price on the document; with several, each line
            // carries its own.
            quantity:
              itemLines.length === 1 ? itemLines[0].quantity : undefined,
            unitPrice:
              itemLines.length === 1 ? itemLines[0].unitPrice : undefined,
            taxAmount,
            totalAmount,
            description: this.optional(dto.description),
            externalReference: this.optional(dto.externalReference),
            sourceModule: this.optional(dto.sourceModule),
            sourceRecordId: this.optional(dto.sourceRecordId),
            offsetGlAccountId: lineAccounts[0],
            costCentreId:
              itemLines.length === 1
                ? this.optional(itemLines[0].costCentreId)
                : null,
            lines: { create: this.documentLineWrites(itemLines, lineAccounts) },
            arAccountId,
            transactionTypeId,
            taxBreakdown,
            originalInvoiceId: original.id,
            createdByUserId: user.id,
            updatedByUserId: user.id,
          },
          include: receivableDocumentInclude,
        });
      },
    );
    await this.recordAudit(
      user,
      'RECEIVABLE_CREDIT_NOTE_CREATED',
      'AccountingReceivableDocument',
      document.id,
      { documentNumber: document.documentNumber, totalAmount },
    );
    return document;
  }

  /** The listed shape (with payment state) for specific documents, in the order of `ids`. */
  async listDocumentsByIds(tenantId: string, ids: string[]) {
    if (ids.length === 0) return [];
    const items = await this.prisma.accountingReceivableDocument.findMany({
      where: { tenantId, id: { in: ids } },
      include: receivableDocumentInclude,
    });
    const withState = await this.attachPaymentStates(tenantId, items);
    const byId = new Map(withState.map((item) => [item.id, item]));
    return ids.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
  }

  listInvoices(tenantId: string, query: QueryReceivableDocumentsDto) {
    return this.listDocuments(
      tenantId,
      AccountingReceivableDocumentType.INVOICE,
      query,
    );
  }

  listCreditNotes(tenantId: string, query: QueryReceivableDocumentsDto) {
    return this.listDocuments(
      tenantId,
      AccountingReceivableDocumentType.CREDIT_NOTE,
      query,
    );
  }

  async getInvoice(user: RequestUser, invoiceId: string) {
    const document = await this.getDocumentForTenant(user.tenantId, invoiceId);
    if (document.documentType !== AccountingReceivableDocumentType.INVOICE) {
      throw new NotFoundException('Invoice not found');
    }
    return document;
  }

  async getCreditNote(user: RequestUser, creditNoteId: string) {
    const document = await this.getDocumentForTenant(
      user.tenantId,
      creditNoteId,
    );
    if (
      document.documentType !== AccountingReceivableDocumentType.CREDIT_NOTE
    ) {
      throw new NotFoundException('Credit note not found');
    }
    return document;
  }

  async postInvoice(user: RequestUser, invoiceId: string) {
    const posted = await this.postDocument(
      user,
      invoiceId,
      AccountingReceivableDocumentType.INVOICE,
    );
    await this.notifySource(user.tenantId, invoiceId, 'POSTED');
    return posted;
  }

  async postCreditNote(user: RequestUser, creditNoteId: string) {
    return this.postDocument(
      user,
      creditNoteId,
      AccountingReceivableDocumentType.CREDIT_NOTE,
    );
  }

  async reverseInvoice(
    user: RequestUser,
    invoiceId: string,
    dto: ReverseReceivableDto,
  ) {
    const reversed = await this.reverseDocument(
      user,
      invoiceId,
      AccountingReceivableDocumentType.INVOICE,
      dto,
    );
    await this.notifySource(user.tenantId, invoiceId, 'REVERSED');
    return reversed;
  }

  /**
   * Completes a draft invoice - the dates, currency, tax lines, cost centre and references. What the
   * draft is for stays fixed: the amount, quantity, unit price, entity and transaction type were set
   * when it was raised (by the accountant or by another module) and cannot be edited here.
   */
  async updateInvoiceDraft(
    user: RequestUser,
    invoiceId: string,
    dto: UpdateReceivableInvoiceDraftDto,
  ) {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('At least one field is required');
    }
    const document = await this.prisma.accountingReceivableDocument.findFirst({
      where: {
        id: invoiceId,
        tenantId: user.tenantId,
        documentType: AccountingReceivableDocumentType.INVOICE,
      },
      include: { lines: { select: { id: true } } },
    });
    if (!document) throw new NotFoundException('Invoice not found');
    if (document.status !== AccountingReceivableStatus.DRAFT) {
      throw new ConflictException('Only draft invoices can be edited');
    }

    const data: Prisma.AccountingReceivableDocumentUncheckedUpdateManyInput = {
      updatedByUserId: user.id,
    };
    if (dto.currency !== undefined && dto.currency !== document.currency) {
      const customer = await this.resolveCustomer(
        user.tenantId,
        document.customerId,
      );
      await this.assertActiveCurrency(user.tenantId, dto.currency);
      this.assertCustomerCurrency(customer.currency, dto.currency);
      data.currency = dto.currency;
    }
    if (dto.exchangeRate !== undefined) data.exchangeRate = dto.exchangeRate;
    if (dto.documentDate !== undefined)
      data.documentDate = new Date(dto.documentDate);
    if (dto.dueDate !== undefined) data.dueDate = new Date(dto.dueDate);
    if (dto.description !== undefined)
      data.description = this.optional(dto.description);
    if (dto.externalReference !== undefined) {
      data.externalReference = this.optional(dto.externalReference);
    }
    if (dto.costCentreId !== undefined && (document.lines?.length ?? 0) > 0) {
      throw new ConflictException(
        "This invoice's cost centres were set on its items and can't be changed here yet",
      );
    }
    if (dto.costCentreId !== undefined) {
      if (dto.costCentreId !== null) {
        await this.assertActiveCostCentre(user.tenantId, dto.costCentreId);
      }
      data.costCentreId = dto.costCentreId;
    }
    if (dto.selectedTaxTypeIds !== undefined) {
      if (!document.transactionTypeId) {
        throw new BadRequestException(
          'This invoice has no transaction type, so its tax lines cannot be changed',
        );
      }
      if (hasFormBreakdown(document.taxBreakdown)) {
        throw new ConflictException(
          "This draft's taxes, deductions and charges were added on its form and can't be changed here yet",
        );
      }
      // Only the tax lines are taken from the rule; the accounts the draft already resolved stay put.
      const posting = await this.resolveRulePosting(
        user.tenantId,
        document.transactionTypeId,
        TransactionTypeCategory.RECEIVABLE,
        document.subtotalAmount,
        dto.selectedTaxTypeIds,
        false,
        { taxOnly: true },
      );
      data.taxAmount = posting.taxAmount;
      data.taxBreakdown = posting.taxBreakdown;
      data.totalAmount = document.subtotalAmount.plus(posting.taxAmount);
    }

    const claimed = await this.prisma.accountingReceivableDocument.updateMany({
      where: {
        id: document.id,
        tenantId: user.tenantId,
        status: AccountingReceivableStatus.DRAFT,
      },
      data,
    });
    if (claimed.count !== 1) {
      throw new ConflictException('Invoice was changed by another request');
    }
    await this.recordAudit(
      user,
      'RECEIVABLE_INVOICE_DRAFT_UPDATED',
      'AccountingReceivableDocument',
      document.id,
      { changed: Object.keys(dto) },
    );
    return this.getInvoice(user, invoiceId);
  }

  /** Turns a draft invoice down. It keeps its record, never posts, and the reason is stored. */
  async rejectInvoice(
    user: RequestUser,
    invoiceId: string,
    dto: RejectDraftDto,
  ) {
    const claimed = await this.prisma.accountingReceivableDocument.updateMany({
      where: {
        id: invoiceId,
        tenantId: user.tenantId,
        documentType: AccountingReceivableDocumentType.INVOICE,
        status: AccountingReceivableStatus.DRAFT,
      },
      data: {
        status: AccountingReceivableStatus.REJECTED,
        rejectedAt: new Date(),
        rejectedByUserId: user.id,
        rejectionReason: dto.reason,
        updatedByUserId: user.id,
      },
    });
    if (claimed.count !== 1) {
      const exists = await this.prisma.accountingReceivableDocument.findFirst({
        where: {
          id: invoiceId,
          tenantId: user.tenantId,
          documentType: AccountingReceivableDocumentType.INVOICE,
        },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Invoice not found');
      throw new ConflictException('Only draft invoices can be rejected');
    }
    await this.recordAudit(
      user,
      'RECEIVABLE_INVOICE_REJECTED',
      'AccountingReceivableDocument',
      invoiceId,
      { reason: dto.reason },
    );
    await this.notifySource(user.tenantId, invoiceId, 'REJECTED');
    return this.getInvoice(user, invoiceId);
  }

  /** Tells the module that raised an invoice what happened to it. Never fails the action itself. */
  private async notifySource(
    tenantId: string,
    documentId: string,
    event: SourceTransactionEvent,
  ) {
    if (!this.sourceEvents) return;
    const document = await this.prisma.accountingReceivableDocument.findFirst({
      where: { id: documentId, tenantId },
      select: { sourceModule: true },
    });
    await this.sourceEvents.notify({
      tenantId,
      sourceModule: document?.sourceModule,
      transactionId: documentId,
      event,
    });
  }

  async reverseCreditNote(
    user: RequestUser,
    creditNoteId: string,
    dto: ReverseReceivableDto,
  ) {
    return this.reverseDocument(
      user,
      creditNoteId,
      AccountingReceivableDocumentType.CREDIT_NOTE,
      dto,
    );
  }

  async createReceipt(user: RequestUser, dto: CreateReceivableReceiptDto) {
    const [customer] = await Promise.all([
      this.resolveCustomer(user.tenantId, dto.customerId),
      this.assertActiveCurrency(user.tenantId, dto.currency),
    ]);
    this.assertCustomerCurrency(customer.currency, dto.currency);
    const invoice = await this.getDocumentForTenant(
      user.tenantId,
      dto.invoiceId,
    );
    if (invoice.customerId !== customer.id) {
      throw new BadRequestException(
        'The invoice does not belong to this customer',
      );
    }
    if (invoice.status !== AccountingReceivableStatus.POSTED) {
      throw new BadRequestException('The invoice must be posted');
    }

    // Deductions and charges taken at settlement make the cash differ from the amount settled:
    // the entry then posts the amount to Trade Receivable plus each adjustment, and its own
    // amount is the net cash that actually reaches the bank. The receipt keeps the amount
    // settled, which is what gets allocated to the invoice.
    const adjustments = dto.adjustments ?? [];
    const cashbookDto: CreateCashbookReceiptDto = {
      cashAccountId: dto.cashAccountId,
      ...(adjustments.length
        ? {
            lines: settlementEntryLines({
              controlAccountId: invoice.arAccountId,
              amount: dto.amount,
              adjustments,
            }),
          }
        : { amount: dto.amount, offsetGlAccountId: invoice.arAccountId }),
      currency: dto.currency,
      transactionDate: dto.receiptDate,
      settlementMethod: dto.settlementMethod,
      reference: dto.reference,
      counterpartyType: 'CUSTOMER',
      counterpartyId: customer.id,
      externalReference: dto.externalReference,
      description: dto.description ?? `Receipt from ${customer.name}`,
      offsetSubledgerAccountId: customer.id,
      sourceModule: dto.sourceModule ?? 'ACCOUNTING',
      sourceRecordId: dto.sourceRecordId ?? 'AR_RECEIPT_PENDING',
      exchangeRate: dto.exchangeRate,
    };
    const cashbookTransaction = await this.cashbook.createReceipt(
      user,
      cashbookDto,
    );
    const receipt = await this.withDocumentNumberLock(
      user.tenantId,
      'ARR',
      async (tx) => {
        const receiptNumber = await this.nextReceiptNumber(tx, user.tenantId);
        return tx.accountingReceivableReceipt.create({
          data: {
            tenantId: user.tenantId,
            customerId: customer.id,
            arAccountId: invoice.arAccountId,
            cashbookTransactionId: cashbookTransaction.id,
            receiptNumber,
            receiptDate: new Date(dto.receiptDate),
            currency: dto.currency,
            amount: dto.amount,
            exchangeRate: dto.exchangeRate,
            reference: this.optional(dto.reference),
            description: this.optional(dto.description),
            externalReference: this.optional(dto.externalReference),
            sourceModule: this.optional(dto.sourceModule),
            sourceRecordId: this.optional(dto.sourceRecordId),
            createdByUserId: user.id,
            updatedByUserId: user.id,
          },
          include: receivableReceiptInclude,
        });
      },
    );
    await this.prisma.cashbookTransaction.update({
      where: {
        id_tenantId: {
          id: cashbookTransaction.id,
          tenantId: user.tenantId,
        },
      },
      data: {
        sourceModule: dto.sourceModule ?? 'ACCOUNTING',
        sourceRecordId: dto.sourceRecordId ?? receipt.id,
      },
    });
    await this.recordAudit(
      user,
      'RECEIVABLE_RECEIPT_CREATED',
      'AccountingReceivableReceipt',
      receipt.id,
      {
        receiptNumber: receipt.receiptNumber,
        cashbookTransactionId: cashbookTransaction.id,
      },
    );
    return receipt;
  }

  listReceipts(tenantId: string, query: QueryReceiptsDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 25), 100);
    const where: Prisma.AccountingReceivableReceiptWhereInput = {
      tenantId,
      ...(query.customerId ? { customerId: query.customerId } : {}),
      // Voided entries live in the archive; they only show when asked for by status.
      status: query.status ?? { not: AccountingReceivableStatus.VOIDED },
      ...(query.currency ? { currency: query.currency } : {}),
      ...(query.cashAccountId
        ? { cashbookTransaction: { cashAccountId: query.cashAccountId } }
        : {}),
      ...(query.fromDate || query.toDate
        ? {
            receiptDate: {
              ...(query.fromDate
                ? { gte: this.startOfDay(query.fromDate) }
                : {}),
              ...(query.toDate ? { lte: this.endOfDay(query.toDate) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                receiptNumber: { contains: query.search, mode: 'insensitive' },
              },
              { reference: { contains: query.search, mode: 'insensitive' } },
              {
                externalReference: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
    return this.paginateReceipts(where, page, limit);
  }

  async getReceipt(user: RequestUser, receiptId: string) {
    const receipt = await this.prisma.accountingReceivableReceipt.findFirst({
      where: { id: receiptId, tenantId: user.tenantId },
      include: receivableReceiptInclude,
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    return receipt;
  }

  async postReceipt(user: RequestUser, receiptId: string) {
    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.accountingReceivableReceipt.findFirst({
        where: { id: receiptId, tenantId: user.tenantId },
        include: receivableReceiptInclude,
      });
      if (!receipt) throw new NotFoundException('Receipt not found');
      if (receipt.status !== AccountingReceivableStatus.DRAFT) {
        throw new ConflictException('Only draft receipts can be posted');
      }
      const postedCashbook = await this.cashbook.postTransactionInTransaction(
        tx,
        user,
        receipt.cashbookTransactionId,
      );
      const updated = await tx.accountingReceivableReceipt.update({
        where: { id_tenantId: { id: receipt.id, tenantId: user.tenantId } },
        data: {
          status: AccountingReceivableStatus.POSTED,
          postedAt: new Date(),
          postedByUserId: user.id,
          updatedByUserId: user.id,
        },
        include: receivableReceiptInclude,
      });
      await tx.accountingAuditLog.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: 'RECEIVABLE_RECEIPT_POSTED',
          entityType: 'AccountingReceivableReceipt',
          entityId: receipt.id,
          changedFields: {
            cashbookJournalEntryId: postedCashbook.postedJournalEntryId,
          },
        },
      });
      return updated;
    });
  }

  async reverseReceipt(
    user: RequestUser,
    receiptId: string,
    dto: ReverseReceivableDto,
  ) {
    const receipt = await this.getReceipt(user, receiptId);
    if (receipt.status !== AccountingReceivableStatus.POSTED) {
      throw new ConflictException('Only posted receipts can be reversed');
    }
    const activeAllocations =
      await this.prisma.accountingReceivableAllocation.count({
        where: {
          tenantId: user.tenantId,
          receiptId: receipt.id,
          reversedAt: null,
        },
      });
    if (activeAllocations > 0) {
      throw new ConflictException(
        'Reverse active receipt allocations before reversing the receipt',
      );
    }
    return this.prisma.$transaction(async (tx) => {
      const reversal = await this.cashbook.reverseTransactionInTransaction(
        tx,
        user,
        receipt.cashbookTransactionId,
        dto,
      );
      const updated = await tx.accountingReceivableReceipt.update({
        where: { id_tenantId: { id: receipt.id, tenantId: user.tenantId } },
        data: {
          status: AccountingReceivableStatus.REVERSED,
          reversedAt: new Date(),
          reversedByUserId: user.id,
          updatedByUserId: user.id,
        },
        include: receivableReceiptInclude,
      });
      await tx.accountingAuditLog.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: 'RECEIVABLE_RECEIPT_REVERSED',
          entityType: 'AccountingReceivableReceipt',
          entityId: receipt.id,
          changedFields: {
            reversalCashbookTransactionId: reversal.id,
            reason: dto.reason,
          },
        },
      });
      return updated;
    });
  }

  async allocateReceipt(
    user: RequestUser,
    receiptId: string,
    dto: CreateReceiptAllocationDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const receipt = await tx.accountingReceivableReceipt.findFirst({
        where: { id: receiptId, tenantId: user.tenantId },
      });
      if (!receipt) throw new NotFoundException('Receipt not found');
      if (receipt.status !== AccountingReceivableStatus.POSTED) {
        throw new ConflictException('Only posted receipts can be allocated');
      }
      return this.createAllocation(tx, user, {
        customerId: receipt.customerId,
        invoiceId: dto.invoiceId,
        receiptId: receipt.id,
        sourceType: AccountingReceivableAllocationSource.RECEIPT,
        amount: new Prisma.Decimal(dto.amount),
        currency: receipt.currency,
        expectedArAccountId: receipt.arAccountId,
      });
    });
  }

  async allocateCreditNote(
    user: RequestUser,
    creditNoteId: string,
    dto: CreateCreditNoteAllocationDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const creditNote = await tx.accountingReceivableDocument.findFirst({
        where: { id: creditNoteId, tenantId: user.tenantId },
      });
      if (!creditNote) throw new NotFoundException('Credit note not found');
      if (
        creditNote.documentType !==
          AccountingReceivableDocumentType.CREDIT_NOTE ||
        creditNote.status !== AccountingReceivableStatus.POSTED
      ) {
        throw new ConflictException(
          'Only posted credit notes can be allocated',
        );
      }
      return this.createAllocation(tx, user, {
        customerId: creditNote.customerId,
        invoiceId: dto.invoiceId,
        creditNoteId: creditNote.id,
        sourceType: AccountingReceivableAllocationSource.CREDIT_NOTE,
        amount: new Prisma.Decimal(dto.amount),
        currency: creditNote.currency,
        expectedArAccountId: creditNote.arAccountId,
      });
    });
  }

  listReceiptAllocations(tenantId: string, receiptId: string) {
    return this.prisma.accountingReceivableAllocation.findMany({
      where: { tenantId, receiptId },
      include: {
        invoice: {
          select: { id: true, documentNumber: true, totalAmount: true },
        },
      },
      orderBy: { allocatedAt: 'asc' },
    });
  }

  async reverseAllocation(
    user: RequestUser,
    allocationId: string,
    dto: ReverseAllocationDto,
  ) {
    const allocation =
      await this.prisma.accountingReceivableAllocation.findFirst({
        where: { id: allocationId, tenantId: user.tenantId },
      });
    if (!allocation) throw new NotFoundException('Allocation not found');
    if (allocation.reversedAt) return allocation;
    const updated = await this.prisma.accountingReceivableAllocation.update({
      where: { id_tenantId: { id: allocation.id, tenantId: user.tenantId } },
      data: {
        reversedAt: new Date(),
        reversedByUserId: user.id,
        reversalReason: dto.reason,
      },
    });
    await this.recordAudit(
      user,
      'RECEIVABLE_ALLOCATION_REVERSED',
      'AccountingReceivableAllocation',
      allocation.id,
      { reason: dto.reason },
    );
    return updated;
  }

  async invoiceBalance(tenantId: string, invoiceId: string) {
    const invoice = await this.prisma.accountingReceivableDocument.findFirst({
      where: {
        id: invoiceId,
        tenantId,
        documentType: AccountingReceivableDocumentType.INVOICE,
      },
      include: receivableDocumentInclude,
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.invoiceBalanceFromDocument(invoice);
  }

  async customerBalance(tenantId: string, customerId: string) {
    const customer = await this.prisma.subledgerAccount.findFirst({
      where: { id: customerId, tenantId },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    const [documents, receipts] = await Promise.all([
      this.prisma.accountingReceivableDocument.findMany({
        where: {
          tenantId,
          customerId,
          status: AccountingReceivableStatus.POSTED,
        },
      }),
      this.prisma.accountingReceivableReceipt.findMany({
        where: {
          tenantId,
          customerId,
          status: AccountingReceivableStatus.POSTED,
        },
      }),
    ]);
    const buckets = new Map<
      string,
      {
        postedInvoices: Prisma.Decimal;
        postedCreditNotes: Prisma.Decimal;
        postedReceipts: Prisma.Decimal;
      }
    >();
    const bucket = (currency: string) => {
      const existing = buckets.get(currency);
      if (existing) return existing;
      const created = {
        postedInvoices: new Prisma.Decimal(0),
        postedCreditNotes: new Prisma.Decimal(0),
        postedReceipts: new Prisma.Decimal(0),
      };
      buckets.set(currency, created);
      return created;
    };
    for (const document of documents) {
      const row = bucket(document.currency);
      if (document.documentType === AccountingReceivableDocumentType.INVOICE) {
        row.postedInvoices = row.postedInvoices.plus(document.totalAmount);
      } else {
        row.postedCreditNotes = row.postedCreditNotes.plus(
          document.totalAmount,
        );
      }
    }
    for (const receipt of receipts) {
      bucket(receipt.currency).postedReceipts = bucket(
        receipt.currency,
      ).postedReceipts.plus(receipt.amount);
    }
    return {
      customer,
      balances: [...buckets.entries()].map(([currency, row]) => ({
        currency,
        postedInvoices: this.money(row.postedInvoices),
        postedCreditNotes: this.money(row.postedCreditNotes),
        postedReceipts: this.money(row.postedReceipts),
        balance: this.money(
          row.postedInvoices
            .minus(row.postedCreditNotes)
            .minus(row.postedReceipts),
        ),
      })),
    };
  }

  private async postDocument(
    user: RequestUser,
    documentId: string,
    documentType: AccountingReceivableDocumentType,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.accountingReceivableDocument.findFirst({
        where: { id: documentId, tenantId: user.tenantId, documentType },
        include: receivableDocumentInclude,
      });
      if (!document)
        throw new NotFoundException('Receivable document not found');
      if (document.status !== AccountingReceivableStatus.DRAFT) {
        throw new ConflictException(
          'Only draft receivable documents can be posted',
        );
      }
      if (
        document.documentType ===
          AccountingReceivableDocumentType.CREDIT_NOTE &&
        document.originalInvoiceId
      ) {
        const outstanding = await this.invoiceOutstandingAmount(
          user.tenantId,
          document.originalInvoiceId,
          tx,
        );
        if (document.totalAmount.greaterThan(outstanding)) {
          throw new ConflictException(
            'Invoice-specific credit note cannot exceed invoice outstanding balance',
          );
        }
      }
      const period = await this.resolveOpenPeriod(
        tx,
        user.tenantId,
        document.documentDate,
      );
      const journal = await this.journals.createPostedInTransaction(
        tx,
        user,
        this.documentJournalDto(document, period.id),
      );
      const claimed = await tx.accountingReceivableDocument.updateMany({
        where: {
          id: document.id,
          tenantId: user.tenantId,
          status: AccountingReceivableStatus.DRAFT,
        },
        data: {
          status: AccountingReceivableStatus.POSTED,
          postedAt: new Date(),
          postedByUserId: user.id,
          postedJournalEntryId: journal.id,
          updatedByUserId: user.id,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictException(
          'Receivable document was changed by another request',
        );
      }
      if (
        document.documentType ===
          AccountingReceivableDocumentType.CREDIT_NOTE &&
        document.originalInvoiceId
      ) {
        await this.createAllocation(tx, user, {
          customerId: document.customerId,
          invoiceId: document.originalInvoiceId,
          creditNoteId: document.id,
          sourceType: AccountingReceivableAllocationSource.CREDIT_NOTE,
          amount: document.totalAmount,
          currency: document.currency,
          expectedArAccountId: document.arAccountId,
        });
      }
      await tx.accountingAuditLog.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.id,
          action:
            document.documentType === AccountingReceivableDocumentType.INVOICE
              ? 'RECEIVABLE_INVOICE_POSTED'
              : 'RECEIVABLE_CREDIT_NOTE_POSTED',
          entityType: 'AccountingReceivableDocument',
          entityId: document.id,
          changedFields: { journalEntryId: journal.id },
        },
      });
      return tx.accountingReceivableDocument.findUniqueOrThrow({
        where: { id_tenantId: { id: document.id, tenantId: user.tenantId } },
        include: receivableDocumentInclude,
      });
    });
  }

  private async reverseDocument(
    user: RequestUser,
    documentId: string,
    documentType: AccountingReceivableDocumentType,
    dto: ReverseReceivableDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const document = await tx.accountingReceivableDocument.findFirst({
        where: { id: documentId, tenantId: user.tenantId, documentType },
        include: receivableDocumentInclude,
      });
      if (!document)
        throw new NotFoundException('Receivable document not found');
      if (document.status !== AccountingReceivableStatus.POSTED) {
        throw new ConflictException(
          'Only posted receivable documents can be reversed',
        );
      }
      const activeAllocations = await tx.accountingReceivableAllocation.count({
        where: {
          tenantId: user.tenantId,
          reversedAt: null,
          OR:
            document.documentType === AccountingReceivableDocumentType.INVOICE
              ? [{ invoiceId: document.id }]
              : [{ creditNoteId: document.id }],
        },
      });
      if (activeAllocations > 0) {
        throw new ConflictException(
          'Reverse active allocations before reversing this receivable document',
        );
      }
      if (!document.postedJournalEntryId) {
        throw new ConflictException(
          'Posted receivable document is missing its journal',
        );
      }
      const reversalDate = new Date(dto.reversalDate);
      const period = await this.resolveOpenPeriod(
        tx,
        user.tenantId,
        reversalDate,
      );
      const originalJournal = await tx.journalEntry.findFirst({
        where: {
          id: document.postedJournalEntryId,
          tenantId: user.tenantId,
          status: JournalStatus.POSTED,
        },
        include: { lines: { orderBy: { lineNumber: 'asc' } } },
      });
      if (!originalJournal) {
        throw new ConflictException(
          'Original posted receivable journal is not available for reversal',
        );
      }
      const reversalJournal = await this.journals.createPostedInTransaction(
        tx,
        user,
        {
          transactionDate: reversalDate.toISOString(),
          fiscalPeriodId: period.id,
          transactionCurrency: originalJournal.transactionCurrency,
          exchangeRate: Number(originalJournal.exchangeRate.toString()),
          reference: `REVERSAL-${document.documentNumber}`,
          description: `Receivable reversal of ${document.documentNumber}: ${dto.reason}`,
          idempotencyKey: `receivable:${document.id}:reversal:v1`,
          sourceModule: 'ACCOUNTING',
          sourceRecordType: 'RECEIVABLE_DOCUMENT_REVERSAL',
          sourceRecordId: document.id,
          lines: originalJournal.lines.map((line) => ({
            glAccountId: line.glAccountId,
            subledgerAccountId: line.subledgerAccountId ?? undefined,
            costCentreId: line.costCentreId ?? undefined,
            description: line.description ?? undefined,
            debit: Number(line.transactionCredit.toString()),
            credit: Number(line.transactionDebit.toString()),
          })),
        },
      );
      await tx.journalEntry.update({
        where: {
          id_tenantId: { id: originalJournal.id, tenantId: user.tenantId },
        },
        data: {
          status: JournalStatus.REVERSED,
          reversedAt: new Date(),
          reversedByUserId: user.id,
          updatedByUserId: user.id,
        },
      });
      await tx.accountingReceivableDocument.update({
        where: { id_tenantId: { id: document.id, tenantId: user.tenantId } },
        data: {
          status: AccountingReceivableStatus.REVERSED,
          reversedAt: new Date(),
          reversedByUserId: user.id,
          reversalJournalEntryId: reversalJournal.id,
          updatedByUserId: user.id,
        },
      });
      await tx.accountingAuditLog.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.id,
          action:
            document.documentType === AccountingReceivableDocumentType.INVOICE
              ? 'RECEIVABLE_INVOICE_REVERSED'
              : 'RECEIVABLE_CREDIT_NOTE_REVERSED',
          entityType: 'AccountingReceivableDocument',
          entityId: document.id,
          changedFields: { reversalJournalEntryId: reversalJournal.id },
        },
      });
      return tx.accountingReceivableDocument.findUniqueOrThrow({
        where: { id_tenantId: { id: document.id, tenantId: user.tenantId } },
        include: receivableDocumentInclude,
      });
    });
  }

  // ---- Changing posted documents and receipts (while their period is open) ----

  /** Loads a posted or voided document for a void, edit or restore. Another module's documents change there. */
  private async loadChangeableDocument(
    tx: TransactionClient,
    tenantId: string,
    documentId: string,
    documentType: AccountingReceivableDocumentType,
  ) {
    await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "accounting"."AccountingReceivableDocument"
      WHERE "tenantId" = ${tenantId} AND "id" = ${documentId}
      FOR UPDATE
    `;
    const document = await tx.accountingReceivableDocument.findFirst({
      where: { id: documentId, tenantId, documentType },
      include: receivableDocumentInclude,
    });
    if (!document) throw new NotFoundException('Receivable document not found');
    if (document.sourceModule && document.sourceModule !== 'ACCOUNTING') {
      throw new ConflictException(
        'This document was raised by another module and changes there.',
      );
    }
    if (!document.postedJournalEntryId) {
      throw new ConflictException(
        'This document has no posted journal to change',
      );
    }
    return document;
  }

  /** An invoice with payments or credit notes against it must have those voided first. */
  private async assertInvoiceUntouched(
    tx: TransactionClient,
    tenantId: string,
    invoiceId: string,
  ) {
    const [applied, creditNotes] = await Promise.all([
      tx.accountingReceivableAllocation.count({
        where: { tenantId, invoiceId, reversedAt: null },
      }),
      tx.accountingReceivableDocument.count({
        where: {
          tenantId,
          originalInvoiceId: invoiceId,
          status: AccountingReceivableStatus.POSTED,
        },
      }),
    ]);
    if (applied > 0 || creditNotes > 0) {
      throw new ConflictException(
        'This invoice has payments or credit notes against it. Void those first.',
      );
    }
  }

  private async releaseAllocations(
    tx: TransactionClient,
    user: RequestUser,
    where: { receiptId?: string; creditNoteId?: string },
  ) {
    await tx.accountingReceivableAllocation.updateMany({
      where: { tenantId: user.tenantId, reversedAt: null, ...where },
      data: {
        reversedAt: new Date(),
        reversedByUserId: user.id,
        reversalReason: RELEASED_BY_VOID,
      },
    });
  }

  /** Rewrites the document's journal from its current fields, keeping the journal's number. */
  private async rewriteDocumentJournal(
    tx: TransactionClient,
    user: RequestUser,
    documentId: string,
  ) {
    const fresh = await tx.accountingReceivableDocument.findUniqueOrThrow({
      where: { id_tenantId: { id: documentId, tenantId: user.tenantId } },
      include: receivableDocumentInclude,
    });
    const period = await this.resolveOpenPeriod(
      tx,
      user.tenantId,
      fresh.documentDate,
    );
    await this.journals.rewriteSystemJournalInTransaction(
      tx,
      user,
      fresh.postedJournalEntryId as string,
      this.documentJournalDto(fresh, period.id),
    );
  }

  private documentSnapshot(document: ReceivableDocument) {
    return {
      documentNumber: document.documentNumber,
      customerId: document.customerId,
      documentDate: document.documentDate.toISOString(),
      currency: document.currency,
      totalAmount: document.totalAmount.toString(),
      description: document.description,
    };
  }

  /** Rewrites an invoice from the whole form again, keeping its number (and so its type). */
  private async replaceInvoiceInTransaction(
    tx: TransactionClient,
    user: RequestUser,
    document: ReceivableDocument,
    dto: CreateReceivableInvoiceDto,
  ) {
    if (dto.transactionTypeId !== document.transactionTypeId) {
      throw new BadRequestException(
        'The transaction type cannot change. Void this invoice and raise a new one instead.',
      );
    }
    const prepared = await this.prepareInvoice(user, dto);
    await tx.accountingReceivableDocument.update({
      where: { id_tenantId: { id: document.id, tenantId: user.tenantId } },
      data: {
        ...prepared.fields,
        quantity: prepared.fields.quantity ?? null,
        unitPrice: prepared.fields.unitPrice ?? null,
        exchangeRate: prepared.fields.exchangeRate ?? null,
        updatedByUserId: user.id,
        lines: { deleteMany: {}, create: prepared.lineWrites },
      },
    });
    await this.rewriteDocumentJournal(tx, user, document.id);
  }

  private async updateNoteInTransaction(
    tx: TransactionClient,
    user: RequestUser,
    document: ReceivableDocument,
    dto: EditReceivableNoteDto,
  ) {
    const { reason: _reason, ...changes } = dto;
    void _reason;
    if (Object.keys(changes).length === 0) return;
    await tx.accountingReceivableDocument.update({
      where: { id_tenantId: { id: document.id, tenantId: user.tenantId } },
      data: {
        updatedByUserId: user.id,
        ...(changes.documentDate !== undefined
          ? { documentDate: new Date(changes.documentDate) }
          : {}),
        ...(changes.exchangeRate !== undefined
          ? { exchangeRate: changes.exchangeRate }
          : {}),
        ...(changes.description !== undefined
          ? { description: this.optional(changes.description) }
          : {}),
        ...(changes.externalReference !== undefined
          ? { externalReference: this.optional(changes.externalReference) }
          : {}),
      },
    });
    await this.rewriteDocumentJournal(tx, user, document.id);
  }

  private findDocumentFresh(
    user: RequestUser,
    documentId: string,
    documentType: AccountingReceivableDocumentType,
  ) {
    return documentType === AccountingReceivableDocumentType.INVOICE
      ? this.getInvoice(user, documentId)
      : this.getCreditNote(user, documentId);
  }

  /**
   * Takes a posted invoice or credit note out of the books with its journal. An invoice with
   * payments or credit notes against it must wait until those are voided; a credit note lets go
   * of what it was applied to.
   */
  private async voidDocument(
    user: RequestUser,
    documentId: string,
    documentType: AccountingReceivableDocumentType,
    dto: VoidEntryDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const document = await this.loadChangeableDocument(
        tx,
        user.tenantId,
        documentId,
        documentType,
      );
      if (document.status === AccountingReceivableStatus.REVERSED) {
        throw new ConflictException(
          'This document has been reversed and cannot be voided.',
        );
      }
      if (document.status !== AccountingReceivableStatus.POSTED) {
        throw new ConflictException('Only posted documents can be voided');
      }
      if (documentType === AccountingReceivableDocumentType.INVOICE) {
        await this.assertInvoiceUntouched(tx, user.tenantId, document.id);
      } else {
        await this.releaseAllocations(tx, user, { creditNoteId: document.id });
      }
      await this.journals.voidSystemJournalInTransaction(
        tx,
        user,
        document.postedJournalEntryId as string,
        dto.reason,
      );
      await tx.accountingReceivableDocument.update({
        where: { id_tenantId: { id: document.id, tenantId: user.tenantId } },
        data: {
          status: AccountingReceivableStatus.VOIDED,
          voidedAt: new Date(),
          voidedByUserId: user.id,
          voidReason: dto.reason,
          updatedByUserId: user.id,
        },
      });
      await tx.accountingAuditLog.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: 'RECEIVABLE_DOCUMENT_VOIDED',
          entityType: 'AccountingReceivableDocument',
          entityId: document.id,
          changedFields: {
            reason: dto.reason,
            documentNumber: document.documentNumber,
          },
        },
      });
    });
    return this.findDocumentFresh(user, documentId, documentType);
  }

  voidInvoice(user: RequestUser, invoiceId: string, dto: VoidEntryDto) {
    return this.voidDocument(
      user,
      invoiceId,
      AccountingReceivableDocumentType.INVOICE,
      dto,
    );
  }

  voidCreditNote(user: RequestUser, creditNoteId: string, dto: VoidEntryDto) {
    return this.voidDocument(
      user,
      creditNoteId,
      AccountingReceivableDocumentType.CREDIT_NOTE,
      dto,
    );
  }

  /** Edits a posted invoice in place: the whole form again, same number. */
  async editPostedInvoice(
    user: RequestUser,
    invoiceId: string,
    dto: EditReceivableInvoiceDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const document = await this.loadChangeableDocument(
        tx,
        user.tenantId,
        invoiceId,
        AccountingReceivableDocumentType.INVOICE,
      );
      if (document.status !== AccountingReceivableStatus.POSTED) {
        throw new ConflictException(
          document.status === AccountingReceivableStatus.REVERSED
            ? 'This invoice has been reversed and cannot be edited.'
            : 'Only posted invoices can be edited',
        );
      }
      await this.assertInvoiceUntouched(tx, user.tenantId, document.id);
      await this.replaceInvoiceInTransaction(tx, user, document, dto.invoice);
      await tx.accountingAuditLog.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: 'RECEIVABLE_INVOICE_POSTED_EDITED',
          entityType: 'AccountingReceivableDocument',
          entityId: document.id,
          changedFields: {
            reason: dto.reason ?? null,
            before: this.documentSnapshot(document),
          },
        },
      });
    });
    return this.getInvoice(user, invoiceId);
  }

  /** Edits what a posted credit note allows (its amount stays, as it is applied against an invoice). */
  async editPostedCreditNote(
    user: RequestUser,
    creditNoteId: string,
    dto: EditReceivableNoteDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const document = await this.loadChangeableDocument(
        tx,
        user.tenantId,
        creditNoteId,
        AccountingReceivableDocumentType.CREDIT_NOTE,
      );
      if (document.status !== AccountingReceivableStatus.POSTED) {
        throw new ConflictException('Only posted credit notes can be edited');
      }
      await this.updateNoteInTransaction(tx, user, document, dto);
      await tx.accountingAuditLog.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: 'RECEIVABLE_CREDIT_NOTE_POSTED_EDITED',
          entityType: 'AccountingReceivableDocument',
          entityId: document.id,
          changedFields: {
            reason: dto.reason ?? null,
            before: this.documentSnapshot(document),
          },
        },
      });
    });
    return this.getCreditNote(user, creditNoteId);
  }

  /** Brings a voided invoice back under its own number, with corrections if the form was changed. */
  async restoreInvoice(
    user: RequestUser,
    invoiceId: string,
    dto: RestoreReceivableInvoiceDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const document = await this.loadChangeableDocument(
        tx,
        user.tenantId,
        invoiceId,
        AccountingReceivableDocumentType.INVOICE,
      );
      if (document.status !== AccountingReceivableStatus.VOIDED) {
        throw new ConflictException('Only voided invoices can be restored');
      }
      if (dto.invoice) {
        await this.replaceInvoiceInTransaction(tx, user, document, dto.invoice);
      }
      await this.journals.reinstateSystemJournalInTransaction(
        tx,
        user,
        document.postedJournalEntryId as string,
      );
      await this.markDocumentRestored(tx, user, document);
    });
    return this.getInvoice(user, invoiceId);
  }

  /** Brings a voided credit note back, applying it to its invoice again when it was raised against one. */
  async restoreCreditNote(
    user: RequestUser,
    creditNoteId: string,
    dto: EditReceivableNoteDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const document = await this.loadChangeableDocument(
        tx,
        user.tenantId,
        creditNoteId,
        AccountingReceivableDocumentType.CREDIT_NOTE,
      );
      if (document.status !== AccountingReceivableStatus.VOIDED) {
        throw new ConflictException('Only voided credit notes can be restored');
      }
      if (document.originalInvoiceId) {
        const invoice = await tx.accountingReceivableDocument.findFirst({
          where: { id: document.originalInvoiceId, tenantId: user.tenantId },
          select: { status: true, documentNumber: true },
        });
        if (invoice?.status !== AccountingReceivableStatus.POSTED) {
          throw new ConflictException(
            `Restore invoice ${invoice?.documentNumber ?? ''} before this credit note`.trim(),
          );
        }
      }
      await this.updateNoteInTransaction(tx, user, document, dto);
      await this.journals.reinstateSystemJournalInTransaction(
        tx,
        user,
        document.postedJournalEntryId as string,
      );
      await this.markDocumentRestored(tx, user, document);
      await this.reapplyReleasedAllocations(tx, user, {
        creditNoteId: document.id,
        sourceType: AccountingReceivableAllocationSource.CREDIT_NOTE,
        expectedArAccountId: document.arAccountId,
      });
    });
    return this.getCreditNote(user, creditNoteId);
  }

  /** Applies a restored receipt or credit note to the invoices it was released from by the void. */
  private async reapplyReleasedAllocations(
    tx: TransactionClient,
    user: RequestUser,
    input: {
      receiptId?: string;
      creditNoteId?: string;
      sourceType: AccountingReceivableAllocationSource;
      expectedArAccountId: string;
    },
  ) {
    const released = await tx.accountingReceivableAllocation.findMany({
      where: {
        tenantId: user.tenantId,
        reversalReason: RELEASED_BY_VOID,
        ...(input.receiptId ? { receiptId: input.receiptId } : {}),
        ...(input.creditNoteId ? { creditNoteId: input.creditNoteId } : {}),
      },
    });
    for (const allocation of released) {
      try {
        await this.createAllocation(tx, user, {
          customerId: allocation.customerId,
          invoiceId: allocation.invoiceId,
          receiptId: input.receiptId,
          creditNoteId: input.creditNoteId,
          sourceType: input.sourceType,
          amount: allocation.amount,
          currency: allocation.currency,
          expectedArAccountId: input.expectedArAccountId,
        });
      } catch (error) {
        if (error instanceof NotFoundException) {
          throw new ConflictException(
            'The invoice this was applied to is voided. Restore the invoice first.',
          );
        }
        throw error;
      }
      await tx.accountingReceivableAllocation.update({
        where: { id_tenantId: { id: allocation.id, tenantId: user.tenantId } },
        data: { reversalReason: RESTORED_AFTER_VOID },
      });
    }
  }

  private async markDocumentRestored(
    tx: TransactionClient,
    user: RequestUser,
    document: ReceivableDocument,
  ) {
    await tx.accountingReceivableDocument.update({
      where: { id_tenantId: { id: document.id, tenantId: user.tenantId } },
      data: {
        status: AccountingReceivableStatus.POSTED,
        voidedAt: null,
        voidedByUserId: null,
        voidReason: null,
        updatedByUserId: user.id,
      },
    });
    await tx.accountingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: 'RECEIVABLE_DOCUMENT_RESTORED',
        entityType: 'AccountingReceivableDocument',
        entityId: document.id,
        changedFields: { before: this.documentSnapshot(document) },
      },
    });
  }

  private receiptCashbookEdit(dto: EditReceivableReceiptDto) {
    return {
      ...(dto.receiptDate !== undefined
        ? { transactionDate: dto.receiptDate }
        : {}),
      ...(dto.cashAccountId !== undefined
        ? { cashAccountId: dto.cashAccountId }
        : {}),
      ...(dto.settlementMethod !== undefined
        ? { settlementMethod: dto.settlementMethod }
        : {}),
      ...(dto.reference !== undefined ? { reference: dto.reference } : {}),
      ...(dto.externalReference !== undefined
        ? { externalReference: dto.externalReference }
        : {}),
      ...(dto.description !== undefined
        ? { description: dto.description }
        : {}),
      ...(dto.reason !== undefined ? { reason: dto.reason } : {}),
    };
  }

  private receiptFieldEdit(dto: EditReceivableReceiptDto) {
    return {
      ...(dto.receiptDate !== undefined
        ? { receiptDate: new Date(dto.receiptDate) }
        : {}),
      ...(dto.reference !== undefined
        ? { reference: this.optional(dto.reference) }
        : {}),
      ...(dto.description !== undefined
        ? { description: this.optional(dto.description) }
        : {}),
      ...(dto.externalReference !== undefined
        ? { externalReference: this.optional(dto.externalReference) }
        : {}),
    };
  }

  private async loadChangeableReceipt(
    tx: TransactionClient,
    tenantId: string,
    receiptId: string,
  ) {
    await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "accounting"."AccountingReceivableReceipt"
      WHERE "tenantId" = ${tenantId} AND "id" = ${receiptId}
      FOR UPDATE
    `;
    const receipt = await tx.accountingReceivableReceipt.findFirst({
      where: { id: receiptId, tenantId },
    });
    if (!receipt) throw new NotFoundException('Receipt not found');
    if (receipt.sourceModule && receipt.sourceModule !== 'ACCOUNTING') {
      throw new ConflictException(
        'This receipt was raised by another module and changes there.',
      );
    }
    return receipt;
  }

  /** Voids a posted receipt with its cashbook entry and lets go of the invoices it was applied to. */
  async voidReceipt(user: RequestUser, receiptId: string, dto: VoidEntryDto) {
    await this.prisma.$transaction(async (tx) => {
      const receipt = await this.loadChangeableReceipt(
        tx,
        user.tenantId,
        receiptId,
      );
      if (receipt.status === AccountingReceivableStatus.REVERSED) {
        throw new ConflictException(
          'This receipt has been reversed and cannot be voided.',
        );
      }
      if (receipt.status !== AccountingReceivableStatus.POSTED) {
        throw new ConflictException('Only posted receipts can be voided');
      }
      await this.releaseAllocations(tx, user, { receiptId: receipt.id });
      await this.cashbook.voidInTransaction(
        tx,
        user,
        receipt.cashbookTransactionId,
        dto,
        true,
      );
      await tx.accountingReceivableReceipt.update({
        where: { id_tenantId: { id: receipt.id, tenantId: user.tenantId } },
        data: {
          status: AccountingReceivableStatus.VOIDED,
          voidedAt: new Date(),
          voidedByUserId: user.id,
          voidReason: dto.reason,
          updatedByUserId: user.id,
        },
      });
      await tx.accountingAuditLog.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: 'RECEIVABLE_RECEIPT_VOIDED',
          entityType: 'AccountingReceivableReceipt',
          entityId: receipt.id,
          changedFields: {
            reason: dto.reason,
            receiptNumber: receipt.receiptNumber,
          },
        },
      });
    });
    return this.getReceipt(user, receiptId);
  }

  async editPostedReceipt(
    user: RequestUser,
    receiptId: string,
    dto: EditReceivableReceiptDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const receipt = await this.loadChangeableReceipt(
        tx,
        user.tenantId,
        receiptId,
      );
      if (receipt.status !== AccountingReceivableStatus.POSTED) {
        throw new ConflictException('Only posted receipts can be edited');
      }
      await this.cashbook.editInTransaction(
        tx,
        user,
        receipt.cashbookTransactionId,
        this.receiptCashbookEdit(dto),
        true,
      );
      await tx.accountingReceivableReceipt.update({
        where: { id_tenantId: { id: receipt.id, tenantId: user.tenantId } },
        data: { ...this.receiptFieldEdit(dto), updatedByUserId: user.id },
      });
      await tx.accountingAuditLog.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: 'RECEIVABLE_RECEIPT_POSTED_EDITED',
          entityType: 'AccountingReceivableReceipt',
          entityId: receipt.id,
          changedFields: {
            reason: dto.reason ?? null,
            before: {
              receiptDate: receipt.receiptDate.toISOString(),
              reference: receipt.reference,
              description: receipt.description,
            },
          },
        },
      });
    });
    return this.getReceipt(user, receiptId);
  }

  /** Brings a voided receipt back and applies it to the invoices it was applied to before. */
  async restoreReceipt(
    user: RequestUser,
    receiptId: string,
    dto: EditReceivableReceiptDto,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const receipt = await this.loadChangeableReceipt(
        tx,
        user.tenantId,
        receiptId,
      );
      if (receipt.status !== AccountingReceivableStatus.VOIDED) {
        throw new ConflictException('Only voided receipts can be restored');
      }
      await this.cashbook.restoreInTransaction(
        tx,
        user,
        receipt.cashbookTransactionId,
        this.receiptCashbookEdit(dto),
        true,
      );
      await tx.accountingReceivableReceipt.update({
        where: { id_tenantId: { id: receipt.id, tenantId: user.tenantId } },
        data: {
          ...this.receiptFieldEdit(dto),
          status: AccountingReceivableStatus.POSTED,
          voidedAt: null,
          voidedByUserId: null,
          voidReason: null,
          updatedByUserId: user.id,
        },
      });
      await this.reapplyReleasedAllocations(tx, user, {
        receiptId: receipt.id,
        sourceType: AccountingReceivableAllocationSource.RECEIPT,
        expectedArAccountId: receipt.arAccountId,
      });
      await tx.accountingAuditLog.create({
        data: {
          tenantId: user.tenantId,
          actorUserId: user.id,
          action: 'RECEIVABLE_RECEIPT_RESTORED',
          entityType: 'AccountingReceivableReceipt',
          entityId: receipt.id,
          changedFields: { receiptNumber: receipt.receiptNumber },
        },
      });
    });
    return this.getReceipt(user, receiptId);
  }

  private async createAllocation(
    tx: TransactionClient,
    user: RequestUser,
    input: {
      customerId: string;
      invoiceId: string;
      receiptId?: string;
      creditNoteId?: string;
      sourceType: AccountingReceivableAllocationSource;
      amount: Prisma.Decimal;
      currency: string;
      /** The receipt's/credit note's own resolved AR account — an invoice can only be
       *  allocated against a source that shares this same account (see the "which AR
       *  account does a receipt use" design note on CreateReceivableReceiptDto). */
      expectedArAccountId?: string;
    },
  ) {
    if (input.amount.lte(0)) {
      throw new BadRequestException(
        'Allocation amount must be greater than zero',
      );
    }
    await this.lockAllocationSources(tx, user.tenantId, input);
    const invoice = await tx.accountingReceivableDocument.findFirst({
      where: {
        id: input.invoiceId,
        tenantId: user.tenantId,
        documentType: AccountingReceivableDocumentType.INVOICE,
        status: AccountingReceivableStatus.POSTED,
      },
    });
    if (!invoice) throw new NotFoundException('Posted invoice not found');
    if (invoice.customerId !== input.customerId) {
      throw new BadRequestException(
        'Allocation customer does not match invoice',
      );
    }
    if (invoice.currency !== input.currency) {
      throw new BadRequestException(
        'Cross-currency receivable allocations are not supported in Phase 1',
      );
    }
    if (
      input.expectedArAccountId &&
      invoice.arAccountId !== input.expectedArAccountId
    ) {
      throw new BadRequestException(
        'This invoice uses a different receivable account — record it as a separate payment',
      );
    }
    const invoiceOutstanding = await this.invoiceOutstandingAmount(
      user.tenantId,
      invoice.id,
      tx,
    );
    if (input.amount.greaterThan(invoiceOutstanding)) {
      throw new ConflictException(
        'Allocation exceeds invoice outstanding balance',
      );
    }
    if (input.receiptId) {
      const available = await this.receiptAvailableAmount(
        user.tenantId,
        input.receiptId,
        tx,
      );
      if (input.amount.greaterThan(available)) {
        throw new ConflictException(
          'Allocation exceeds receipt unapplied balance',
        );
      }
    }
    if (input.creditNoteId) {
      const available = await this.creditNoteAvailableAmount(
        user.tenantId,
        input.creditNoteId,
        tx,
      );
      if (input.amount.greaterThan(available)) {
        throw new ConflictException(
          'Allocation exceeds credit note unapplied balance',
        );
      }
    }
    const allocation = await tx.accountingReceivableAllocation.create({
      data: {
        tenantId: user.tenantId,
        customerId: input.customerId,
        invoiceId: invoice.id,
        receiptId: input.receiptId,
        creditNoteId: input.creditNoteId,
        sourceType: input.sourceType,
        amount: input.amount,
        currency: input.currency,
        createdByUserId: user.id,
      },
    });
    await tx.accountingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: 'RECEIVABLE_ALLOCATION_CREATED',
        entityType: 'AccountingReceivableAllocation',
        entityId: allocation.id,
        changedFields: {
          invoiceId: input.invoiceId,
          receiptId: input.receiptId,
          creditNoteId: input.creditNoteId,
          amount: input.amount.toString(),
        },
      },
    });
    return allocation;
  }

  private documentJournalDto(
    document: ReceivableDocument,
    fiscalPeriodId: string,
  ): CreateJournalDto {
    const totalAmount = Number(document.totalAmount.toString());
    const subtotalAmount = Number(document.subtotalAmount.toString());
    const description = document.description ?? document.documentNumber;
    const taxBreakdown = this.parseTaxBreakdown(document.taxBreakdown);

    // An Invoice debits AR and credits everything else; a Credit Note reverses that. A
    // tax line normally takes the same side as the main offset, but can carry its own
    // explicit direction from the rule instead (e.g. a withholding tax debited on an
    // invoice even though the invoice's own offset is a credit).
    const isInvoice =
      document.documentType === AccountingReceivableDocumentType.INVOICE;
    const arDirection = isInvoice ? PostingDirection.DR : PostingDirection.CR;
    const offsetDirection = isInvoice
      ? PostingDirection.CR
      : PostingDirection.DR;
    const debitCredit = (direction: PostingDirection, amount: number) => ({
      debit: direction === PostingDirection.DR ? amount : 0,
      credit: direction === PostingDirection.CR ? amount : 0,
    });

    const arLine = {
      glAccountId: document.arAccountId,
      subledgerAccountId: document.customer.id,
      description,
      ...debitCredit(arDirection, totalAmount),
    };
    // A resolved rule splits tax onto its own account(s), leaving the offset line at just
    // the subtotal; a document with no breakdown (a credit note, or one predating rules)
    // keeps the old behavior of lumping the full total onto the offset line.
    // One line per item, each to its own account and cost centre. A document made before items
    // existed has none, and posts its single offset account for the subtotal.
    const itemLines = (document.lines ?? []).map((item) => ({
      glAccountId: item.glAccountId,
      costCentreId: item.costCentreId ?? undefined,
      description: item.description ?? description,
      ...debitCredit(offsetDirection, Number(item.amount.toString())),
    }));
    const offsetLines =
      taxBreakdown.length || itemLines.length > 0
        ? [
            ...(itemLines.length > 0
              ? itemLines
              : [
                  {
                    glAccountId: document.offsetGlAccountId,
                    costCentreId: document.costCentreId ?? undefined,
                    description,
                    ...debitCredit(offsetDirection, subtotalAmount),
                  },
                ]),
            ...taxBreakdown.map((t) => ({
              glAccountId: t.glAccountId,
              description: `${description} — ${
                t.kind === 'DEDUCTION'
                  ? 'deduction'
                  : t.kind === 'CHARGE'
                    ? 'charge'
                    : 'tax'
              }${t.description ? ` (${t.description})` : ''}`,
              ...debitCredit(t.direction ?? offsetDirection, t.amount),
            })),
          ]
        : [
            {
              glAccountId: document.offsetGlAccountId,
              costCentreId: document.costCentreId ?? undefined,
              description,
              ...debitCredit(offsetDirection, totalAmount),
            },
          ];

    const lines = isInvoice
      ? [arLine, ...offsetLines]
      : [...offsetLines, arLine];
    return {
      transactionDate: document.documentDate.toISOString(),
      fiscalPeriodId,
      transactionCurrency: document.currency,
      exchangeRate: document.exchangeRate
        ? Number(document.exchangeRate.toString())
        : undefined,
      reference: document.documentNumber,
      description: document.description ?? document.documentNumber,
      idempotencyKey: `receivable:${document.id}:posted:v1`,
      sourceModule: document.sourceModule ?? 'ACCOUNTING',
      sourceRecordType: 'RECEIVABLE_DOCUMENT',
      sourceRecordId: document.sourceRecordId ?? document.id,
      lines,
    };
  }

  private async listDocuments(
    tenantId: string,
    documentType: AccountingReceivableDocumentType,
    query: QueryReceivableDocumentsDto,
  ) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(Math.max(1, query.limit ?? 25), 100);
    const where: Prisma.AccountingReceivableDocumentWhereInput = {
      tenantId,
      documentType,
      ...(query.customerId ? { customerId: query.customerId } : {}),
      // Voided entries live in the archive; they only show when asked for by status.
      status: query.status ?? { not: AccountingReceivableStatus.VOIDED },
      ...(query.currency ? { currency: query.currency } : {}),
      ...(query.fromDate || query.toDate
        ? {
            documentDate: {
              ...(query.fromDate
                ? { gte: this.startOfDay(query.fromDate) }
                : {}),
              ...(query.toDate ? { lte: this.endOfDay(query.toDate) } : {}),
            },
          }
        : {}),
      ...(query.dueFrom || query.dueTo
        ? {
            dueDate: {
              ...(query.dueFrom ? { gte: this.startOfDay(query.dueFrom) } : {}),
              ...(query.dueTo ? { lte: this.endOfDay(query.dueTo) } : {}),
            },
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              {
                documentNumber: { contains: query.search, mode: 'insensitive' },
              },
              {
                externalReference: {
                  contains: query.search,
                  mode: 'insensitive',
                },
              },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.accountingReceivableDocument.findMany({
        where,
        include: receivableDocumentInclude,
        orderBy: [{ documentDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.accountingReceivableDocument.count({ where }),
    ]);
    const itemsWithPaymentState = await this.attachPaymentStates(
      tenantId,
      items,
    );
    return {
      items: itemsWithPaymentState,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  // One grouped aggregate for the whole page instead of a per-row balance lookup — keeps
  // list responses cheap regardless of page size.
  private async attachPaymentStates<T extends ReceivableDocument>(
    tenantId: string,
    documents: T[],
  ) {
    const isCreditNote = (doc: ReceivableDocument) =>
      doc.documentType === AccountingReceivableDocumentType.CREDIT_NOTE;
    const posted = documents.filter(
      (doc) => doc.status === AccountingReceivableStatus.POSTED,
    );
    const postedIds = posted
      .filter((doc) => !isCreditNote(doc))
      .map((doc) => doc.id);
    const postedCreditNoteIds = posted
      .filter(isCreditNote)
      .map((doc) => doc.id);
    // A credit note is never "paid" — what matters is how much of it has been applied
    // against invoices, so its outstanding is the part still unapplied.
    const appliedByCreditNoteId = new Map<string, Prisma.Decimal>();
    if (postedCreditNoteIds.length > 0) {
      const grouped = await this.prisma.accountingReceivableAllocation.groupBy({
        by: ['creditNoteId'],
        where: {
          tenantId,
          reversedAt: null,
          creditNoteId: { in: postedCreditNoteIds },
        },
        _sum: { amount: true },
      });
      for (const row of grouped) {
        if (row.creditNoteId) {
          appliedByCreditNoteId.set(row.creditNoteId, row._sum.amount ?? zero);
        }
      }
    }
    const appliedByInvoiceId = new Map<string, Prisma.Decimal>();
    // Only real receipts, not credit notes — a credited invoice hasn't been paid.
    const receiptsByInvoiceId = new Map<string, Prisma.Decimal>();
    if (postedIds.length > 0) {
      const grouped = await this.prisma.accountingReceivableAllocation.groupBy({
        by: ['invoiceId', 'sourceType'],
        where: { tenantId, reversedAt: null, invoiceId: { in: postedIds } },
        _sum: { amount: true },
      });
      for (const row of grouped) {
        const amount = row._sum.amount ?? zero;
        appliedByInvoiceId.set(
          row.invoiceId,
          (appliedByInvoiceId.get(row.invoiceId) ?? zero).plus(amount),
        );
        if (row.sourceType === AccountingReceivableAllocationSource.RECEIPT) {
          receiptsByInvoiceId.set(
            row.invoiceId,
            (receiptsByInvoiceId.get(row.invoiceId) ?? zero).plus(amount),
          );
        }
      }
    }
    // Invoices with a payment request waiting for the accountant carry a count for the list tag.
    const invoiceIds = documents
      .filter((document) => !isCreditNote(document))
      .map((document) => document.id);
    const waiting = invoiceIds.length
      ? await this.prisma.accountingPaymentRequest.groupBy({
          by: ['invoiceId'],
          where: {
            tenantId,
            invoiceId: { in: invoiceIds },
            status: AccountingPaymentRequestStatus.PENDING,
          },
          _count: { _all: true },
        })
      : [];
    const waitingByInvoiceId = new Map(
      waiting.map((row) => [row.invoiceId, row._count._all]),
    );
    return documents.map((document) => {
      const applied =
        (isCreditNote(document)
          ? appliedByCreditNoteId.get(document.id)
          : appliedByInvoiceId.get(document.id)) ?? zero;
      const outstanding =
        document.status === AccountingReceivableStatus.POSTED
          ? document.totalAmount.minus(applied)
          : zero;
      return {
        ...document,
        paymentState: this.paymentState(
          document,
          outstanding,
          isCreditNote(document)
            ? undefined
            : (receiptsByInvoiceId.get(document.id) ?? zero),
        ),
        outstandingAmount: this.money(outstanding),
        pendingPaymentRequestCount: waitingByInvoiceId.get(document.id) ?? 0,
      };
    });
  }

  private async paginateReceipts(
    where: Prisma.AccountingReceivableReceiptWhereInput,
    page: number,
    limit: number,
  ) {
    const [items, total] = await Promise.all([
      this.prisma.accountingReceivableReceipt.findMany({
        where,
        include: receivableReceiptInclude,
        orderBy: [{ receiptDate: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.accountingReceivableReceipt.count({ where }),
    ]);
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /** The credit notes applied to an invoice, with the transaction type each was raised under, so
   *  the payment screen can say what reduced the balance and by how much. */
  private async appliedCreditNoteDetails(tenantId: string, invoiceId: string) {
    const allocations =
      await this.prisma.accountingReceivableAllocation.findMany({
        where: {
          tenantId,
          invoiceId,
          sourceType: AccountingReceivableAllocationSource.CREDIT_NOTE,
          reversedAt: null,
        },
        include: {
          creditNote: {
            select: { documentNumber: true, transactionTypeId: true },
          },
        },
        orderBy: { allocatedAt: 'asc' },
      });
    const typeIds = [
      ...new Set(
        allocations.flatMap((a) =>
          a.creditNote?.transactionTypeId
            ? [a.creditNote.transactionTypeId]
            : [],
        ),
      ),
    ];
    const types = typeIds.length
      ? await this.prisma.transactionType.findMany({
          where: { tenantId, id: { in: typeIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(types.map((type) => [type.id, type.name]));
    return allocations.map((allocation) => ({
      allocationId: allocation.id,
      creditNoteId: allocation.creditNoteId,
      documentNumber: allocation.creditNote?.documentNumber ?? null,
      transactionType: allocation.creditNote?.transactionTypeId
        ? (nameById.get(allocation.creditNote.transactionTypeId) ?? null)
        : null,
      amount: this.money(allocation.amount),
    }));
  }

  /** The receipts applied to an invoice, so each can be opened (and voided) from the invoice. */
  private async appliedSettlementDetails(tenantId: string, invoiceId: string) {
    const allocations =
      await this.prisma.accountingReceivableAllocation.findMany({
        where: {
          tenantId,
          invoiceId,
          sourceType: AccountingReceivableAllocationSource.RECEIPT,
          reversedAt: null,
        },
        include: { receipt: { select: { receiptNumber: true } } },
        orderBy: { allocatedAt: 'asc' },
      });
    return allocations.map((allocation) => ({
      allocationId: allocation.id,
      settlementId: allocation.receiptId,
      settlementNumber: allocation.receipt?.receiptNumber ?? null,
      amount: this.money(allocation.amount),
    }));
  }

  private async invoiceBalanceFromDocument(document: ReceivableDocument) {
    const appliedNotes = await this.appliedCreditNoteDetails(
      document.tenantId,
      document.id,
    );
    const appliedSettlementDetails = await this.appliedSettlementDetails(
      document.tenantId,
      document.id,
    );
    const [receiptApplied, creditApplied] = await Promise.all([
      this.sumAllocations(document.tenantId, {
        invoiceId: document.id,
        sourceType: AccountingReceivableAllocationSource.RECEIPT,
      }),
      this.sumAllocations(document.tenantId, {
        invoiceId: document.id,
        sourceType: AccountingReceivableAllocationSource.CREDIT_NOTE,
      }),
    ]);
    const outstanding =
      document.status === AccountingReceivableStatus.POSTED
        ? document.totalAmount.minus(receiptApplied).minus(creditApplied)
        : new Prisma.Decimal(0);
    return {
      invoice: document,
      currency: document.currency,
      originalAmount: this.money(document.totalAmount),
      appliedReceipts: this.money(receiptApplied),
      appliedCreditNotes: this.money(creditApplied),
      appliedNotes,
      appliedSettlementDetails,
      outstandingAmount: this.money(outstanding),
      paymentState: this.paymentState(document, outstanding, receiptApplied),
    };
  }

  private async invoiceOutstandingAmount(
    tenantId: string,
    invoiceId: string,
    tx?: TransactionClient,
  ) {
    const client = tx ?? this.prisma;
    const invoice = await client.accountingReceivableDocument.findFirst({
      where: {
        id: invoiceId,
        tenantId,
        documentType: AccountingReceivableDocumentType.INVOICE,
        status: AccountingReceivableStatus.POSTED,
      },
    });
    if (!invoice) throw new NotFoundException('Posted invoice not found');
    const applied = await this.sumAllocations(tenantId, { invoiceId }, client);
    return invoice.totalAmount.minus(applied);
  }

  private async receiptAvailableAmount(
    tenantId: string,
    receiptId: string,
    tx: TransactionClient,
  ) {
    const receipt = await tx.accountingReceivableReceipt.findFirst({
      where: {
        id: receiptId,
        tenantId,
        status: AccountingReceivableStatus.POSTED,
      },
    });
    if (!receipt) throw new NotFoundException('Posted receipt not found');
    const allocated = await this.sumAllocations(tenantId, { receiptId }, tx);
    return receipt.amount.minus(allocated);
  }

  private async creditNoteAvailableAmount(
    tenantId: string,
    creditNoteId: string,
    tx: TransactionClient,
  ) {
    const creditNote = await tx.accountingReceivableDocument.findFirst({
      where: {
        id: creditNoteId,
        tenantId,
        documentType: AccountingReceivableDocumentType.CREDIT_NOTE,
        status: AccountingReceivableStatus.POSTED,
      },
    });
    if (!creditNote)
      throw new NotFoundException('Posted credit note not found');
    const allocated = await this.sumAllocations(tenantId, { creditNoteId }, tx);
    return creditNote.totalAmount.minus(allocated);
  }

  private async sumAllocations(
    tenantId: string,
    where: Omit<Prisma.AccountingReceivableAllocationWhereInput, 'tenantId'>,
    client: PrismaService | TransactionClient = this.prisma,
  ) {
    const aggregate = await client.accountingReceivableAllocation.aggregate({
      where: { tenantId, reversedAt: null, ...where },
      _sum: { amount: true },
    });
    return aggregate._sum.amount ?? new Prisma.Decimal(0);
  }

  private async getDocumentForTenant(tenantId: string, documentId: string) {
    const document = await this.prisma.accountingReceivableDocument.findFirst({
      where: { id: documentId, tenantId },
      include: receivableDocumentInclude,
    });
    if (!document) throw new NotFoundException('Receivable document not found');
    return document;
  }

  private async resolveCustomer(tenantId: string, customerId: string) {
    const customer = await this.prisma.subledgerAccount.findFirst({
      where: { id: customerId, tenantId },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    if (customer.status !== RecordStatus.ACTIVE) {
      throw new ConflictException('Customer subledger account is inactive');
    }
    return customer;
  }

  private async assertActiveCurrency(tenantId: string, code: string) {
    const currency = await this.prisma.accountingCurrency.findUnique({
      where: { tenantId_code: { tenantId, code } },
    });
    if (!currency || !currency.isActive) {
      throw new BadRequestException('Accounting currency is not active');
    }
  }

  private async assertPostingOffsetAccount(
    tenantId: string,
    glAccountId: string,
  ) {
    const account = await this.prisma.gLAccount.findFirst({
      where: { id: glAccountId, tenantId },
      include: { _count: { select: { childAccounts: true } } },
    });
    if (!account) throw new BadRequestException('Offset GL account not found');
    if (
      account.status !== RecordStatus.ACTIVE ||
      !account.allowPosting ||
      account._count.childAccounts > 0 ||
      account.category === GLAccountCategory.ASSET
    ) {
      throw new BadRequestException(
        'Receivable offset account must be active, leaf, posting-enabled and non-asset',
      );
    }
  }

  /** For a credit note's manually-picked AR account — a Rule-driven invoice never needs
   *  this, since its Rule's auto-balancing line was already validated as ASSET category
   *  when the Rule itself was saved. */
  private async assertArAccount(tenantId: string, glAccountId: string) {
    const account = await this.prisma.gLAccount.findFirst({
      where: { id: glAccountId, tenantId },
      include: { _count: { select: { childAccounts: true } } },
    });
    if (!account) throw new BadRequestException('AR account not found');
    if (
      account.status !== RecordStatus.ACTIVE ||
      !account.allowPosting ||
      account._count.childAccounts > 0 ||
      account.category !== GLAccountCategory.ASSET
    ) {
      throw new BadRequestException(
        'AR account must be active, leaf, posting-enabled and an asset account',
      );
    }
  }

  /** Resolves both sides of the journal from the transaction type's Rule — requires one to
   *  exist, so a Rule is mandatory before a type can be used to post an Invoice. Both the
   *  AR account and the offset account come from here now; neither is re-derived from any
   *  tenant-wide setting. */
  private async resolveRulePosting(
    tenantId: string,
    transactionTypeId: string,
    expectedCategory: TransactionTypeCategory,
    subtotal: Prisma.Decimal,
    selectedTaxTypeIds: string[] | undefined,
    expectLinked = false,
    options: {
      offsetGlAccountId?: string;
      /** One account pick per item on the document (a fixed rule account needs none). */
      lineAccountIds?: (string | undefined)[];
      taxOnly?: boolean;
      /** Taxes, deductions and charges added on the form (as opposed to the rule's own). */
      taxes?: FormTax[];
      adjustments?: FormAdjustment[];
      documentDate?: string;
    } = {},
  ): Promise<{
    arAccountId: string;
    offsetGlAccountId: string;
    taxAmount: Prisma.Decimal;
    taxBreakdown: BreakdownEntry[];
    /** Charges less deductions: what the form's adjustments add to (or take from) the total. */
    netAdjustment: Prisma.Decimal;
    /** The account each item posts to, in order. */
    lineAccounts: string[];
    transactionTypeCode: string;
  }> {
    const transactionType = await this.prisma.transactionType.findFirst({
      where: { id: transactionTypeId, tenantId },
    });
    if (!transactionType) {
      throw new NotFoundException('Transaction type not found');
    }
    if (transactionType.category !== expectedCategory) {
      throw new BadRequestException(
        `Transaction type must be ${expectedCategory} category`,
      );
    }

    if (transactionType.isLinked !== expectLinked) {
      throw new BadRequestException(
        expectLinked
          ? `${transactionType.name} is not a linked transaction type`
          : `${transactionType.name} is a linked transaction type — it must reference an original invoice`,
      );
    }

    const rule = await this.prisma.transactionTypeRule.findFirst({
      where: { tenantId, transactionTypeId },
      include: { lines: { include: { taxType: true } } },
    });
    if (!rule) {
      throw new BadRequestException(
        'Configure a rule for this transaction type before creating documents against it',
      );
    }

    // A linked type (credit / debit note) reverses its original, so its control line — and
    // the rule that describes it — is on the opposite side to a plain invoice/bill.
    const isReceivable =
      expectedCategory === TransactionTypeCategory.RECEIVABLE;
    const autoBalanceDirection =
      isReceivable !== transactionType.isLinked
        ? PostingDirection.DR
        : PostingDirection.CR;
    // The auto-balance (AR) line is never a tax line — checking direction alone isn't
    // enough, since a deduction can be configured with that same direction (e.g. a
    // withholding tax debited on an invoice, same as the AR line itself).
    // Settlement lines apply when the document is paid, never when it is raised.
    const documentLines = rule.lines.filter((l) => !l.settlementKind);
    const arLine = documentLines.find(
      (l) => l.direction === autoBalanceDirection && !l.taxTypeId,
    );
    if (!arLine) {
      throw new ConflictException(
        "This transaction type's rule has no Receivable line configured",
      );
    }
    const explicitLines = documentLines.filter((l) => l.id !== arLine.id);
    const mainLine = explicitLines.find((l) => !l.taxTypeId);
    if (!mainLine) {
      throw new ConflictException(
        "This transaction type's rule has no main (non-tax) line configured",
      );
    }

    if (!arLine.accountId) {
      throw new ConflictException(
        "This transaction type's rule has no fixed control account configured",
      );
    }
    const controlAccountId = arLine.accountId;
    // A scoped main line (the user picks the account) is resolved against the scope; the
    // tax-only path keeps the accounts the draft already holds, so it needs no pick.
    const picks = options.lineAccountIds ?? [options.offsetGlAccountId];
    const lineAccounts: string[] = [];
    if (options.taxOnly) {
      lineAccounts.push(mainLine.accountId ?? '');
    } else {
      // Every item must sit inside the rule's scope (or be the rule's one fixed account).
      for (const pick of picks) {
        lineAccounts.push(
          await resolveMainLineAccount(this.prisma, tenantId, mainLine, pick, [
            controlAccountId,
            ...explicitLines.flatMap((l) => (l.accountId ? [l.accountId] : [])),
          ]),
        );
      }
    }
    const offsetGlAccountId = lineAccounts[0];

    const selected = new Set(selectedTaxTypeIds ?? []);
    const taxBreakdown: BreakdownEntry[] = explicitLines
      .filter((l) => l.taxTypeId && l.accountId && selected.has(l.taxTypeId))
      .map((line) => {
        const rate = new Prisma.Decimal(line.taxType!.rate);
        const amount = subtotal.times(rate).dividedBy(100).toDecimalPlaces(2);
        return {
          glAccountId: line.accountId!,
          taxTypeId: line.taxTypeId!,
          amount: amount.toString(),
          direction: line.direction,
          kind: 'TAX' as const,
          description: line.taxType!.name,
        };
      });
    // Taxes, deductions and charges added on the form. A tax or charge goes on the main line's
    // side and a deduction on the control side, so they add to or take from what is owed.
    const form = options.taxOnly
      ? null
      : await buildFormBreakdown(this.prisma, tenantId, {
          subtotal,
          documentDate: options.documentDate,
          mainSide:
            autoBalanceDirection === PostingDirection.DR
              ? PostingDirection.CR
              : PostingDirection.DR,
          controlSide: autoBalanceDirection,
          taxes: options.taxes,
          adjustments: options.adjustments,
          excludeAccountIds: [controlAccountId, offsetGlAccountId].filter(
            Boolean,
          ),
        });
    taxBreakdown.push(...(form?.entries ?? []));
    const taxAmount = taxBreakdown
      .filter((t) => t.kind === 'TAX')
      .reduce(
        (sum, t) => sum.plus(new Prisma.Decimal(t.amount)),
        new Prisma.Decimal(0),
      );

    return {
      arAccountId: controlAccountId,
      offsetGlAccountId,
      taxAmount,
      taxBreakdown,
      netAdjustment: form?.netAdjustment ?? new Prisma.Decimal(0),
      lineAccounts,
      transactionTypeCode: transactionType.code,
    };
  }

  private parseTaxBreakdown(value: Prisma.JsonValue | null): {
    glAccountId: string;
    taxTypeId: string;
    amount: number;
    /** Null for documents created before tax lines carried their own direction —
     *  documentJournalDto falls back to the offset line's direction for those. */
    direction: PostingDirection | null;
    /** Absent on documents made before deductions and charges existed — those are all taxes. */
    kind: 'TAX' | 'DEDUCTION' | 'CHARGE';
    description: string | null;
  }[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((entry) => {
      if (
        !entry ||
        typeof entry !== 'object' ||
        Array.isArray(entry) ||
        typeof entry.glAccountId !== 'string' ||
        typeof entry.amount !== 'string'
      ) {
        return [];
      }
      const direction =
        entry.direction === PostingDirection.DR ||
        entry.direction === PostingDirection.CR
          ? entry.direction
          : null;
      return [
        {
          glAccountId: entry.glAccountId,
          taxTypeId: typeof entry.taxTypeId === 'string' ? entry.taxTypeId : '',
          amount: Number(entry.amount),
          direction,
          kind:
            entry.kind === 'DEDUCTION' || entry.kind === 'CHARGE'
              ? entry.kind
              : ('TAX' as const),
          description:
            typeof entry.description === 'string' ? entry.description : null,
        },
      ];
    });
  }

  private assertCustomerCurrency(
    customerCurrency: string | null,
    currency: string,
  ) {
    if (customerCurrency && customerCurrency !== currency) {
      throw new BadRequestException(
        'Standalone AR Phase 1 requires customer currency to match the document or receipt currency',
      );
    }
  }

  private async resolveOpenPeriod(
    tx: TransactionClient,
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
        'No fiscal period contains the receivable transaction date',
      );
    }
    if (period.status !== FiscalPeriodStatus.OPEN) {
      throw new ConflictException(
        `Cannot post receivable transaction into a ${period.status.toLowerCase().replace('_', ' ')} fiscal period`,
      );
    }
    return period;
  }

  private async lockAllocationSources(
    tx: TransactionClient,
    tenantId: string,
    input: {
      invoiceId: string;
      receiptId?: string;
      creditNoteId?: string;
    },
  ) {
    await tx.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "accounting"."AccountingReceivableDocument"
      WHERE "tenantId" = ${tenantId}
        AND "id" IN (${input.invoiceId}, ${input.creditNoteId ?? input.invoiceId})
      FOR UPDATE
    `;
    if (input.receiptId) {
      await tx.$queryRaw<{ id: string }[]>`
        SELECT "id"
        FROM "accounting"."AccountingReceivableReceipt"
        WHERE "tenantId" = ${tenantId}
          AND "id" = ${input.receiptId}
        FOR UPDATE
      `;
    }
  }

  private documentAmounts(dto: { amount: number; taxAmount?: number }) {
    const subtotalAmount = new Prisma.Decimal(dto.amount);
    const taxAmount = new Prisma.Decimal(dto.taxAmount ?? 0);
    return {
      subtotalAmount,
      taxAmount,
      totalAmount: subtotalAmount.plus(taxAmount),
    };
  }

  /** `paidApplied` is the part of the reduction that came from real receipts. A document
   *  reduced only by credit notes is still Unpaid; without it (credit notes themselves) any
   *  reduction counts as partly applied. */
  private paymentState(
    document: ReceivableDocument,
    outstanding: Prisma.Decimal,
    paidApplied?: Prisma.Decimal,
  ) {
    if (document.status === AccountingReceivableStatus.VOIDED) return 'VOIDED';
    if (document.status === AccountingReceivableStatus.REVERSED)
      return 'REVERSED';
    if (document.status === AccountingReceivableStatus.REJECTED)
      return 'REJECTED';
    if (document.status === AccountingReceivableStatus.DRAFT) return 'DRAFT';
    if (outstanding.lte(0)) return 'PAID';
    const partlySettled = paidApplied
      ? paidApplied.greaterThan(0)
      : outstanding.lessThan(document.totalAmount);
    if (partlySettled) return 'PARTIALLY_PAID';
    return 'OPEN';
  }

  /** Runs `fn` inside a transaction holding a per-tenant, per-key advisory lock — used to
   *  make document-numbering race-safe: two concurrent creates can no longer read the same
   *  count and mint the same number, since the count-then-create is now one atomic section. */
  private async withDocumentNumberLock<T>(
    tenantId: string,
    lockKey: string,
    fn: (tx: TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtext(${'accounting-doc-number:' + tenantId + ':' + lockKey})
        )
      `;
      return fn(tx);
    });
  }

  /** Old scheme — kept for credit notes and receipts, which have no Transaction Type to
   *  draw a code from. The count is global (never resets), only the lock is new. */
  private async nextDocumentNumber(
    tx: TransactionClient,
    tenantId: string,
    prefix: string,
  ) {
    const count = await tx.accountingReceivableDocument.count({
      where: { tenantId },
    });
    return `${prefix}-${new Date().getUTCFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }

  private async nextReceiptNumber(tx: TransactionClient, tenantId: string) {
    const count = await tx.accountingReceivableReceipt.count({
      where: { tenantId },
    });
    return `ARR-${new Date().getUTCFullYear()}-${String(count + 1).padStart(6, '0')}`;
  }

  /** New scheme for Rule-driven documents (invoices): <TransactionType code><YY>-<00001>,
   *  resetting to 1 each calendar year per transaction type. */
  private async nextRuleDocumentNumber(
    tx: TransactionClient,
    tenantId: string,
    transactionTypeCode: string,
  ) {
    const prefix = `${transactionTypeCode}${String(new Date().getUTCFullYear()).slice(-2)}`;
    const count = await tx.accountingReceivableDocument.count({
      where: { tenantId, documentNumber: { startsWith: `${prefix}-` } },
    });
    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }

  private addDays(date: string, days: number) {
    const value = new Date(date);
    value.setDate(value.getDate() + days);
    return value.toISOString();
  }

  private money(value: Prisma.Decimal) {
    return value.toFixed(4);
  }

  /** The optional department tag — when given, it must be an active cost centre of this
   *  tenant. Checked at creation for early feedback; posting re-validates it. */
  /** The items on a bill, invoice or note — normalised from `lines`, or from the single `amount`
   *  of an older request — with each cost centre checked. */
  private async resolveDocumentLines(
    tenantId: string,
    dto: Parameters<typeof normalizeDocumentLines>[0],
  ) {
    const result = normalizeDocumentLines(dto);
    for (const costCentreId of new Set(
      result.lines.flatMap((line) =>
        line.costCentreId ? [line.costCentreId] : [],
      ),
    )) {
      await this.assertActiveCostCentre(tenantId, costCentreId);
    }
    return result;
  }

  // Nested under `lines: { create: [...] }` — tenantId comes from the parent document through the
  // composite FK, so it must not be passed here.
  private documentLineWrites(
    items: ReturnType<typeof normalizeDocumentLines>['lines'],
    accountIds: string[],
  ) {
    return items.map((item, index) => ({
      sequence: index + 1,
      glAccountId: accountIds[index],
      amount: item.amount,
      quantity: item.quantity ?? null,
      unitPrice: item.unitPrice ?? null,
      description: this.optional(item.description),
      costCentreId: this.optional(item.costCentreId),
    }));
  }

  private async assertActiveCostCentre(
    tenantId: string,
    costCentreId: string | undefined,
  ) {
    if (!costCentreId) return;
    const costCentre = await this.prisma.costCentre.findFirst({
      where: { id: costCentreId, tenantId },
    });
    if (!costCentre) throw new NotFoundException('Cost centre not found');
    if (costCentre.status !== RecordStatus.ACTIVE) {
      throw new ConflictException('Cost centre is inactive');
    }
  }

  private optional(value: string | undefined): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private startOfDay(value: string) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  private endOfDay(value: string) {
    const date = new Date(value);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  /** Throws a draft invoice or credit note away. Posted ones are immutable and stay. */
  private async deleteDraftDocument(
    user: RequestUser,
    documentId: string,
    documentType: AccountingReceivableDocumentType,
    label: string,
  ) {
    const document = await this.prisma.accountingReceivableDocument.findFirst({
      where: { id: documentId, tenantId: user.tenantId, documentType },
      select: {
        id: true,
        status: true,
        sourceModule: true,
        documentNumber: true,
      },
    });
    if (!document) throw new NotFoundException(`${label} not found`);
    if (document.status !== AccountingReceivableStatus.DRAFT) {
      throw new ConflictException(`Only draft ${label}s can be deleted`);
    }
    if (document.sourceModule && document.sourceModule !== 'ACCOUNTING') {
      throw new ConflictException(
        `This ${label} was raised by another module - reject it instead`,
      );
    }
    try {
      const removed = await this.prisma.accountingReceivableDocument.deleteMany(
        {
          where: {
            id: document.id,
            tenantId: user.tenantId,
            status: AccountingReceivableStatus.DRAFT,
          },
        },
      );
      if (removed.count !== 1) {
        throw new ConflictException(
          `The ${label} was changed by another request`,
        );
      }
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new ConflictException(
        `This ${label} is referenced elsewhere and cannot be deleted`,
      );
    }
    await this.recordAudit(
      user,
      'RECEIVABLE_DRAFT_DELETED',
      'AccountingReceivableDocument',
      document.id,
      { documentNumber: document.documentNumber },
    );
    return { id: document.id, deleted: true };
  }

  deleteDraftInvoice(user: RequestUser, id: string) {
    return this.deleteDraftDocument(
      user,
      id,
      AccountingReceivableDocumentType.INVOICE,
      'invoice',
    );
  }

  deleteDraftCreditNote(user: RequestUser, id: string) {
    return this.deleteDraftDocument(
      user,
      id,
      AccountingReceivableDocumentType.CREDIT_NOTE,
      'credit note',
    );
  }

  private async recordAudit(
    user: RequestUser,
    action: string,
    entityType: string,
    entityId: string,
    changedFields: unknown,
  ) {
    await this.prisma.accountingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action,
        entityType,
        entityId,
        changedFields: JSON.parse(
          JSON.stringify(changedFields ?? {}),
        ) as Prisma.InputJsonValue,
      },
    });
  }
}
