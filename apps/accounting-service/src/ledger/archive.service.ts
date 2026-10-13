import { Injectable, NotFoundException } from '@nestjs/common';
import { RequestUser } from '@work-phelo/types';
import {
  AccountingPayableStatus,
  AccountingReceivableStatus,
  CashbookTransactionStatus,
  FiscalPeriodStatus,
  JournalStatus,
  Prisma,
} from '../../prisma/generated/client';
import { PrismaService } from '../prisma/prisma.service';
import { QueryArchiveDto } from './dto/archive.dto';

export type ArchiveKind =
  | 'JOURNAL'
  | 'CASHBOOK'
  | 'INVOICE'
  | 'CREDIT_NOTE'
  | 'RECEIPT'
  | 'BILL'
  | 'DEBIT_NOTE'
  | 'PAYMENT';

export interface ArchiveItem {
  kind: ArchiveKind;
  id: string;
  number: string;
  /** The entry's own date (not the date it was voided). */
  date: Date;
  amount: string | null;
  currency: string | null;
  party: string | null;
  description: string | null;
  voidedAt: Date | null;
  voidedByUserId: string | null;
  voidReason: string | null;
  /** True while the entry's period is open - the only time it can come back. */
  restorable: boolean;
}

const PER_KIND_LIMIT = 200;

/**
 * Every voided entry in one place. Voided entries are out of the main lists and out of every
 * balance and report; this is where they stay, with who voided them and why, until restored.
 * Journals that another record posted are not listed on their own - they come and go with that
 * record, which is listed instead.
 */
