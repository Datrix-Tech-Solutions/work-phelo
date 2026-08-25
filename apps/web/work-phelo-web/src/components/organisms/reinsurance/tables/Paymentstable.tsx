'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { useQueries } from '@tanstack/react-query';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { EndorsedReferencePill } from '@/components/atoms/EndorsedReferencePill';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Facultative, FacultativeStatus, toStatusLabel } from '@/types/reinsurance';
import {
  fetchPlacementFinancialPosition,
  fetchPlacementPayments,
  paymentsKey,
  placementFinancialPositionKey,
  useFacultatives,
  usePlacementFinancialPosition,
  usePlacementPayments,
} from '@/hooks';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import AddPaymentForm from '@/components/organisms/reinsurance/AddPaymentForm';
import {
  cedantPaymentStatusFromPosition,
  CedantPaymentStatus as PaymentStatus,
  pendingPremiumReceived,
  latestConfirmedPremiumPaymentDate,
} from '@/lib/reinsurance/placementStatus';

const PAGE_SIZE = 10;

// function fmtDate(iso: string) {
//   if (!iso) return '—';
//   return new Date(iso).toLocaleDateString('en-GB', {
//     day: '2-digit',
//     month: 'short',
//     year: 'numeric',
//   });
// }

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
  CLOSING: 'success',
  CLOSED: 'success',
  DECLINED: 'danger',
  CANCELLED: 'danger',
};

function paymentStatusLabel(status: FacultativeStatus): string {
  if (status === 'CLOSING' || status === 'CLOSED') return 'Closed';
  return toStatusLabel(status);
}

const PAYMENT_STATUS_CLASS: Record<PaymentStatus, string> = {
  Outstanding: 'text-xs text-gray-400',
  Pending: 'text-xs text-amber-600 font-medium',
  'Part Payment': 'text-xs text-yellow-600 font-medium',
  Paid: 'text-xs text-green-600 font-medium',
};

const STATUS_FILTER_OPTIONS = [
  { value: 'Placed', label: 'Placed' },
  { value: 'Closed', label: 'Closed' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Part Payment', label: 'Part Payment' },
  { value: 'Paid', label: 'Paid' },
];

function PaymentSummaryCell({ placement }: { placement: Facultative }) {
  const { data: position } = usePlacementFinancialPosition(placement.id);
  const paid = position?.cedant.netSettled ?? 0;
  const outstanding = position?.cedant.outstanding ?? 0;
  const cur = position?.currency ?? placement.currency ?? '';
  const outstandingLabel =
    position?.cedant.position === 'CREDIT_BALANCE' || outstanding < 0 ? 'credit' : 'outstanding';
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-bold text-gray-900">
        {cur} {fmtAmount(paid)}
      </span>
      <span className="text-xs text-gray-400">
        {cur} {fmtAmount(Math.abs(outstanding))} {outstandingLabel}
      </span>
    </div>
  );
}

