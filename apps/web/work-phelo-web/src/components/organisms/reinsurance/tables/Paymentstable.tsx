'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  Facultative,
  PlacementDisplayStatus,
  PLACEMENT_DISPLAY_STATUSES,
  toDisplayStatus,
} from '@/types/reinsurance';
import { useFacultatives, usePlacementLockStatus, usePlacementPayments } from '@/hooks';

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

function netPremium(row: Facultative): number {
  const facPremium =
    row.premium != null && row.facultativeOffer != null
      ? (row.facultativeOffer / 100) * row.premium
      : 0;
  return facPremium * (1 - (row.commission ?? 0) / 100);
}

function usePlacementPaymentSummary(row: Facultative) {
  const { data: payments = [] } = usePlacementPayments(row.id);
  const { data: lockStatus } = usePlacementLockStatus(row.id);
  const paid = payments
    .filter((payment) => payment.type === 'PREMIUM_RECEIVED' && payment.status === 'RECORDED')
    .reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);
  const expected = netPremium(row);

  return {
    paid,
    outstanding: Math.max(0, expected - paid),
    locked: lockStatus?.locked ?? row.lockStatus?.locked ?? paid > 0,
  };
}

function PaidAmountCell({ row }: { row: Facultative }) {
  const { paid } = usePlacementPaymentSummary(row);
  return (
    <span className={paid > 0 ? 'font-medium text-gray-900' : 'text-gray-400'}>
      {row.currency ? `${row.currency} ` : ''}
      {fmtAmount(paid)}
    </span>
  );
}

function OutstandingAmountCell({ row }: { row: Facultative }) {
  const { outstanding } = usePlacementPaymentSummary(row);
  return (
    <span className={outstanding > 0 ? 'text-gray-700' : 'font-medium text-green-700'}>
      {row.currency ? `${row.currency} ` : ''}
      {fmtAmount(outstanding)}
    </span>
  );
}

function PaymentStatusCell({ row }: { row: Facultative }) {
  const { paid, outstanding, locked } = usePlacementPaymentSummary(row);
  if (paid <= 0) return <Badge label="Pending" variant="neutral" />;
  if (outstanding <= 0.01) return <Badge label="Paid" variant="success" />;
  return <Badge label={locked ? 'Part Paid / Locked' : 'Part Paid'} variant="warning" />;
}

const OFFER_STATUS_VARIANT_MAP: Record<
  PlacementDisplayStatus,
  'success' | 'warning' | 'neutral' | 'danger'
> = {
  Open: 'warning',
  Closed: 'success',
  Cancelled: 'danger',
};

const STATUS_FILTER_OPTIONS = PLACEMENT_DISPLAY_STATUSES.map((s) => ({ value: s, label: s }));

const COLUMNS: Column<Facultative>[] = [
  {
    key: 'reference',
    label: 'Policy Number',
    width: '1.1fr',
    render: (row) => <span className="font-medium text-gray-900">{row.reference}</span>,
  },
  {
    key: 'classOfBusiness',
    label: 'Risk Type',
    width: '1fr',
    render: (row) => <span className="text-gray-600">{row.classOfBusiness ?? '—'}</span>,
  },
  {
    key: 'title',
    label: 'Insured',
    width: '1.3fr',
    render: (row) => <span className="text-gray-700">{row.title}</span>,
  },
  {
    key: 'sumInsured',
    label: 'Sum Insured',
    width: '1fr',
    render: (row) => <span className="text-gray-700">{fmtAmount(row.sumInsured)}</span>,
  },
  {
    key: 'facultativeOffer',
    label: 'Fac. Sum Insured',
    width: '1fr',
    render: (row) => {
      const facSumInsured =
        row.sumInsured != null && row.facultativeOffer != null
          ? row.sumInsured * (row.facultativeOffer / 100)
          : null;
      return <span className="text-gray-700">{fmtAmount(facSumInsured)}</span>;
    },
  },
  {
    key: 'premium',
    label: 'Premium',
    width: '1fr',
    render: (row) => {
      const facPremium =
        row.premium != null && row.facultativeOffer != null
          ? (row.facultativeOffer / 100) * row.premium
          : null;
      const netPremium =
        facPremium != null && row.commission != null
          ? facPremium * (1 - row.commission / 100)
          : facPremium;
      return <span className="text-gray-700">{fmtAmount(netPremium)}</span>;
    },
  },
  {
    key: 'collectedToDate' as keyof Facultative,
    label: 'Amount paid',
    width: '1fr',
    render: (row) => <PaidAmountCell row={row} />,
  },
  {
    key: 'outstanding' as keyof Facultative,
    label: 'Outstanding',
    width: '1fr',
    render: (row) => <OutstandingAmountCell row={row} />,
  },
  {
    key: 'commission',
    label: 'Commission',
    width: '1fr',
    render: (row) => <span className="text-gray-700">{fmtAmount(row.commission)}</span>,
  },
  {
    key: 'status',
    label: 'Offer Status',
    width: '110px',
    render: (row) => {
      const display = toDisplayStatus(row.status);
      return <Badge label={display} variant={OFFER_STATUS_VARIANT_MAP[display]} />;
    },
  },
  {
    key: 'paymentStatus' as keyof Facultative,
    label: 'Payment Status',
    width: '120px',
    render: (row) => <PaymentStatusCell row={row} />,
  },
  {
    key: 'createdAt',
    label: 'Offer Date',
    width: '1fr',
    render: (row) => <span className="text-gray-600">{fmtDate(row.createdAt)}</span>,
  },
];

export function PaymentsTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [cedantFilter, setCedantFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: allRows = [], isLoading } = useFacultatives();

  const cedantOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of allRows) seen.set(r.cedant.id, r.cedant.name);
    return Array.from(seen.entries())
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [allRows]);

  const filtered = useMemo(() => {
    let rows = allRows;
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
      rows = rows.filter(
        (r) => toDisplayStatus(r.status) === (statusFilter as PlacementDisplayStatus),
      );
    }
    if (cedantFilter) {
      rows = rows.filter((r) => r.cedant.id === cedantFilter);
    }
    return rows;
  }, [allRows, search, statusFilter, cedantFilter]);

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
