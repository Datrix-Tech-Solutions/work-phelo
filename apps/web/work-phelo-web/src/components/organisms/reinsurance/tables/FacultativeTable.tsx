'use client';

import { useState, useMemo } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useRouter, useParams } from 'next/navigation';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { CreateFacultativePanel } from '@/components/organisms/reinsurance/panels/CreateFacultativePanel';
import { EditFacultativePanel } from '@/components/organisms/reinsurance/panels/EditFacultativePanel';
import {
  Facultative,
  FacultativeStatus,
  PlacementDisplayStatus,
  PlacementPayment,
  PLACEMENT_DISPLAY_STATUSES,
  toDisplayStatus,
  toStatusLabel,
} from '@/types/reinsurance';
import { useFacultatives, usePlacementPayments } from '@/hooks';
import { api } from '@/lib/api';

const PAGE_SIZE = 10;

function fmtAmount(val: number) {
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const RAW_STATUS_VARIANT_MAP: Record<
  FacultativeStatus,
  'success' | 'warning' | 'neutral' | 'danger'
> = {
  DRAFT: 'neutral',
  MARKETING: 'warning',
  PARTIALLY_PLACED: 'warning',
  PLACED: 'success',
  CLOSING: 'success',
  CLOSED: 'success',
  DECLINED: 'danger',
  CANCELLED: 'danger',
};

const STATUS_FILTER_OPTIONS = PLACEMENT_DISPLAY_STATUSES.map((s) => ({ value: s, label: s }));

type PaymentStatus = 'Outstanding' | 'Partially Paid' | 'Paid';

const PAYMENT_STATUS_CLASS: Record<PaymentStatus, string> = {
  Outstanding: 'text-xs text-gray-400',
  'Partially Paid': 'text-xs text-yellow-600 font-medium',
  Paid: 'text-xs text-green-600 font-medium',
};

function netPremiumFor(row: Facultative): number {
  const facPremium =
    row.premium != null && row.facultativeOffer != null
      ? (row.facultativeOffer / 100) * row.premium
      : 0;
  return row.commission != null ? facPremium * (1 - row.commission / 100) : facPremium;
}

function PaymentStatusCell({ placement }: { placement: Facultative }) {
  const { data: payments = [] } = usePlacementPayments(placement.id);
  const netPremium = netPremiumFor(placement);
  const paid = payments
    .filter((p) => p.status === 'RECORDED')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  let paymentStatus: PaymentStatus = 'Outstanding';
  if (netPremium > 0 && paid >= netPremium) paymentStatus = 'Paid';
  else if (paid > 0) paymentStatus = 'Partially Paid';

  return (
    <div className="flex flex-col gap-1 items-start">
      <Badge
        label={toStatusLabel(placement.status)}
        variant={RAW_STATUS_VARIANT_MAP[placement.status]}
      />
      <span className={PAYMENT_STATUS_CLASS[paymentStatus]}>{paymentStatus}</span>
    </div>
  );
}

const COLUMNS: Column<Facultative>[] = [
  {
    key: 'reference',
    label: 'Policy Number',
    width: '190px',
    render: (row) => (
      <span className="inline-flex items-center px-3 py-1 rounded-full border border-blue-300 text-xs font-medium text-blue-700 bg-blue-50 whitespace-nowrap">
        {row.reference}
      </span>
    ),
  },
  {
    key: 'title',
    label: 'Insured / Risk Type',
    width: '1.6fr',
    render: (row) => (
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold text-gray-900 leading-tight">{row.title}</span>
        <span className="text-xs text-gray-400">{row.classOfBusiness ?? '—'}</span>
      </div>
    ),
  },
  {
    key: 'cedant',
    label: 'Cedant',
    width: '1.3fr',
    render: (row) => <span className="text-gray-700">{row.cedant.name}</span>,
  },
  {
    key: 'facultativeOffer',
    label: 'Fac Offer',
    width: '100px',
    render: (row) => (
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold text-gray-900">
          {row.facultativeOffer != null ? `${row.facultativeOffer}%` : '—'}
        </span>
      </div>
    ),
  },
  {
    key: 'premium',
    label: 'Fac Premium',
    width: '1.2fr',
    render: (row) => (
      <span className="font-semibold text-gray-900 whitespace-nowrap">
        {row.premium != null ? `${row.currency ?? ''} ${fmtAmount(row.premium)}` : '—'}
      </span>
    ),
  },
  {
    key: 'totalAcceptedPercent',
    label: 'Signing Progress',
    width: '160px',
    className: 'pr-6',
    render: (row) => {
      const facOffer = row.facultativeOffer ?? 0;
      const accepted = row.totalAcceptedPercent ?? 0;
      const barWidth = facOffer > 0 ? Math.min(100, (accepted / facOffer) * 100) : 0;
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-gray-700">{accepted.toFixed(1)}%</span>
            <span className="text-gray-400">{barWidth.toFixed(0)}% Placed</span>
          </div>
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barWidth >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
        </div>
      );
    },
  },

  {
    key: 'status',
    label: 'Status',
    width: '120px',
    render: (row) => <PaymentStatusCell placement={row} />,
  },
];

