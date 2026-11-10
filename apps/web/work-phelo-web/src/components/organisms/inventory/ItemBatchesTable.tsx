'use client';

import { useMemo, useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Badge } from '@/components/atoms/Badge';
import { useInventoryWarehouses } from '@/hooks/inventory/useInventoryWarehouses';
import { useStockLots, type StockLot } from '@/hooks/inventory/useStockLots';
import { todayLocal } from '@/lib/utils';

const PAGE_SIZE = 10;
const SOON_DAYS = 30;

const formatNumber = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 4 });

const daysUntil = (iso: string) =>
  Math.round(
    (new Date(`${iso}T00:00:00`).getTime() - new Date(`${todayLocal()}T00:00:00`).getTime()) /
      86_400_000,
  );

function expiryBadge(expiry: string | null) {
  if (!expiry) return <span className="text-sm text-gray-400">—</span>;
  const days = daysUntil(expiry);
  if (days < 0) return <Badge variant="danger" label="Expired" />;
  if (days <= SOON_DAYS) return <Badge variant="warning" label={`${days}d left`} />;
  return <Badge variant="success" label="OK" />;
}

/** Batches / lots received for one item, with how much of each is left. */
export function ItemBatchesTable({ itemId }: { itemId: string }) {
  const { warehouses } = useInventoryWarehouses();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  // '' is All Batches.
  const [batchValue, setBatchValue] = useState('');

  const { lots, isLoading } = useStockLots();
  const allBatches = useMemo(() => lots.filter((l) => l.itemId === itemId), [lots, itemId]);

  const warehouseName = (id: string | null) =>
    (id ? warehouses.find((w) => w.id === id)?.name : null) ?? '—';

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return allBatches
      .filter((b) => !batchValue || b.lotNumber === batchValue)
      .filter(
        (b) =>
          !term ||
          b.lotNumber.toLowerCase().includes(term) ||
          (b.variant ?? '').toLowerCase().includes(term),
      );
  }, [allBatches, search, batchValue]);
  // The distinct batch numbers received for this item, for the filter.
  const batchNames = useMemo(
    () => [...new Set(allBatches.filter((b) => b.lotNumber).map((b) => b.lotNumber))],
    [allBatches],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const dash = (v: string | null) => <span className="text-sm text-gray-600">{v || '—'}</span>;

  const columns: Column<StockLot>[] = [
    {
      key: 'batch',
      label: 'Batch / Lot No.',
      width: 'minmax(140px, 1.5fr)',
      render: (row) => (
        <span className="font-bold text-gray-900 truncate">{row.lotNumber || '—'}</span>
      ),
    },
    { key: 'variant', label: 'Variant', width: '120px', render: (row) => dash(row.variant) },
    {
      key: 'warehouse',
      label: 'Warehouse',
      width: 'minmax(120px, 1fr)',
      render: (row) => dash(warehouseName(row.warehouseId)),
    },
    {
      key: 'received',
      label: 'Qty Received',
      width: '110px',
      render: (row) => (
        <span className="text-sm text-gray-600">{formatNumber(row.receivedQuantity)}</span>
      ),
    },
    {
      key: 'remaining',
      label: 'Qty Left',
      width: '100px',
      render: (row) => (
        <span className="text-sm font-bold text-gray-900">
          {formatNumber(row.remainingQuantity)}
        </span>
      ),
    },
    {
      key: 'receivedAt',
      label: 'Received',
      width: '110px',
      render: (row) => dash(row.receivedAt.slice(0, 10)),
    },
    {
      key: 'mfg',
      label: 'Mfg Date',
      width: '110px',
      render: (row) => dash(row.manufactureDate),
    },
    { key: 'expiry', label: 'Expiry Date', width: '110px', render: (row) => dash(row.expiryDate) },
    {
      key: 'status',
      label: 'Expiry Status',
      width: '120px',
      render: (row) => expiryBadge(row.expiryDate),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      isLoading={isLoading}
      emptyMessage="No batches recorded for this item"
      searchPlaceholder="Search by batch or variant..."
      searchValue={search}
      onSearch={(q) => {
        setSearch(q);
        setPage(1);
      }}
      extraFilters={
        <div className="w-48">
          <SearchSelect
            placeholder="Batch"
            allLabel="All Batches"
            showAllOption
            clearable={false}
            options={batchNames.map((b) => ({ value: b, label: b }))}
            value={batchValue}
            onChange={(v) => {
              setBatchValue(v);
              setPage(1);
            }}
          />
        </div>
      }
      currentPage={page}
      totalPages={totalPages}
      onPageChange={setPage}
      noInternalScroll
    />
  );
}
