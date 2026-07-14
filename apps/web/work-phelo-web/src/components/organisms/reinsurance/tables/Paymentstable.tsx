'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { EndorsedReferencePill } from '@/components/atoms/EndorsedReferencePill';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  Facultative,
  FacultativeStatus,
  PlacementPayment,
  toStatusLabel,
} from '@/types/reinsurance';
import { usePaymentEligibleFacultatives, usePlacementPayments } from '@/hooks';

const PAGE_SIZE = 10;

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number | null | undefined) {
  if (val == null) return '—';
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const RAW_STATUS_VARIANT_MAP: Record<
  FacultativeStatus,
  'success' | 'warning' | 'neutral' | 'danger'
> = {
  DRAFT: 'neutral',
  MARKETING: 'warning',
  PARTIALLY_PLACED: 'success',
  PLACED: 'success',
  CLOSING: 'warning',
  CLOSED: 'success',
  DECLINED: 'danger',
  CANCELLED: 'danger',
};

type PaymentStatus = 'Outstanding' | 'Part Payment' | 'Paid';

const PAYMENT_STATUS_CLASS: Record<PaymentStatus, string> = {
  Outstanding: 'text-xs text-gray-400',
  'Part Payment': 'text-xs text-yellow-600 font-medium',
  Paid: 'text-xs text-green-600 font-medium',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'Placed', label: 'Placed' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Outstanding', label: 'Outstanding' },
  { value: 'Part Payment', label: 'Part Payment' },
  { value: 'Paid', label: 'Paid' },
];

function netPremiumFor(row: Facultative): number {
  const facPremium =
    row.premium != null && row.confirmedPlacedPercent != null
      ? (row.confirmedPlacedPercent / 100) * row.premium
      : 0;
  return row.commission != null ? facPremium * (1 - row.commission / 100) : facPremium;
}

function totalPaidFor(payments: PlacementPayment[]): number {
  return payments
    .filter((p) => p.status === 'RECORDED' && !p.reversalOfPaymentId)
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);
}

function PaymentSummaryCell({ placement }: { placement: Facultative }) {
  const { data: payments = [] } = usePlacementPayments(placement.id);
  const netPremium = netPremiumFor(placement);
  const paid = totalPaidFor(payments);
  const outstanding = Math.max(0, netPremium - paid);
  const cur = placement.currency ?? '';
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-bold text-gray-900">
        {cur} {fmtAmount(paid)}
      </span>
      <span className="text-xs text-gray-400">
        {cur} {fmtAmount(outstanding)} outstanding
      </span>
    </div>
  );
}

