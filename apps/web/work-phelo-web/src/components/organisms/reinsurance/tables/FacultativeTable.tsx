'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { CreateFacultativePanel } from '@/components/organisms/reinsurance/panels/CreateFacultativePanel';
import { EditFacultativePanel } from '@/components/organisms/reinsurance/panels/EditFacultativePanel';
import {
  Facultative,
  FacultativeStatus,
  PlacementPayment,
  toStatusLabel,
} from '@/types/reinsurance';
import { useFacultatives, usePlacementPayments } from '@/hooks';

const PAGE_SIZE = 10;

function fmtAmount(val: number) {
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const RAW_STATUS_VARIANT_MAP: Record<
  FacultativeStatus,
  'success' | 'warning' | 'neutral' | 'danger'
> = {
  DRAFT: 'neutral',
  MARKETING: 'neutral',
  PARTIALLY_PLACED: 'success',
  PLACED: 'success',
  CLOSING: 'success',
  CLOSED: 'success',
  DECLINED: 'danger',
  CANCELLED: 'danger',
};

const PLACEMENTS_FILTER_OPTIONS = [
  { value: 'Open', label: 'Open' },
  { value: 'Draft', label: 'Draft' },
];

const CLOSING_FILTER_OPTIONS = [
  { value: 'Placed', label: 'Placed' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Outstanding', label: 'Outstanding' },
  { value: 'Partially Paid', label: 'Partially Paid' },
  { value: 'Paid', label: 'Paid' },
];

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
    key: 'participants' as keyof Facultative,
    label: 'Participants',
    width: '110px',
    render: (row) => {
      const total = row.participants?.length ?? 0;
      const accepted = row.participants?.filter((p) => p.status === 'ACCEPTED').length ?? 0;
      return (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-gray-900">
            {accepted} / {total}
          </span>
          <span className="text-xs text-gray-400">accepted</span>
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
const CLOSING_STATUSES: FacultativeStatus[] = [
  'PARTIALLY_PLACED',
  'PLACED',
  'CLOSING',
  'CLOSED',
  'DECLINED',
  'CANCELLED',
];

export function FacultativeTable({ tab = 'placements' }: { tab?: 'placements' | 'closing' }) {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Facultative | null>(null);

  const { data: allRows = [], isLoading } = useFacultatives();

  const closingRows = useMemo(
    () => allRows.filter((r) => CLOSING_STATUSES.includes(r.status)),
    [allRows],
  );

  const paymentQueries = useQueries({
    queries:
      tab === 'closing'
        ? closingRows.map((row) => ({
            queryKey: ['reinsurance', 'placements', row.id, 'payments'] as const,
            queryFn: async () => {
              const res = await api.get(`/operations/reinsurance/placements/${row.id}/payments`);
              return (res.data?.items ?? res.data ?? []) as PlacementPayment[];
            },
          }))
        : [],
  });

  const paymentStatusMap = useMemo(() => {
    const map = new Map<string, PaymentStatus>();
    closingRows.forEach((row, i) => {
      const payments = paymentQueries[i]?.data ?? [];
      const netPremium = netPremiumFor(row);
      const paid = payments
        .filter((p) => p.status === 'RECORDED')
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);
      let status: PaymentStatus = 'Outstanding';
      if (netPremium > 0 && paid >= netPremium) status = 'Paid';
      else if (paid > 0) status = 'Partially Paid';
      map.set(row.id, status);
    });
    return map;
  }, [closingRows, paymentQueries]);

  const filtered = useMemo(() => {
    let rows = allRows;
    const allowed = tab === 'placements' ? PLACEMENT_STATUSES : CLOSING_STATUSES;
    rows = rows.filter((r) => allowed.includes(r.status));
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
      if (tab === 'placements') {
        if (statusFilter === 'Open') rows = rows.filter((r) => r.status === 'MARKETING');
        else if (statusFilter === 'Draft') rows = rows.filter((r) => r.status === 'DRAFT');
      } else {
        if (statusFilter === 'Placed') {
          rows = rows.filter((r) =>
            (['PLACED', 'PARTIALLY_PLACED', 'CLOSING'] as FacultativeStatus[]).includes(r.status),
          );
        } else if (statusFilter === 'Closed') {
          rows = rows.filter((r) =>
            (['CLOSED', 'DECLINED', 'CANCELLED'] as FacultativeStatus[]).includes(r.status),
          );
        } else {
          rows = rows.filter((r) => paymentStatusMap.get(r.id) === (statusFilter as PaymentStatus));
        }
      }
    }
    return rows;
  }, [allRows, search, statusFilter, tab, paymentStatusMap]);

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
          router.push(
            `/${tenantSlug}/operations/reinsurance/facultative/${row.id}${tab === 'closing' ? '?from=closing' : ''}`,
          )
        }
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        filterOptions={tab === 'placements' ? PLACEMENTS_FILTER_OPTIONS : CLOSING_FILTER_OPTIONS}
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
              router.push(
                `/${tenantSlug}/operations/reinsurance/facultative/${row.id}${tab === 'closing' ? '?from=closing' : ''}`,
              ),
          },
          ...(tab === 'closing'
            ? [
                {
                  label: 'Premium',
                  onClick: () =>
                    router.push(
                      `/${tenantSlug}/operations/reinsurance/payments/${row.id}?from=closing`,
                    ),
                },
              ]
            : []),
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
