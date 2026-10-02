import { toCents } from '@/lib/accounting/profitAndLoss';
import type {
  AccountingAgingDocument,
  AccountingAgingPartyReport,
  AgingBucket,
} from '@/types/accounting';

export const AGING_BUCKET_KEYS: AgingBucket[] = ['CURRENT', '1_30', '31_60', '61_90', 'OVER_90'];

/** Buckets are days past the due date; "Current" means not yet due. */
export const AGING_BUCKET_LABELS: Record<AgingBucket, string> = {
  CURRENT: 'Current',
  '1_30': '1–30',
  '31_60': '31–60',
  '61_90': '61–90',
  OVER_90: 'Over 90',
};

export type AgingPartyRow = {
  id: string;
  code: string;
  name: string;
  /** Outstanding per bucket, in cents. */
  buckets: Record<AgingBucket, number>;
  total: number;
  documents: AccountingAgingDocument[];
};

/** Everything owed in one currency; amounts in different currencies are never added together. */
export type AgingCurrencyBlock = {
  currency: string;
  parties: AgingPartyRow[];
  totals: { buckets: Record<AgingBucket, number>; total: number };
};

const emptyBuckets = () =>
  Object.fromEntries(AGING_BUCKET_KEYS.map((key) => [key, 0])) as Record<AgingBucket, number>;

/** A bucket's share of the block total as a percentage, or null when nothing is owed. */
export const bucketShare = (cents: number, total: number) =>
  total === 0 ? null : (cents / total) * 100;

/**
 * Regroups the report by currency: one block per currency listing the parties that owe (or are
 * owed) in it, largest balance first. `search` narrows the parties by name or code.
 */
export function buildAgingBlocks(
  report: AccountingAgingPartyReport,
  search: string,
): AgingCurrencyBlock[] {
  const needle = search.trim().toLowerCase();
  const blocks = new Map<string, AgingCurrencyBlock>();

  for (const entry of report.parties) {
    const { party } = entry;
    if (needle && !`${party.code} ${party.name}`.toLowerCase().includes(needle)) continue;

    for (const totals of entry.agingByCurrency) {
      const buckets = emptyBuckets();
      for (const key of AGING_BUCKET_KEYS) buckets[key] = toCents(totals[key]);
      const total = AGING_BUCKET_KEYS.reduce((sum, key) => sum + buckets[key], 0);

      const block = blocks.get(totals.currency) ?? {
        currency: totals.currency,
        parties: [],
        totals: { buckets: emptyBuckets(), total: 0 },
      };
      block.parties.push({
        id: party.id,
        code: party.code,
        name: party.name,
        buckets,
        total,
        documents: entry.documents.filter((document) => document.currency === totals.currency),
      });
      for (const key of AGING_BUCKET_KEYS) block.totals.buckets[key] += buckets[key];
      block.totals.total += total;
      blocks.set(totals.currency, block);
    }
  }

  return Array.from(blocks.values())
    .sort((a, b) => a.currency.localeCompare(b.currency))
    .map((block) => ({
      ...block,
      parties: block.parties.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)),
    }));
}
