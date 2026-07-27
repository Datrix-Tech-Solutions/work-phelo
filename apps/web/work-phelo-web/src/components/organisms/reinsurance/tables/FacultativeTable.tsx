'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DataTable, Column, RowAction } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { EndorsedReferencePill } from '@/components/atoms/EndorsedReferencePill';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Modal } from '@/components/organisms/shared/Modal';
import { CreateFacultativePanel } from '@/components/organisms/reinsurance/panels/CreateFacultativePanel';
import { EditFacultativePanel } from '@/components/organisms/reinsurance/panels/EditFacultativePanel';
import { PartialEditFacultativePanel } from '@/components/organisms/reinsurance/panels/PartialEditFacultativePanel';
import { RenewFacultativePanel } from '@/components/organisms/reinsurance/panels/RenewFacultativePanel';
import { Facultative, PlacementPayment } from '@/types/reinsurance';
import {
  useArchivedFacultatives,
  useCedants,
  useDeleteFacultative,
  useFacultatives,
  useForceCloseFacultative,
  usePlacementPayments,
  useRestoreFacultative,
  useCurrentTenantUsers,
} from '@/hooks';
import { TenantUser } from '@/types/tenant';
import { isForeignCedant, FOREIGN_CEDANT_DEDUCTION_RATE } from '@/lib/reinsuranceTax';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import {
  acceptedPercentFor,
  facultativeStatusLabel,
  isEffectivelyClosed,
  RAW_STATUS_VARIANT_MAP,
} from '@/lib/reinsurance/placementStatus';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

const PAGE_SIZE = 10;

function displayUserName(user: Pick<TenantUser, 'firstName' | 'lastName' | 'email'>): string {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fullName || user.email || 'Unknown user';
}

function fmtAmount(val: number) {
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDateTime(value: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
const CLOSING_PAYMENT_FILTER_OPTIONS = [
  { value: 'Outstanding', label: 'Outstanding' },
  { value: 'Part Payment', label: 'Part Payment' },
  { value: 'Paid', label: 'Paid' },
];

const PLACEMENTS_FILTER_OPTIONS = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'MARKETING', label: 'On Market' },
  { value: 'PARTIALLY_PLACED', label: 'Partially Placed' },
  // { value: 'PLACED', label: 'Placed' },
  { value: 'CLOSING', label: 'Partially Closed' },
  ...CLOSING_PAYMENT_FILTER_OPTIONS,
];

