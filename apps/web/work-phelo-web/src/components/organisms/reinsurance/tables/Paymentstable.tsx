'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataTable, Column, RowAction } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { EndorsedReferencePill } from '@/components/atoms/EndorsedReferencePill';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  FacultativeStatus,
  PaymentWorklistRow,
  PaymentWorklistStatusFilter,
  toStatusLabel,
} from '@/types/reinsurance';
import { useCedants, usePaymentsWorklist } from '@/hooks';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import AddPaymentForm from '@/components/organisms/reinsurance/AddPaymentForm';

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

const PAYMENT_STATUS_CLASS: Record<PaymentWorklistRow['paymentStatus'], string> = {
  Pending: 'text-xs text-amber-600 font-medium',
  'Part Payment': 'text-xs text-yellow-600 font-medium',
  Paid: 'text-xs text-green-600 font-medium',
};

// const STATUS_FILTER_OPTIONS = [
//   { value: 'Placed', label: 'Placed' },
//   { value: 'Closed', label: 'Closed' },
//   { value: 'Pending', label: 'Pending' },
//   { value: 'Part Payment', label: 'Part Payment' },
//   { value: 'Paid', label: 'Paid' },
// ];

function PaymentSummaryCell({ row }: { row: PaymentWorklistRow }) {
  const cur = row.currency ?? '';
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-bold text-gray-900">
        {cur} {fmtAmount(row.paidAmount)}
      </span>
      <span className="text-xs text-gray-400">
        {cur} {fmtAmount(Math.abs(row.outstandingAmount))} {row.outstandingLabel}
      </span>
    </div>
  );
}

function PaymentStatusCell({ row }: { row: PaymentWorklistRow }) {
  return (
    <div className="flex flex-col gap-1 items-start">
      <Badge
        label={paymentStatusLabel(row.placementStatus)}
        variant={RAW_STATUS_VARIANT_MAP[row.placementStatus]}
      />
      <span className={PAYMENT_STATUS_CLASS[row.paymentStatus]}>{row.paymentStatus}</span>
    </div>
  );
}

const COLUMNS: Column<PaymentWorklistRow>[] = [
  {
    key: 'reference',
    label: 'Policy Number',
    width: '150px',
    render: (row) => (
      <EndorsedReferencePill
        id={row.placementId}
        reference={displayPolicyNumber(row.policyNumber)}
      />
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
    key: 'cedant',
    label: 'Cedant',
    width: 'minmax(100px, 1fr)',
    render: (row) => <span className="text-gray-700">{row.cedantName}</span>,
  },
  {
    key: 'sumInsured',
    label: '100% Sum Insured',
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
    render: (row) => (
      <div className="flex flex-col gap-0.5 items-end">
        <span className="font-small text-gray-900 whitespace-nowrap">
          {row.facultativeSumInsured != null
            ? `${row.currency ?? ''} ${fmtAmount(row.facultativeSumInsured)}`
            : '—'}
        </span>
        <span className="text-xs text-gray-400">
          {row.facultativeOffer != null ? `${row.facultativeOffer}% share` : '—'}
        </span>
      </div>
    ),
  },
  // {
  //   key: 'participants',
  //   label: 'Participants',
  //   width: '90px',
  //   render: (row) => (
  //     <div className="flex flex-col gap-0.5">
  //       <span className="font-semibold text-gray-900">{row.acceptedParticipantCount}</span>
  //       <span className="text-xs text-gray-400">accepted</span>
  //     </div>
  //   ),
  // },
  {
    key: 'collectedToDate',
    label: 'Paid / Outstanding',
    width: '150px',
    render: (row) => <PaymentSummaryCell row={row} />,
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
    render: (row) => <PaymentStatusCell row={row} />,
  },
];

export function PaymentsTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [statusFilter] = useState<PaymentWorklistStatusFilter | ''>('');
  const [cedantFilter, setCedantFilter] = useState('');
  const [page, setPage] = useState(1);
  const [isAddPaymentOpen, setIsAddPaymentOpen] = useState(false);
  const [addPaymentPlacementId, setAddPaymentPlacementId] = useState<string | undefined>(undefined);

  const openAddPayment = (row?: PaymentWorklistRow) => {
    setAddPaymentPlacementId(row?.id);
    setIsAddPaymentOpen(true);
  };

  const {
    data: worklist,
    isLoading,
    isError,
  } = usePaymentsWorklist({
    page,
    limit: PAGE_SIZE,
    search,
    status: statusFilter,
    cedantId: cedantFilter,
  });
  const { data: cedants = [] } = useCedants();

  const cedantOptions = useMemo(() => {
    return cedants
      .map((cedant) => ({ value: cedant.id, label: cedant.name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [cedants]);

  const paged = worklist?.items ?? [];
  const totalPages = Math.max(1, worklist?.meta.totalPages ?? 1);

  const getRowActions = (row: PaymentWorklistRow): RowAction[] => {
    const viewOffer: RowAction = {
      label: 'View Offer',
      onClick: () =>
        router.push(`/${tenantSlug}/operations/reinsurance/facultative/${row.placementId}`),
    };
    const disbursePayment: RowAction = {
      label: 'Disburse Payment',
      onClick: () => router.push(`/${tenantSlug}/operations/reinsurance/payments/${row.id}`),
    };

    switch (row.paymentStatus) {
      case 'Paid':
        return [viewOffer, disbursePayment];
      case 'Part Payment':
        return [
          viewOffer,
          { label: 'Make Payment', onClick: () => openAddPayment(row) },
          disbursePayment,
        ];
      default:
        return [viewOffer];
    }
  };

  const extraFilters = (
    <>
      <div className="w-78">
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
      {/* <div className="w-40">
        <SearchSelect
          size="sm"
          placeholder="Status"
          options={STATUS_FILTER_OPTIONS}
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v as PaymentWorklistStatusFilter | '');
            setPage(1);
          }}
        />
      </div> */}
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
        searchAfterFilters
        actionButton={{
          label: 'Receive Cedant Premium',
          onClick: () => openAddPayment(),
        }}
        rowActions={getRowActions}
        singleActionAsButton={false}
        emptyMessage={isError ? 'Unable to load payment records' : 'No payment records found'}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <AddPaymentForm
        isOpen={isAddPaymentOpen}
        onClose={() => {
          setIsAddPaymentOpen(false);
          setAddPaymentPlacementId(undefined);
        }}
        placementId={addPaymentPlacementId}
        defaultCedantId={cedantFilter || undefined}
      />
    </>
  );
}
