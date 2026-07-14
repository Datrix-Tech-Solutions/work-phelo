'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { EndorsedReferencePill } from '@/components/atoms/EndorsedReferencePill';
import { Modal } from '@/components/organisms/shared/Modal';
import { CreateFacultativePanel } from '@/components/organisms/reinsurance/panels/CreateFacultativePanel';
import { EditFacultativePanel } from '@/components/organisms/reinsurance/panels/EditFacultativePanel';
import {
  Facultative,
  FacultativeStatus,
  PlacementPayment,
  toStatusLabel,
} from '@/types/reinsurance';
import {
  useArchivedFacultatives,
  useCedants,
  useDeleteFacultative,
  useFacultatives,
  usePlacementPayments,
  useRestoreFacultative,
} from '@/hooks';
import { isForeignCedant, FOREIGN_CEDANT_DEDUCTION_RATE } from '@/lib/reinsuranceTax';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

const PAGE_SIZE = 10;

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
  { value: 'Outstanding', label: 'Outstanding' },
  { value: 'Part Payment', label: 'Part Payment' },
  { value: 'Paid', label: 'Paid' },
];

type PaymentStatus = 'Outstanding' | 'Part Payment' | 'Paid';

const PAYMENT_STATUS_CLASS: Record<PaymentStatus, string> = {
  Outstanding: 'text-xs text-gray-400',
  'Part Payment': 'text-xs text-yellow-600 font-medium',
  Paid: 'text-xs text-green-600 font-medium',
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
    width: 'minmax(120px, 1fr)',
    render: (row) => <span className="text-gray-700">{row.cedant.name}</span>,
  },
  {
    key: 'facultativeOffer',
    label: 'Fac Offer',
    width: '90px',
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
    width: '130px',
    render: (row) => (
      <span className="font-semibold text-gray-900">
        {row.premium != null ? `${row.currency ?? ''} ${fmtAmount(row.premium)}` : '—'}
      </span>
    ),
  },
  {
    key: 'totalAcceptedPercent',
    label: 'Signing Progress',
    width: '150px',
    className: 'pr-6',
    render: (row) => {
      const facOffer = row.facultativeOffer ?? 0;
      const closedPercent =
        row.participants
          ?.filter((p) => p.status === 'CLOSED')
          .reduce((sum, p) => sum + parseFloat(p.signedLinePercent ?? p.sharePercent ?? '0'), 0) ??
        0;
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
    width: '100px',
    render: (row) => {
      const total = row.participants?.length ?? 0;
      const closed = row.participants?.filter((p) => p.status === 'CLOSED').length ?? 0;
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

const PLACEMENT_STATUSES: FacultativeStatus[] = ['DRAFT', 'MARKETING'];
const CLOSING_STATUSES: FacultativeStatus[] = [
  'PARTIALLY_PLACED',
  'PLACED',
  'CLOSING',
  'CLOSED',
  'DECLINED',
  'CANCELLED',
];

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
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Facultative | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<Facultative | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Facultative | null>(null);
  const [archiveReason, setArchiveReason] = useState('');

  const { data: activeRows = [], isLoading: loadingActive } = useFacultatives();
  const { data: archivedRows = [], isLoading: loadingArchived } = useArchivedFacultatives({
    enabled: tab === 'archived',
  });
  const { data: cedants = [] } = useCedants();
  const { mutate: archivePlacement, isPending: isArchiving } = useDeleteFacultative();
  const { mutate: restorePlacement, isPending: isRestoring } = useRestoreFacultative();

  const allRows = tab === 'archived' ? archivedRows : activeRows;
  const isLoading = tab === 'archived' ? loadingArchived : loadingActive;

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
      const allowed = tab === 'placements' ? PLACEMENT_STATUSES : CLOSING_STATUSES;
      rows = rows.filter((r) => allowed.includes(r.status));
    }
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
    if (statusFilter && tab !== 'archived') {
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

  const columns = useMemo<Column<Facultative>[]>(() => {
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
              <span className="text-xs text-gray-400">User ID: {row.archivedByUserId}</span>
            )}
            {row.archiveReason && (
              <span className="text-xs text-gray-500 line-clamp-2">{row.archiveReason}</span>
            )}
          </div>
        ),
      },
    ];
  }, [tab]);

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
        filterOptions={
          tab === 'placements'
            ? PLACEMENTS_FILTER_OPTIONS
            : tab === 'closing'
              ? CLOSING_FILTER_OPTIONS
              : undefined
        }
        onFilter={(v) => {
          setStatusFilter(v);
          setPage(1);
        }}
        actionButton={
          tab === 'placements'
            ? { label: 'New Offer', onClick: () => setPanelOpen(true) }
            : undefined
        }
        rowActions={(row) =>
          tab === 'archived'
            ? [
                {
                  label: 'Restore',
                  onClick: () => setRestoreTarget(row),
                },
              ]
            : [
                {
                  label: 'View',
                  onClick: () =>
                    router.push(
                      `/${tenantSlug}/operations/reinsurance/facultative/${row.id}${tab === 'closing' ? '?from=closing' : ''}`,
                    ),
                },
                {
                  label: 'Edit Slip',
                  onClick: () => setEditTarget(row),
                },
                {
                  label: 'Archive',
                  onClick: () => setArchiveTarget(row),
                  danger: true,
                },
              ]
        }
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
        description={`Restore "${restoreTarget?.reference}" to the active facultative list?`}
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
    </>
  );
}