@Injectable()
export class ArchiveService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, query: QueryArchiveDto) {
    const range = (field: string) =>
      query.from || query.to
        ? {
            [field]: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {};
    const wants = (kind: ArchiveKind) => !query.kind || query.kind === kind;
    const search = query.search?.trim();

    const [
      openPeriods,
      journals,
      cashbook,
      invoices,
      creditNotes,
      receipts,
      bills,
      debitNotes,
      payments,
    ] = await Promise.all([
      this.prisma.fiscalPeriod.findMany({
        where: { tenantId, status: FiscalPeriodStatus.OPEN },
        select: { startDate: true, endDate: true },
      }),
      wants('JOURNAL')
        ? this.prisma.journalEntry.findMany({
            where: {
              tenantId,
              status: JournalStatus.VOIDED,
              archiveDeletedAt: null,
              sourceModule: null,
              ...range('transactionDate'),
              ...(search
                ? {
                    OR: [
                      {
                        journalNumber: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                      {
                        description: { contains: search, mode: 'insensitive' },
                      },
                      { reference: { contains: search, mode: 'insensitive' } },
                    ],
                  }
                : {}),
            },
            include: { lines: { select: { baseDebit: true } } },
            orderBy: { voidedAt: 'desc' },
            take: PER_KIND_LIMIT,
          })
        : [],
      wants('CASHBOOK')
        ? this.prisma.cashbookTransaction.findMany({
            where: {
              tenantId,
              status: CashbookTransactionStatus.VOIDED,
              archiveDeletedAt: null,
              receivableReceipt: { is: null },
              payablePayment: { is: null },
              ...range('transactionDate'),
              ...(search
                ? {
                    OR: [
                      {
                        transactionNumber: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                      { reference: { contains: search, mode: 'insensitive' } },
                      {
                        description: { contains: search, mode: 'insensitive' },
                      },
                    ],
                  }
                : {}),
            },
            orderBy: { voidedAt: 'desc' },
            take: PER_KIND_LIMIT,
          })
        : [],
      wants('INVOICE')
        ? this.prisma.accountingReceivableDocument.findMany({
            where: this.documentWhere(tenantId, 'INVOICE', range, search),
            include: { customer: { select: { name: true } } },
            orderBy: { voidedAt: 'desc' },
            take: PER_KIND_LIMIT,
          })
        : [],
      wants('CREDIT_NOTE')
        ? this.prisma.accountingReceivableDocument.findMany({
            where: this.documentWhere(tenantId, 'CREDIT_NOTE', range, search),
            include: { customer: { select: { name: true } } },
            orderBy: { voidedAt: 'desc' },
            take: PER_KIND_LIMIT,
          })
        : [],
      wants('RECEIPT')
        ? this.prisma.accountingReceivableReceipt.findMany({
            where: {
              tenantId,
              status: AccountingReceivableStatus.VOIDED,
              archiveDeletedAt: null,
              ...range('receiptDate'),
              ...(search
                ? {
                    OR: [
                      {
                        receiptNumber: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                      { reference: { contains: search, mode: 'insensitive' } },
                    ],
                  }
                : {}),
            },
            include: { customer: { select: { name: true } } },
            orderBy: { voidedAt: 'desc' },
            take: PER_KIND_LIMIT,
          })
        : [],
      wants('BILL')
        ? this.prisma.accountingPayableDocument.findMany({
            where: this.payableWhere(tenantId, 'BILL', range, search),
            include: { vendor: { select: { name: true } } },
            orderBy: { voidedAt: 'desc' },
            take: PER_KIND_LIMIT,
          })
        : [],
      wants('DEBIT_NOTE')
        ? this.prisma.accountingPayableDocument.findMany({
            where: this.payableWhere(tenantId, 'CREDIT_NOTE', range, search),
            include: { vendor: { select: { name: true } } },
            orderBy: { voidedAt: 'desc' },
            take: PER_KIND_LIMIT,
          })
        : [],
      wants('PAYMENT')
        ? this.prisma.accountingPayablePayment.findMany({
            where: {
              tenantId,
              status: AccountingPayableStatus.VOIDED,
              archiveDeletedAt: null,
              ...range('paymentDate'),
              ...(search
                ? {
                    OR: [
                      {
                        paymentNumber: {
                          contains: search,
                          mode: 'insensitive',
                        },
                      },
                      { reference: { contains: search, mode: 'insensitive' } },
                    ],
                  }
                : {}),
            },
            include: { vendor: { select: { name: true } } },
            orderBy: { voidedAt: 'desc' },
            take: PER_KIND_LIMIT,
          })
        : [],
    ]);

    const isOpen = (date: Date) =>
      openPeriods.some(
        (period) => period.startDate <= date && period.endDate >= date,
      );
    const voided = (row: {
      voidedAt: Date | null;
      voidedByUserId: string | null;
      voidReason: string | null;
    }) => ({
      voidedAt: row.voidedAt,
      voidedByUserId: row.voidedByUserId,
      voidReason: row.voidReason,
    });

    const items: ArchiveItem[] = [
      ...journals.map((row) => ({
        kind: 'JOURNAL' as const,
        id: row.id,
        number: row.journalNumber,
        date: row.transactionDate,
        amount: row.lines
          .reduce(
            (sum, line) => sum.plus(line.baseDebit),
            new Prisma.Decimal(0),
          )
          .toString(),
        currency: row.baseCurrency,
        party: null,
        description: row.description,
        restorable: isOpen(row.transactionDate),
        ...voided(row),
      })),
      ...cashbook.map((row) => ({
        kind: 'CASHBOOK' as const,
        id: row.id,
        number: row.transactionNumber ?? row.reference ?? row.id.slice(0, 8),
        date: row.transactionDate,
        amount: row.amount.toString(),
        currency: row.currency,
        party: null,
        description: row.description,
        restorable: isOpen(row.transactionDate),
        ...voided(row),
      })),
      ...invoices.map((row) =>
        this.documentItem('INVOICE', row, isOpen, voided),
      ),
      ...creditNotes.map((row) =>
        this.documentItem('CREDIT_NOTE', row, isOpen, voided),
      ),
      ...receipts.map((row) => ({
        kind: 'RECEIPT' as const,
        id: row.id,
        number: row.receiptNumber,
        date: row.receiptDate,
        amount: row.amount.toString(),
        currency: row.currency,
        party: row.customer.name,
        description: row.description,
        restorable: isOpen(row.receiptDate),
        ...voided(row),
      })),
      ...bills.map((row) => this.payableItem('BILL', row, isOpen, voided)),
      ...debitNotes.map((row) =>
        this.payableItem('DEBIT_NOTE', row, isOpen, voided),
      ),
      ...payments.map((row) => ({
        kind: 'PAYMENT' as const,
        id: row.id,
        number: row.paymentNumber,
        date: row.paymentDate,
        amount: row.amount.toString(),
        currency: row.currency,
        party: row.vendor.name,
        description: row.description,
        restorable: isOpen(row.paymentDate),
        ...voided(row),
      })),
    ];

    items.sort(
      (a, b) => (b.voidedAt?.getTime() ?? 0) - (a.voidedAt?.getTime() ?? 0),
    );
    const limit = Math.min(Math.max(1, query.limit ?? 50), 200);
    const offset = Math.max(0, query.offset ?? 0);
    return {
      items: items.slice(offset, offset + limit),
      total: items.length,
      limit,
      offset,
    };
  }

  /**
   * Deletes an archived entry: it leaves the archive for good. Only a voided entry can be deleted,
   * whatever its period. The row, its journals and the audit trail stay, so nothing is lost from
   * the books' history; it simply stops being listed.
   */
  async deleteArchived(user: RequestUser, kind: ArchiveKind, id: string) {
    if (!(await this.markDeleted(user, kind, id))) {
      throw new NotFoundException('That entry is not in the archive');
    }
    return { id, kind };
  }

  /**
   * Deletes several archived entries at once. Anything no longer in the archive (already deleted,
   * or restored meanwhile) is skipped rather than failing the rest.
   */
  async deleteArchivedMany(
    user: RequestUser,
    items: { kind: ArchiveKind; id: string }[],
  ) {
    let deleted = 0;
    for (const item of items) {
      if (await this.markDeleted(user, item.kind, item.id)) deleted += 1;
    }
    return { deleted, skipped: items.length - deleted };
  }

  /** Hides one voided entry from the archive. False when it is not (or no longer) there. */
  private async markDeleted(
    user: RequestUser,
    kind: ArchiveKind,
    id: string,
  ): Promise<boolean> {
    const tenantId = user.tenantId;
    const data = {
      archiveDeletedAt: new Date(),
      archiveDeletedByUserId: user.id,
    };
    const base = { id, tenantId, archiveDeletedAt: null };
    let count: number;
    let entityType: string;
    switch (kind) {
      case 'JOURNAL':
        entityType = 'JournalEntry';
        ({ count } = await this.prisma.journalEntry.updateMany({
          where: { ...base, status: JournalStatus.VOIDED, sourceModule: null },
          data,
        }));
        break;
      case 'CASHBOOK':
        entityType = 'CashbookTransaction';
        ({ count } = await this.prisma.cashbookTransaction.updateMany({
          where: {
            ...base,
            status: CashbookTransactionStatus.VOIDED,
            receivableReceipt: { is: null },
            payablePayment: { is: null },
          },
          data,
        }));
        break;
      case 'INVOICE':
      case 'CREDIT_NOTE':
        entityType = 'AccountingReceivableDocument';
        ({ count } = await this.prisma.accountingReceivableDocument.updateMany({
          where: {
            ...base,
            documentType: kind,
            status: AccountingReceivableStatus.VOIDED,
          },
          data,
        }));
        break;
      case 'RECEIPT':
        entityType = 'AccountingReceivableReceipt';
        ({ count } = await this.prisma.accountingReceivableReceipt.updateMany({
          where: { ...base, status: AccountingReceivableStatus.VOIDED },
          data,
        }));
        break;
      case 'BILL':
      case 'DEBIT_NOTE':
        entityType = 'AccountingPayableDocument';
        ({ count } = await this.prisma.accountingPayableDocument.updateMany({
          where: {
            ...base,
            documentType: kind === 'BILL' ? 'BILL' : 'CREDIT_NOTE',
            status: AccountingPayableStatus.VOIDED,
          },
          data,
        }));
        break;
      case 'PAYMENT':
        entityType = 'AccountingPayablePayment';
        ({ count } = await this.prisma.accountingPayablePayment.updateMany({
          where: { ...base, status: AccountingPayableStatus.VOIDED },
          data,
        }));
        break;
    }
    if (count === 0) return false;
    await this.prisma.accountingAuditLog.create({
      data: {
        tenantId,
        actorUserId: user.id,
        action: 'ARCHIVE_ENTRY_DELETED',
        entityType,
        entityId: id,
        changedFields: { kind },
      },
    });
    return true;
  }

  private documentWhere(
    tenantId: string,
    documentType: 'INVOICE' | 'CREDIT_NOTE',
    range: (field: string) => object,
    search?: string,
  ): Prisma.AccountingReceivableDocumentWhereInput {
    return {
      tenantId,
      documentType,
      status: AccountingReceivableStatus.VOIDED,
      archiveDeletedAt: null,
      ...range('documentDate'),
      ...(search
        ? {
            OR: [
              { documentNumber: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private payableWhere(
    tenantId: string,
    documentType: 'BILL' | 'CREDIT_NOTE',
    range: (field: string) => object,
    search?: string,
  ): Prisma.AccountingPayableDocumentWhereInput {
    return {
      tenantId,
      documentType,
      status: AccountingPayableStatus.VOIDED,
      archiveDeletedAt: null,
      ...range('documentDate'),
      ...(search
        ? {
            OR: [
              { documentNumber: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
  }

  private documentItem(
    kind: ArchiveKind,
    row: {
      id: string;
      documentNumber: string;
      documentDate: Date;
      totalAmount: Prisma.Decimal;
      currency: string;
      description: string | null;
      voidedAt: Date | null;
      voidedByUserId: string | null;
      voidReason: string | null;
      customer: { name: string };
    },
    isOpen: (date: Date) => boolean,
    voided: (row: {
      voidedAt: Date | null;
      voidedByUserId: string | null;
      voidReason: string | null;
    }) => object,
  ) {
    return {
      kind,
      id: row.id,
      number: row.documentNumber,
      date: row.documentDate,
      amount: row.totalAmount.toString(),
      currency: row.currency,
      party: row.customer.name,
      description: row.description,
      restorable: isOpen(row.documentDate),
      ...voided(row),
    } as ArchiveItem;
  }

  private payableItem(
    kind: ArchiveKind,
    row: {
      id: string;
      documentNumber: string;
      documentDate: Date;
      totalAmount: Prisma.Decimal;
      currency: string;
      description: string | null;
      voidedAt: Date | null;
      voidedByUserId: string | null;
      voidReason: string | null;
      vendor: { name: string };
    },
    isOpen: (date: Date) => boolean,
    voided: (row: {
      voidedAt: Date | null;
      voidedByUserId: string | null;
      voidReason: string | null;
    }) => object,
  ) {
    return {
      kind,
      id: row.id,
      number: row.documentNumber,
      date: row.documentDate,
      amount: row.totalAmount.toString(),
      currency: row.currency,
      party: row.vendor.name,
      description: row.description,
      restorable: isOpen(row.documentDate),
      ...voided(row),
    } as ArchiveItem;
  }
}