const CLOSING_STATUS_FILTER_OPTIONS = [
  { value: 'PLACED', label: 'Placed' },
  { value: 'CLOSING', label: 'Partially Closed' },
  { value: 'CLOSED', label: 'Closed' },
  { value: 'DECLINED', label: 'Declined' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

const CLOSING_FILTER_OPTIONS = [
  // ...CLOSING_STATUS_FILTER_OPTIONS,
  ...CLOSING_PAYMENT_FILTER_OPTIONS,
];

type PaymentStatus = 'Outstanding' | 'Part Payment' | 'Paid';

const PAYMENT_STATUS_CLASS: Record<PaymentStatus, string> = {
  Outstanding: 'text-[10px] text-gray-400',
  'Part Payment': 'text-[10px] text-yellow-600 font-medium',
  Paid: 'text-[10px] text-green-600 font-medium',
};

function netPremiumFor(row: Facultative, deductionRate: number): number {
  const facPremium =
    row.premium != null && row.facultativeOffer != null
      ? (row.facultativeOffer / 100) * row.premium
      : 0;
  const netPremium = row.commission != null ? facPremium * (1 - row.commission / 100) : facPremium;
  return netPremium - facPremium * deductionRate;
}

function useDeductionRateFor(cedantId: string): number {
  const { data: cedants = [] } = useCedants();
  return isForeignCedant(cedants.find((c) => c.id === cedantId))
    ? FOREIGN_CEDANT_DEDUCTION_RATE
    : 0;
}

function PaymentStatusCell({ placement }: { placement: Facultative }) {
  const { data: payments = [] } = usePlacementPayments(placement.id);
  const deductionRate = useDeductionRateFor(placement.cedant.id);
  const netPremium = netPremiumFor(placement, deductionRate);
  const paid = payments
    .filter((p) => p.status === 'RECORDED')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);

  let paymentStatus: PaymentStatus = 'Outstanding';
  if (netPremium > 0 && paid >= netPremium) paymentStatus = 'Paid';
  else if (paid > 0) paymentStatus = 'Part Payment';

  return (
    <div className="flex flex-col gap-1">
      <Badge
        label={facultativeStatusLabel(placement.status)}
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
    width: 'minmax(120px, 0.8fr)',
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
    width: 'minmax(120px, 0.8fr)',
    render: (row) => <span className="text-gray-700">{row.cedant.name}</span>,
  },
  {
    key: 'facultativeOffer',
    label: 'Fac Offer',
    width: '70px',
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
    width: '100px',
    render: (row) => (
      <span className="font-semibold text-gray-900">
        {row.premium != null ? `${row.currency ?? ''} ${fmtAmount(row.premium)}` : '—'}
      </span>
    ),
  },
  {
    key: 'totalAcceptedPercent',
    label: 'Signing Progress',
    width: '140px',
    className: 'pr-6',
    render: (row) => {
      const facOffer = row.facultativeOffer ?? 0;
      const closedPercent = acceptedPercentFor(row);
      const barWidth = facOffer > 0 ? Math.min(100, (closedPercent / facOffer) * 100) : 0;
      return (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-gray-700">{closedPercent.toFixed(1)}%</span>
            <span className="text-gray-400">{barWidth.toFixed(0)}% Closed</span>
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
    width: '90px',
    render: (row) => {
      const total = row.participants?.length ?? 0;
      const closed =
        row.participants?.filter((p) => p.status === 'ACCEPTED' || p.status === 'CLOSED').length ??
        0;
      return (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-gray-900">
            {closed} / {total}
          </span>
          <span className="text-xs text-gray-400">Accepted</span>
        </div>
      );
    },
  },
  {
    key: 'status',
    label: 'Status',
    width: '100px',
    render: (row) => <PaymentStatusCell placement={row} />,
  },
];

const SUM_INSURED_COLUMN: Column<Facultative> = {
  key: 'sumInsured',
  label: '100% Sum Insured',
  width: '150px',
  className: 'pr-6',
  render: (row) => (
    <span className="font-semibold text-gray-900">
      {row.sumInsured != null ? `${row.currency ?? ''} ${fmtAmount(row.sumInsured)}` : '—'}
    </span>
  ),
};

export function FacultativeTable({
  tab = 'placements',
}: {
  tab?: 'placements' | 'closing' | 'archived';
}) {
  const toast = useToast();
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Facultative | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Facultative | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Facultative | null>(null);
  const [reopenTarget, setReopenTarget] = useState<Facultative | null>(null);
  const [partialEditTarget, setPartialEditTarget] = useState<Facultative | null>(null);
  const [renewTarget, setRenewTarget] = useState<Facultative | null>(null);
  const [archiveReason, setArchiveReason] = useState('');
  const [forceCloseTarget, setForceCloseTarget] = useState<Facultative | null>(null);

  const { data: activeRows = [], isLoading: loadingActive } = useFacultatives();
  const { data: archivedRows = [], isLoading: loadingArchived } = useArchivedFacultatives({
    enabled: tab === 'archived',
  });
  const { data: tenantUsers = [] } = useCurrentTenantUsers({ enabled: tab === 'archived' });
  const { data: cedants = [] } = useCedants();
  const { mutate: archivePlacement, isPending: isArchiving } = useDeleteFacultative();
  const { mutate: restorePlacement, isPending: isRestoring } = useRestoreFacultative();
  const { mutate: forceClosePlacement, isPending: isForceClosing } = useForceCloseFacultative(
    forceCloseTarget?.id ?? '',
  );

  const allRows = tab === 'archived' ? archivedRows : activeRows;
  const isLoading = tab === 'archived' ? loadingArchived : loadingActive;

  const closingRows = useMemo(() => allRows.filter(isEffectivelyClosed), [allRows]);

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
      const deductionRate = isForeignCedant(cedants.find((c) => c.id === row.cedant.id))
        ? FOREIGN_CEDANT_DEDUCTION_RATE
        : 0;
      const netPremium = netPremiumFor(row, deductionRate);
      const paid = payments
        .filter((p) => p.status === 'RECORDED')
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);
      let status: PaymentStatus = 'Outstanding';
      if (netPremium > 0 && paid >= netPremium) status = 'Paid';
      else if (paid > 0) status = 'Part Payment';
      map.set(row.id, status);
    });
    return map;
  }, [closingRows, paymentQueries, cedants]);

  const filtered = useMemo(() => {
    let rows = allRows;
    if (tab !== 'archived') {
      rows = rows.filter((r) =>
        tab === 'closing' ? isEffectivelyClosed(r) : !isEffectivelyClosed(r),
      );
    }
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.policyNumber?.toLowerCase().includes(q) ?? false) ||
          r.cedant.name.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          (r.classOfBusiness?.toLowerCase().includes(q) ?? false),
      );
    }
    if (statusFilter && tab !== 'archived') {
      if (tab === 'placements') {
        rows = rows.filter((r) => r.status === statusFilter);
      } else {
        const isStatusFilter = CLOSING_STATUS_FILTER_OPTIONS.some(
          (opt) => opt.value === statusFilter,
        );
        rows = isStatusFilter
          ? rows.filter((r) => r.status === statusFilter)
          : rows.filter((r) => paymentStatusMap.get(r.id) === (statusFilter as PaymentStatus));
      }
    }
    // Open tab filters by when the offer was created; Closing tab by when it was closed.
    const dateField: 'createdAt' | 'updatedAt' = tab === 'closing' ? 'updatedAt' : 'createdAt';
    if (dateFrom) {
      const from = new Date(dateFrom);
      rows = rows.filter((r) => new Date(r[dateField]) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      rows = rows.filter((r) => new Date(r[dateField]) <= to);
    }
    return rows;
  }, [allRows, search, statusFilter, dateFrom, dateTo, tab, paymentStatusMap]);

  // Closing tab: most recently closed first — CLOSED/CLOSING placements are effectively
  // frozen once they land there, so updatedAt reliably marks the close moment.
  const sorted = useMemo(() => {
    if (tab !== 'closing') return filtered;
    return [...filtered].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [filtered, tab]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paged = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Placements tab: only the current page needs a paid/unpaid check, just to swap
  // Edit Offer for Partial Edit once a payment exists — no filtering depends on this.
  const openPaymentQueries = useQueries({
    queries:
      tab === 'placements'
        ? paged.map((row) => ({
            queryKey: ['reinsurance', 'placements', row.id, 'payments'] as const,
            queryFn: async () => {
              const res = await api.get(`/operations/reinsurance/placements/${row.id}/payments`);
              return (res.data?.items ?? res.data ?? []) as PlacementPayment[];
            },
          }))
        : [],
  });

  const hasPaymentMap = useMemo(() => {
    const map = new Map<string, boolean>();
    if (tab !== 'placements') return map;
    paged.forEach((row, i) => {
      const payments = openPaymentQueries[i]?.data ?? [];
      map.set(
        row.id,
        payments.some((p) => p.status === 'RECORDED'),
      );
    });
    return map;
  }, [paged, openPaymentQueries, tab]);

  const openPaymentStatusMap = useMemo(() => {
    const map = new Map<string, PaymentStatus>();
    if (tab !== 'placements') return map;
    paged.forEach((row, i) => {
      const payments = openPaymentQueries[i]?.data ?? [];
      const deductionRate = isForeignCedant(cedants.find((c) => c.id === row.cedant.id))
        ? FOREIGN_CEDANT_DEDUCTION_RATE
        : 0;
      const netPremium = netPremiumFor(row, deductionRate);
      const paid = payments
        .filter((p) => p.status === 'RECORDED')
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);
      let status: PaymentStatus = 'Outstanding';
      if (netPremium > 0 && paid >= netPremium) status = 'Paid';
      else if (paid > 0) status = 'Part Payment';
      map.set(row.id, status);
    });
    return map;
  }, [paged, openPaymentQueries, tab, cedants]);

  const columns = useMemo<Column<Facultative>[]>(() => {
    const userNameById = new Map(
      (Array.isArray(tenantUsers) ? (tenantUsers as TenantUser[]) : []).map((user) => [
        user.id,
        displayUserName(user),
      ]),
    );
    const actorName = (userId: string | null) =>
      userId ? (userNameById.get(userId) ?? 'Unknown user') : 'Unknown user';

    if (tab === 'closing') {
      return COLUMNS.map((col) => (col.key === 'totalAcceptedPercent' ? SUM_INSURED_COLUMN : col));
    }

    if (tab !== 'archived') return COLUMNS;

    const ARCHIVED_HIDDEN_KEYS = new Set(['totalAcceptedPercent', 'participants', 'status']);

    return [
      ...COLUMNS.filter((col) => !ARCHIVED_HIDDEN_KEYS.has(col.key as string)),
      {
        key: 'archivedAt',
        label: 'Archive Details',
        width: '220px',
        render: (row) => (
          <div className="flex flex-col gap-1">
            <Badge label="Archived" variant="neutral" />
            <span className="text-xs text-gray-500">{fmtDateTime(row.archivedAt)}</span>
            {row.archivedByUserId && (
              <span className="text-xs text-gray-400" title={row.archivedByUserId}>
                Archived by: {actorName(row.archivedByUserId)}
              </span>
            )}
            {row.archiveReason && (
              <span className="text-xs text-gray-500 line-clamp-2">{row.archiveReason}</span>
            )}
          </div>
        ),
      },
    ];
  }, [tab, tenantUsers]);

  const closeArchiveModal = () => {
    setArchiveTarget(null);
    setArchiveReason('');
  };

  const handleArchive = () => {
    if (!archiveTarget) return;
    archivePlacement(
      {
        id: archiveTarget.id,
        archiveReason: archiveReason.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Placement archived successfully');
          closeArchiveModal();
        },
        onError: (err) => toast.error(extractError(err, 'Failed to archive placement')),
      },
    );
  };

  const handleRestore = () => {
    if (!restoreTarget) return;
    restorePlacement(restoreTarget.id, {
      onSuccess: () => {
        toast.success('Placement restored successfully');
        setRestoreTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to restore placement')),
    });
  };

  const handleForceClose = () => {
    if (!forceCloseTarget) return;
    forceClosePlacement(undefined, {
      onSuccess: () => {
        toast.success('Placement force closed successfully');
        setForceCloseTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to force close placement')),
    });
  };

  const getRowActions = (row: Facultative): RowAction[] => {
    if (tab === 'archived') {
      return [{ label: 'Restore', onClick: () => setRestoreTarget(row) }];
    }

    const detailUrl = `/${tenantSlug}/operations/reinsurance/facultative/${row.id}${
      tab === 'closing' ? '?from=closing' : ''
    }`;

    const renewAction: RowAction = {
      label: 'Renew Offer',
      onClick: () => setRenewTarget(row),
      variant: 'success',
    };

    if (tab === 'closing' && row.status !== 'DECLINED' && row.status !== 'CANCELLED') {
      const paymentStatus = paymentStatusMap.get(row.id) ?? 'Outstanding';
      const partialEditAction: RowAction = {
        label: 'Partial Edit',
        onClick: () => setPartialEditTarget(row),
      };

      if (paymentStatus === 'Paid' || paymentStatus === 'Part Payment') {
        return [
          { label: 'View Offer', onClick: () => router.push(detailUrl) },
          partialEditAction,
          renewAction,
        ];
      }

      return [
        { label: 'View Offer Details', onClick: () => router.push(detailUrl) },
        { label: 'Reopen Offer', onClick: () => setReopenTarget(row) },
        partialEditAction,
        { label: 'Archive', onClick: () => setArchiveTarget(row), danger: true },
        renewAction,
      ];
    }

    if (tab === 'placements') {
      const paymentStatus = openPaymentStatusMap.get(row.id) ?? 'Outstanding';
      const canArchive = paymentStatus === 'Outstanding';
      const forceCloseAction: RowAction | null =
        row.status === 'CLOSING'
          ? { label: 'Force Close', onClick: () => setForceCloseTarget(row), danger: true }
          : null;
      const archiveAction: RowAction | null = canArchive
        ? { label: 'Archive', onClick: () => setArchiveTarget(row), danger: true }
        : null;
      const editAction: RowAction = hasPaymentMap.get(row.id)
        ? { label: 'Partial Edit', onClick: () => setPartialEditTarget(row) }
        : { label: 'Edit Offer', onClick: () => setEditTarget(row) };

      return [
        { label: 'View Offer', onClick: () => router.push(detailUrl) },
        editAction,
        ...(forceCloseAction ? [forceCloseAction] : []),
        ...(archiveAction ? [archiveAction] : []),
        renewAction,
      ];
    }

    const fallbackPaymentStatus = paymentStatusMap.get(row.id) ?? 'Outstanding';
    const canArchiveFallback = fallbackPaymentStatus === 'Outstanding';

    return [
      { label: 'View', onClick: () => router.push(detailUrl) },
      { label: 'Edit Slip', onClick: () => setEditTarget(row) },
      ...(canArchiveFallback
        ? [{ label: 'Archive', onClick: () => setArchiveTarget(row), danger: true }]
        : []),
      renewAction,
    ];
  };

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search facultative…"
        searchValue={search}
        onRowClick={
          tab === 'archived'
            ? undefined
            : (row) =>
                router.push(
                  `/${tenantSlug}/operations/reinsurance/facultative/${row.id}${tab === 'closing' ? '?from=closing' : ''}`,
                )
        }
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        extraFilters={
          (tab === 'placements' || tab === 'closing') && (
            <div className="flex items-center gap-2">
              <SearchSelect
                size="sm"
                placeholder="Status"
                options={tab === 'placements' ? PLACEMENTS_FILTER_OPTIONS : CLOSING_FILTER_OPTIONS}
                value={statusFilter}
                onChange={(v) => {
                  setStatusFilter(v);
                  setPage(1);
                }}
              />
              <div className="w-50">
                <DatePicker
                  size="sm"
                  placeholder={tab === 'closing' ? 'Closed from' : 'Created from'}
                  value={dateFrom}
                  onChange={(v) => {
                    setDateFrom(v);
                    setPage(1);
                  }}
                />
              </div>
              <div className="w-50">
                <DatePicker
                  size="sm"
                  placeholder={tab === 'closing' ? 'Closed to' : 'Created to'}
                  value={dateTo}
                  minDate={dateFrom || undefined}
                  onChange={(v) => {
                    setDateTo(v);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          )
        }
        actionButton={
          tab === 'placements'
            ? { label: 'New Offer', onClick: () => setPanelOpen(true) }
            : undefined
        }
        rowActions={getRowActions}
        emptyMessage={
          tab === 'archived'
            ? 'No archived facultative placements found'
            : 'No facultative placements found'
        }
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

      {reopenTarget && (
        <EditFacultativePanel
          isOpen={!!reopenTarget}
          placement={reopenTarget}
          onClose={() => setReopenTarget(null)}
          mode="reopen"
        />
      )}

      {partialEditTarget && (
        <PartialEditFacultativePanel
          isOpen={!!partialEditTarget}
          placement={partialEditTarget}
          onClose={() => setPartialEditTarget(null)}
        />
      )}

      {renewTarget && (
        <RenewFacultativePanel
          isOpen={!!renewTarget}
          placement={renewTarget}
          onClose={() => setRenewTarget(null)}
        />
      )}

      <Modal
        isOpen={!!archiveTarget}
        onClose={closeArchiveModal}
        title="Archive Placement?"
        description="This placement will be removed from the active list. It can be restored later."
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={closeArchiveModal} disabled={isArchiving}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isArchiving}
              loadingText="Archiving…"
              onClick={handleArchive}
            >
              Archive
            </Button>
          </div>
        }
      >
        <label className="mt-4 block text-sm font-medium text-gray-700">
          Reason <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={archiveReason}
          onChange={(event) => setArchiveReason(event.target.value)}
          maxLength={500}
          rows={3}
          className="mt-2 w-full rounded-input border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-(--focus-ring,var(--color-gray-400))"
          placeholder="Why is this placement being archived?"
        />
      </Modal>

      <Modal
        isOpen={!!restoreTarget}
        onClose={() => setRestoreTarget(null)}
        title="Restore Placement?"
        description={`Restore "${displayPolicyNumber(restoreTarget?.policyNumber)}" to the active facultative list?`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setRestoreTarget(null)} disabled={isRestoring}>
              Cancel
            </Button>
            <Button isLoading={isRestoring} loadingText="Restoring…" onClick={handleRestore}>
              Restore
            </Button>
          </div>
        }
      />

      <Modal
        isOpen={!!forceCloseTarget}
        onClose={() => setForceCloseTarget(null)}
        title="Force Close Placement?"
        description={`This bypasses the normal close workflow and closes "${displayPolicyNumber(forceCloseTarget?.policyNumber)}" at its actual placed capacity. Outstanding workflow history is preserved, but the offer will no longer accept changes.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setForceCloseTarget(null)}
              disabled={isForceClosing}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isForceClosing}
              loadingText="Force closing…"
              onClick={handleForceClose}
            >
              Force Close
            </Button>
          </div>
        }
      />
    </>
  );
}