function PaymentStatusCell({ placement }: { placement: Facultative }) {
  const { data: payments = [] } = usePlacementPayments(placement.id);
  const netPremium = netPremiumFor(placement);
  const paid = totalPaidFor(payments);

  let paymentStatus: PaymentStatus = 'Outstanding';
  if (netPremium > 0 && paid >= netPremium) paymentStatus = 'Paid';
  else if (paid > 0) paymentStatus = 'Part Payment';

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
    render: (row) => <EndorsedReferencePill id={row.id} reference={row.reference} />,
  },
  {
    key: 'title',
    label: 'Insured / Risk Type',
    width: '1.5fr',
    render: (row) => (
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold text-gray-900 leading-tight">{row.title}</span>
        <span className="text-xs text-gray-400">{row.classOfBusiness ?? '—'}</span>
      </div>
    ),
  },
  {
    key: 'sumInsured',
    label: 'Sum Insured',
    width: '1.1fr',
    render: (row) => (
      <span className="font-small text-gray-900 whitespace-nowrap">
        {row.sumInsured != null ? `${row.currency ?? ''} ${fmtAmount(row.sumInsured)}` : '—'}
      </span>
    ),
  },
  {
    key: 'facultativeOffer',
    label: 'Fac. Sum Insured',
    width: '1.1fr',
    render: (row) => {
      const facSumInsured =
        row.sumInsured != null && row.facultativeOffer != null
          ? row.sumInsured * (row.facultativeOffer / 100)
          : null;
      return (
        <span className="font-small text-gray-900 whitespace-nowrap">
          {facSumInsured != null ? `${row.currency ?? ''} ${fmtAmount(facSumInsured)}` : '—'}
        </span>
      );
    },
  },
  {
    key: 'premium',
    label: 'Est. Net Premium',
    width: '1.1fr',
    render: (row) => {
      const netPremium =
        row.confirmedPlacedPercent != null && row.premium != null ? netPremiumFor(row) : null;
      return (
        <span className="font-medium text-gray-900 whitespace-nowrap">
          {netPremium != null ? `${row.currency ?? ''} ${fmtAmount(netPremium)}` : '—'}
        </span>
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
    key: 'collectedToDate' as keyof Facultative,
    label: 'Est. Paid / Outstanding',
    width: '1.2fr',
    render: (row) => <PaymentSummaryCell placement={row} />,
  },
  {
    key: 'commission',
    label: 'Commission',
    width: '100px',
    render: (row) => (
      <span className="text-gray-700">{row.commission != null ? `${row.commission}%` : '—'}</span>
    ),
  },
  {
    key: 'createdAt',
    label: 'Offer Date',
    width: '1fr',
    render: (row) => <span className="text-gray-600">{fmtDate(row.createdAt)}</span>,
  },
  {
    key: 'status',
    label: 'Status',
    width: '130px',
    className: 'pr-6',
    render: (row) => <PaymentStatusCell placement={row} />,
  },
];

const CLOSING_STATUSES: FacultativeStatus[] = [
  'PARTIALLY_PLACED',
  'PLACED',
  'CLOSING',
  'CLOSED',
  'DECLINED',
  'CANCELLED',
];

export function PaymentsTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [cedantFilter, setCedantFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: allRows = [], isLoading } = usePaymentEligibleFacultatives();

  const closingRows = useMemo(
    () => allRows.filter((r) => CLOSING_STATUSES.includes(r.status)),
    [allRows],
  );

  const paymentQueries = useQueries({
    queries: closingRows.map((row) => ({
      queryKey: ['reinsurance', 'placements', row.id, 'payments'] as const,
      queryFn: async () => {
        const res = await api.get(`/operations/reinsurance/placements/${row.id}/payments`);
        return (res.data?.items ?? res.data ?? []) as PlacementPayment[];
      },
    })),
  });

  const paymentStatusMap = useMemo(() => {
    const map = new Map<string, PaymentStatus>();
    closingRows.forEach((row, i) => {
      const payments = paymentQueries[i]?.data ?? [];
      const netPremium = netPremiumFor(row);
      const paid = totalPaidFor(payments);
      let status: PaymentStatus = 'Outstanding';
      if (netPremium > 0 && paid >= netPremium) status = 'Paid';
      else if (paid > 0) status = 'Part Payment';
      map.set(row.id, status);
    });
    return map;
  }, [closingRows, paymentQueries]);

  const cedantOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of allRows) seen.set(r.cedant.id, r.cedant.name);
    return Array.from(seen.entries())
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allRows]);

  const filtered = useMemo(() => {
    let rows = closingRows;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.reference.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          (r.classOfBusiness?.toLowerCase().includes(q) ?? false),
      );
    }
    if (statusFilter) {
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
    if (cedantFilter) {
      rows = rows.filter((r) => r.cedant.id === cedantFilter);
    }
    return rows;
  }, [closingRows, search, statusFilter, cedantFilter, paymentStatusMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const cedantDropdown = (
    <div>
      <SearchSelect
        size="sm"
        placeholder="Cedants"
        options={cedantOptions}
        value={cedantFilter}
        onChange={(v) => {
          setCedantFilter(v);
          setPage(1);
        }}
      />
    </div>
  );

  return (
    <DataTable
      columns={COLUMNS}
      data={paged}
      isLoading={isLoading}
      searchPlaceholder="Search payments…"
      searchValue={search}
      onRowClick={(row) => router.push(`/${tenantSlug}/operations/reinsurance/payments/${row.id}`)}
      onSearch={(q) => {
        setSearch(q);
        setPage(1);
      }}
      extraFilters={cedantDropdown}
      filterOptions={STATUS_FILTER_OPTIONS}
      onFilter={(v) => {
        setStatusFilter(v);
        setPage(1);
      }}
      actionButton={{
        label: 'Make Payment',
        onClick: () => router.push(`/${tenantSlug}/operations/reinsurance/payments/new`),
      }}
      rowActions={(row) => [
        {
          label: 'Record Payment',
          onClick: () => router.push(`/${tenantSlug}/operations/reinsurance/payments/${row.id}`),
        },
        { label: 'View', onClick: () => {} },
      ]}
      emptyMessage="No payment records found"
      currentPage={page}
      totalPages={totalPages}
      onPageChange={setPage}
      noInternalScroll
    />
  );
}