function PaymentStatusCell({ placement }: { placement: Facultative }) {
  const { data: position } = usePlacementFinancialPosition(placement.id);
  const { data: payments = [] } = usePlacementPayments(placement.id);
  const due = position?.cedant.currentObligation ?? 0;
  const paid = position?.cedant.netSettled ?? 0;
  const outstanding = position?.cedant.outstanding ?? 0;
  const pending = pendingPremiumReceived(payments);

  const paymentStatus = cedantPaymentStatusFromPosition(due, paid, outstanding, pending);

  return (
    <div className="flex flex-col gap-1 items-start">
      <Badge
        label={paymentStatusLabel(placement.status)}
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
    width: '150px',
    render: (row) => (
      <EndorsedReferencePill id={row.id} reference={displayPolicyNumber(row.policyNumber)} />
    ),
  },
  {
    key: 'title',
    label: 'Insured / Risk Type',
    width: 'minmax(120px, 1fr)',
    render: (row) => (
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold text-gray-900 leading-tight">{row.title}</span>
        <span className="text-xs text-gray-400">{row.classOfBusiness ?? '—'}</span>
      </div>
    ),
  },
  {
    key: 'cedant' as keyof Facultative,
    label: 'Cedant',
    width: 'minmax(100px, 1fr)',
    render: (row) => <span className="text-gray-700">{row.cedant.name}</span>,
  },
  {
    key: 'sumInsured',
    label: 'Sum Insured',
    width: '130px',
    className: 'text-right',
    render: (row) => (
      <span className="font-small text-gray-900 whitespace-nowrap">
        {row.sumInsured != null ? `${row.currency ?? ''} ${fmtAmount(row.sumInsured)}` : '—'}
      </span>
    ),
  },
  {
    key: 'facultativeOffer',
    label: 'Share of S.I.',
    width: '130px',
    className: 'text-right',
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
    key: 'participants' as keyof Facultative,
    label: 'Participants',
    width: '90px',
    render: (row) => {
      // const total = row.participants?.length ?? 0;
      const accepted =
        row.participants?.filter((p) => p.status === 'ACCEPTED' || p.status === 'CLOSED').length ??
        0;
      return (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-gray-900">{accepted}</span>
          <span className="text-xs text-gray-400">accepted</span>
        </div>
      );
    },
  },
  {
    key: 'collectedToDate' as keyof Facultative,
    label: 'Paid / Outstanding',
    width: '150px',
    render: (row) => <PaymentSummaryCell placement={row} />,
  },
  {
    key: 'commission',
    label: 'Commission',
    width: '90px',
    render: (row) => (
      <span className="text-gray-700">{row.commission != null ? `${row.commission}%` : '—'}</span>
    ),
  },
  // {
  //   key: 'createdAt',
  //   label: 'Offer Date',
  //   width: '100px',
  //   render: (row) => <span className="text-gray-600">{fmtDate(row.createdAt)}</span>,
  // },
  {
    key: 'status',
    label: 'Status',
    width: '100px',
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
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);

  const { data: allRows = [], isLoading } = useFacultatives();

  const closingRows = useMemo(
    () => allRows.filter((r) => CLOSING_STATUSES.includes(r.status)),
    [allRows],
  );

  const positionQueries = useQueries({
    queries: closingRows.map((row) => ({
      queryKey: placementFinancialPositionKey(row.id),
      queryFn: () => fetchPlacementFinancialPosition(row.id),
    })),
  });

  const paymentsQueries = useQueries({
    queries: closingRows.map((row) => ({
      queryKey: paymentsKey(row.id),
      queryFn: () => fetchPlacementPayments(row.id),
    })),
  });

  const paymentStatusMap = useMemo(() => {
    const map = new Map<string, PaymentStatus>();
    closingRows.forEach((row, i) => {
      const position = positionQueries[i]?.data;
      const payments = paymentsQueries[i]?.data ?? [];
      const due = position?.cedant.currentObligation ?? 0;
      const paid = position?.cedant.netSettled ?? 0;
      const outstanding = position?.cedant.outstanding ?? 0;
      const pending = pendingPremiumReceived(payments);
      map.set(row.id, cedantPaymentStatusFromPosition(due, paid, outstanding, pending));
    });
    return map;
  }, [closingRows, positionQueries, paymentsQueries]);

  const payableRows = useMemo(
    () => closingRows.filter((r) => paymentStatusMap.get(r.id) !== 'Outstanding'),
    [closingRows, paymentStatusMap],
  );

  const latestPaymentDateMap = useMemo(() => {
    const map = new Map<string, string | null>();
    closingRows.forEach((row, i) => {
      const payments = paymentsQueries[i]?.data ?? [];
      map.set(row.id, latestConfirmedPremiumPaymentDate(payments));
    });
    return map;
  }, [closingRows, paymentsQueries]);

  const cedantOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of payableRows) seen.set(r.cedant.id, r.cedant.name);
    return Array.from(seen.entries())
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [payableRows]);

  const filtered = useMemo(() => {
    let rows = payableRows;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.policyNumber?.toLowerCase().includes(q) ?? false) ||
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

    const dateOf = (r: Facultative) => latestPaymentDateMap.get(r.id) ?? r.createdAt;
    return [...rows].sort((a, b) => new Date(dateOf(b)).getTime() - new Date(dateOf(a)).getTime());
  }, [payableRows, search, statusFilter, cedantFilter, paymentStatusMap, latestPaymentDateMap]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const extraFilters = (
    <>
      <div>
        <SearchSelect
          size="sm"
          placeholder="Status"
          options={STATUS_FILTER_OPTIONS}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        />
      </div>
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
    </>
  );

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search payments…"
        searchValue={search}
        onRowClick={(row) =>
          router.push(`/${tenantSlug}/operations/reinsurance/payments/${row.id}`)
        }
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        extraFilters={extraFilters}
        actionButton={{
          label: 'Receive Cedant Premium',
          onClick: () => setIsAddPaymentOpen(true),
        }}
        // rowActions={(row) => [
        //   {
        //     label: 'View Payment Workspace',
        //     onClick: () => router.push(`/${tenantSlug}/operations/reinsurance/payments/${row.id}`),
        //   },
        // ]}
        emptyMessage="No payment records found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <AddPaymentForm isOpen={isAddPaymentOpen} onClose={() => setIsAddPaymentOpen(false)} />
    </>
  );
}
