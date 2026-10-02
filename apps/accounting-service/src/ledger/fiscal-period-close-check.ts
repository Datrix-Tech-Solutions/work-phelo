import {
  AccountingPayableStatus,
  AccountingReceivableStatus,
  BankReconciliationStatus,
  CashbookTransactionStatus,
  FiscalPeriodStatus,
  JournalStatus,
  Prisma,
  SourceEventStatus,
} from '../../prisma/generated/client';

export type CloseCheckCode =
  | 'PRIOR_PERIOD_OPEN'
  | 'DRAFT_JOURNALS'
  | 'DRAFT_PAYABLE_DOCUMENTS'
  | 'DRAFT_RECEIVABLE_DOCUMENTS'
  | 'DRAFT_CASHBOOK_TRANSACTIONS'
  | 'SOURCE_EVENTS_PENDING'
  | 'BANK_RECONCILIATION_PENDING';

export interface CloseCheckItem {
  code: CloseCheckCode;
  message: string;
  count: number;
}

export interface FiscalPeriodCloseCheck {
  periodId: string;
  /** Must be cleared before the period can leave OPEN. */
  blockers: CloseCheckItem[];
  /** Worth a look, but never stop the close. */
  warnings: CloseCheckItem[];
  canClose: boolean;
}

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

/**
 * What still needs attention before a period stops accepting postings. A period that has
 * left OPEN takes no more postings, so anything left unposted inside it could never be
 * posted — hence the blockers. Source events carry no business date and cannot be tied to
 * a period, so they are a tenant-wide warning rather than a blocker.
 */
export async function runFiscalPeriodCloseChecks(
  client: Prisma.TransactionClient,
  tenantId: string,
  period: { id: string; startDate: Date; endDate: Date },
): Promise<FiscalPeriodCloseCheck> {
  const inPeriod = { gte: period.startDate, lte: period.endDate };

  const [
    earlierOpen,
    draftJournals,
    draftPayables,
    draftReceivables,
    draftCashbook,
    pendingEvents,
    unreconciled,
  ] = await Promise.all([
    client.fiscalPeriod.findMany({
      where: {
        tenantId,
        status: FiscalPeriodStatus.OPEN,
        endDate: { lt: period.startDate },
      },
      orderBy: { startDate: 'asc' },
      select: { name: true },
    }),
    client.journalEntry.count({
      where: {
        tenantId,
        fiscalPeriodId: period.id,
        status: JournalStatus.DRAFT,
      },
    }),
    client.accountingPayableDocument.count({
      where: {
        tenantId,
        status: AccountingPayableStatus.DRAFT,
        documentDate: inPeriod,
      },
    }),
    client.accountingReceivableDocument.count({
      where: {
        tenantId,
        status: AccountingReceivableStatus.DRAFT,
        documentDate: inPeriod,
      },
    }),
    client.cashbookTransaction.count({
      where: {
        tenantId,
        status: CashbookTransactionStatus.DRAFT,
        transactionDate: inPeriod,
      },
    }),
    client.sourceEventInbox.count({
      where: {
        tenantId,
        status: {
          in: [
            SourceEventStatus.RECEIVED,
            SourceEventStatus.PROCESSING,
            SourceEventStatus.FAILED,
          ],
        },
      },
    }),
    // Active cash accounts that moved money in the period but have no completed
    // reconciliation reaching the period's end.
    client.accountingCashAccount.findMany({
      where: {
        tenantId,
        isActive: true,
        transactions: {
          some: {
            status: CashbookTransactionStatus.POSTED,
            transactionDate: inPeriod,
          },
        },
        reconciliations: {
          none: {
            status: BankReconciliationStatus.COMPLETED,
            statementEndDate: { gte: period.endDate },
          },
        },
      },
      orderBy: { name: 'asc' },
      select: { name: true },
    }),
  ]);

  const blockers: CloseCheckItem[] = [];
  if (earlierOpen.length) {
    blockers.push({
      code: 'PRIOR_PERIOD_OPEN',
      message: `Earlier ${earlierOpen.length === 1 ? 'period is' : 'periods are'} still open: ${earlierOpen
        .map((p) => p.name)
        .join(', ')}`,
      count: earlierOpen.length,
    });
  }
  if (draftJournals) {
    blockers.push({
      code: 'DRAFT_JOURNALS',
      message: `${plural(draftJournals, 'draft journal', 'draft journals')} in this period`,
      count: draftJournals,
    });
  }
  if (draftPayables) {
    blockers.push({
      code: 'DRAFT_PAYABLE_DOCUMENTS',
      message: `${plural(draftPayables, 'draft bill or vendor credit', 'draft bills or vendor credits')} dated in this period`,
      count: draftPayables,
    });
  }
  if (draftReceivables) {
    blockers.push({
      code: 'DRAFT_RECEIVABLE_DOCUMENTS',
      message: `${plural(draftReceivables, 'draft invoice or customer credit', 'draft invoices or customer credits')} dated in this period`,
      count: draftReceivables,
    });
  }
  if (draftCashbook) {
    blockers.push({
      code: 'DRAFT_CASHBOOK_TRANSACTIONS',
      message: `${plural(draftCashbook, 'unposted cashbook transaction', 'unposted cashbook transactions')} dated in this period`,
      count: draftCashbook,
    });
  }

  const warnings: CloseCheckItem[] = [];
  if (pendingEvents) {
    warnings.push({
      code: 'SOURCE_EVENTS_PENDING',
      message: `${plural(pendingEvents, 'source event is', 'source events are')} waiting to be posted (events are not tied to a period)`,
      count: pendingEvents,
    });
  }
  if (unreconciled.length) {
    warnings.push({
      code: 'BANK_RECONCILIATION_PENDING',
      message: `No completed bank reconciliation through the period end for: ${unreconciled
        .map((account) => account.name)
        .join(', ')}`,
      count: unreconciled.length,
    });
  }

  return {
    periodId: period.id,
    blockers,
    warnings,
    canClose: blockers.length === 0,
  };
}