const PLACEMENT_STATUSES: FacultativeStatus[] = ['DRAFT', 'MARKETING'];
const CLOSING_STATUSES: FacultativeStatus[] = ['CLOSING', 'CLOSED', 'DECLINED', 'CANCELLED'];

export function FacultativeTable({ tab = 'placements' }: { tab?: 'placements' | 'closing' }) {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Facultative | null>(null);

  const { data: allRows = [], isLoading } = useFacultatives();

  const placedRows = useMemo(
    () => allRows.filter((r) => r.status === 'PLACED' || r.status === 'PARTIALLY_PLACED'),
    [allRows],
  );

  const placedPaymentQueries = useQueries({
    queries: placedRows.map((p) => ({
      queryKey: ['reinsurance', 'placements', p.id, 'payments'],
      queryFn: async () => {
        const res = await api.get(`/operations/reinsurance/placements/${p.id}/payments`);
        return (res.data?.items ?? []) as PlacementPayment[];
      },
    })),
  });

  const paidPlacementIds = useMemo(() => {
    const ids = new Set<string>();
    placedRows.forEach((p, i) => {
      const payments = placedPaymentQueries[i]?.data ?? [];
      const netPremium = netPremiumFor(p);
      const paid = payments
        .filter((pmt) => pmt.status === 'RECORDED')
        .reduce((sum, pmt) => sum + parseFloat(pmt.amount), 0);
      if (netPremium > 0 && paid >= netPremium) ids.add(p.id);
    });
    return ids;
  }, [placedRows, placedPaymentQueries]);

  const filtered = useMemo(() => {
    let rows = allRows;
    rows = rows.filter((r) => {
      if (r.status === 'PLACED' || r.status === 'PARTIALLY_PLACED') {
        const isPaid = paidPlacementIds.has(r.id);
        return tab === 'placements' ? !isPaid : isPaid;
      }
      const allowed = tab === 'placements' ? PLACEMENT_STATUSES : CLOSING_STATUSES;
      return allowed.includes(r.status);
    });
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.reference.toLowerCase().includes(q) ||
          r.cedant.name.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          (r.classOfBusiness?.toLowerCase().includes(q) ?? false),
      );
    }
    if (statusFilter) {
      rows = rows.filter(
        (r) => toDisplayStatus(r.status) === (statusFilter as PlacementDisplayStatus),
      );
    }
    return rows;
  }, [allRows, search, statusFilter, tab, paidPlacementIds]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search facultative…"
        searchValue={search}
        onRowClick={(row) =>
          router.push(`/${tenantSlug}/operations/reinsurance/facultative/${row.id}`)
        }
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        filterOptions={STATUS_FILTER_OPTIONS}
        onFilter={(v) => {
          setStatusFilter(v);
          setPage(1);
        }}
        onExport={() => {
          /* TODO: implement export */
        }}
        actionButton={{ label: 'New Offer', onClick: () => setPanelOpen(true) }}
        rowActions={(row) => [
          {
            label: 'View',
            onClick: () =>
              router.push(`/${tenantSlug}/operations/reinsurance/facultative/${row.id}`),
          },
          {
            label: 'Edit Slip',
            onClick: () => setEditTarget(row),
          },
          {
            label: 'Delete',
            onClick: () => {
              /* TODO */
            },
            danger: true,
          },
        ]}
        emptyMessage="No facultative placements found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <CreateFacultativePanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />

      {editTarget && (
        <EditFacultativePanel
          isOpen={!!editTarget}
          placement={editTarget}
          onClose={() => setEditTarget(null)}
        />
      )}
    </>
  );
}
