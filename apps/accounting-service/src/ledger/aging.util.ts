import { Prisma } from '../../prisma/generated/client';

export const AGING_BUCKETS = [
  'CURRENT',
  '1_30',
  '31_60',
  '61_90',
  'OVER_90',
] as const;
export type AgingBucket = (typeof AGING_BUCKETS)[number];

const DAY_MS = 86_400_000;
const zero = new Prisma.Decimal(0);

/**
 * Whole days past due at the as-of date (0 when not yet due, or when there is no due date)
 * and the aging bucket that falls in.
 */
export function agingBucket(asOfDate: Date, dueDate: Date | null) {
  const daysOverdue = dueDate
    ? Math.max(0, Math.floor((asOfDate.getTime() - dueDate.getTime()) / DAY_MS))
    : 0;
  const bucket: AgingBucket =
    daysOverdue === 0
      ? 'CURRENT'
      : daysOverdue <= 30
        ? '1_30'
        : daysOverdue <= 60
          ? '31_60'
          : daysOverdue <= 90
            ? '61_90'
            : 'OVER_90';
  return { daysOverdue, bucket };
}

type OpenItem = {
  id: string;
  documentNumber: string;
  documentDate: Date;
  dueDate: Date | null;
  currency: string;
  totalAmount: Prisma.Decimal;
  /** Already formatted; what is still unpaid at the as-of date. */
  outstandingAmount: string;
};

type Party = { id: string; code: string; name: string };

/**
 * Groups open items by customer or vendor: per-currency bucket totals plus the open documents
 * behind them, so the aging report can show a party row that expands into its invoices.
 * `money` formats amounts the same way the calling service does.
 */
export function partyAging<T extends OpenItem>(
  asOfDate: Date,
  rows: T[],
  partyOf: (row: T) => Party,
  money: (value: Prisma.Decimal) => string,
) {
  const parties = new Map<
    string,
    {
      party: Party;
      totals: Map<string, Record<AgingBucket, Prisma.Decimal>>;
      documents: Array<{
        id: string;
        documentNumber: string;
        documentDate: Date;
        dueDate: Date | null;
        currency: string;
        totalAmount: string;
        outstandingAmount: string;
        daysOverdue: number;
        bucket: AgingBucket;
      }>;
    }
  >();

  for (const row of rows) {
    const party = partyOf(row);
    const entry = parties.get(party.id) ?? {
      party,
      totals: new Map<string, Record<AgingBucket, Prisma.Decimal>>(),
      documents: [],
    };
    const { daysOverdue, bucket } = agingBucket(asOfDate, row.dueDate);
    const totals =
      entry.totals.get(row.currency) ??
      (Object.fromEntries(AGING_BUCKETS.map((name) => [name, zero])) as Record<
        AgingBucket,
        Prisma.Decimal
      >);
    totals[bucket] = totals[bucket].plus(row.outstandingAmount);
    entry.totals.set(row.currency, totals);
    entry.documents.push({
      id: row.id,
      documentNumber: row.documentNumber,
      documentDate: row.documentDate,
      dueDate: row.dueDate,
      currency: row.currency,
      totalAmount: money(row.totalAmount),
      outstandingAmount: row.outstandingAmount,
      daysOverdue,
      bucket,
    });
    parties.set(party.id, entry);
  }

  return Array.from(parties.values())
    .sort((a, b) => a.party.name.localeCompare(b.party.name))
    .map(({ party, totals, documents }) => ({
      party,
      agingByCurrency: Array.from(totals.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([currency, amounts]) => ({
          currency,
          ...Object.fromEntries(
            AGING_BUCKETS.map((name) => [name, money(amounts[name])]),
          ),
        })),
      documents,
    }));
}
