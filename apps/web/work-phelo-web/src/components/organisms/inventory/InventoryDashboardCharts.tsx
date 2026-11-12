'use client';

import { useMemo } from 'react';
import type { Period } from '@/components/atoms/PeriodToggle';
import {
  compactNumber,
  SERIES_SUBTITLES,
} from '@/components/molecules/accounting/dashboardChartFormat';
import { PeriodBarChart } from '@/components/molecules/shared/PeriodBarChart';
import { usePurchaseOrders, purchaseOrderValue } from '@/hooks/inventory/usePurchaseOrders';
import { getMovementValue, useStockMovements } from '@/hooks/inventory/useStockMovements';
import { formatInventoryValue } from '@/lib/inventoryCurrency';
import { periodSeriesBuckets, type SeriesBucket } from '@/lib/periodSeries';

const GREEN = '#1baf7a';
const RED = '#e34948';
const BLUE = '#2a78d6';
const AMBER = '#f59e0b';

const money = (value: number | null) => (value === null ? '' : formatInventoryValue(value));

/** Adds up `amount` for each bucket whose date range holds the record's date (YYYY-MM-DD). */
function sumByBucket<T>(
  buckets: SeriesBucket[],
  records: T[],
  dateOf: (record: T) => string,
  amountOf: (record: T) => number,
): number[] {
  const totals = buckets.map(() => 0);
  for (const record of records) {
    const date = dateOf(record).slice(0, 10);
    const index = buckets.findIndex((b) => b.fromDate <= date && date <= b.toDate);
    if (index >= 0) totals[index] += amountOf(record);
  }
  return totals;
}

/** Value of stock received against value issued. Stock out is valued at selling price, so the
 * two bars are not like for like; the card's subtitle says so. */
export function StockFlowChart({ period }: { period: Period }) {
  const { movements, isLoading } = useStockMovements();
  const buckets = useMemo(() => periodSeriesBuckets(period, { calendar: true }), [period]);

  const series = useMemo(() => {
    const done = movements.filter((m) => m.status === 'COMPLETED' && m.kind !== 'REVALUATION');
    const of = (type: 'STOCK_IN' | 'STOCK_OUT') =>
      sumByBucket(
        buckets,
        done.filter((m) => m.type === type),
        (m) => m.date,
        getMovementValue,
      );
    return { stockIn: of('STOCK_IN'), stockOut: of('STOCK_OUT') };
  }, [movements, buckets]);

  return (
    <PeriodBarChart
      title="Stock In vs Stock Out"
      subtitle={`${SERIES_SUBTITLES[period]} · in at cost, out at selling price`}
      buckets={buckets}
      series={[
        { label: 'Stock In', color: GREEN, data: series.stockIn, valueFormatter: money },
        { label: 'Stock Out', color: RED, data: series.stockOut, valueFormatter: money },
      ]}
      isLoading={isLoading}
      emptyText="No stock movements in this range."
      axisFormatter={compactNumber}
    />
  );
}

/** What was ordered from suppliers against what was paid to them. */
export function PurchasesPaymentsChart({ period }: { period: Period }) {
  const { purchaseOrders, isLoading } = usePurchaseOrders();
  const buckets = useMemo(() => periodSeriesBuckets(period, { calendar: true }), [period]);

  const series = useMemo(() => {
    const live = purchaseOrders.filter((o) => o.status !== 'CANCELLED');
    return {
      ordered: sumByBucket(buckets, live, (o) => o.date, purchaseOrderValue),
      paid: sumByBucket(
        buckets,
        live.flatMap((o) => o.payments),
        (p) => p.date,
        (p) => p.amount,
      ),
    };
  }, [purchaseOrders, buckets]);

  return (
    <PeriodBarChart
      title="Purchases vs Payments"
      subtitle={SERIES_SUBTITLES[period]}
      buckets={buckets}
      series={[
        { label: 'Ordered', color: BLUE, data: series.ordered, valueFormatter: money },
        { label: 'Paid', color: AMBER, data: series.paid, valueFormatter: money },
      ]}
      isLoading={isLoading}
      emptyText="No purchases or payments in this range."
      axisFormatter={compactNumber}
    />
  );
}
