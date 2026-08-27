'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { EndorsedReferencePill } from '@/components/atoms/EndorsedReferencePill';
import { NumberField } from '@/components/atoms/NumberField';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { FacultativeStatus } from '@/types/reinsurance';
import {
  useFacultatives,
  useClaimsByTab,
  ClaimTabRow,
  useDeletePlacementClaim,
  useUpdatePlacementClaimUnbound,
  useClaimAllocations,
  useGenerateClaimAllocationsMutation,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { MakeClaimPanel } from '@/components/organisms/reinsurance/panels/MakeClaimPanel';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 10;

const CLOSING_STATUSES: FacultativeStatus[] = [
  'PARTIALLY_PLACED',
  'PLACED',
  'CLOSING',
  'CLOSED',
  'DECLINED',
  'CANCELLED',
];

export type ClaimsTableTab = 'notification' | 'open' | 'closed';

function fmtAmount(val: number | string | null | undefined, currency?: string | null) {
  if (val == null || val === '') return '—';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '—';
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(val: string | null | undefined) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function buildColumns(tab: ClaimsTableTab): Column<ClaimTabRow>[] {
  const policyNumber: Column<ClaimTabRow> = {
    key: 'reference',
    label: 'Policy Number',
    width: '150px',
    render: (row) => (
      <EndorsedReferencePill
        id={row.placement.id}
        reference={displayPolicyNumber(row.placement.policyNumber)}
      />
    ),
  };

  const insuredRiskType: Column<ClaimTabRow> = {
    key: 'title',
    label: 'Insured / Risk Type',
    width: 'minmax(150px, 1fr)',
    render: (row) => (
      <div className="flex flex-col gap-0.5">
        <span className="font-semibold text-gray-900 leading-tight">{row.placement.title}</span>
        <span className="text-xs text-gray-400">{row.placement.classOfBusiness ?? '—'}</span>
      </div>
    ),
  };

  const claimNumber: Column<ClaimTabRow> = {
    key: 'claimNumber',
    label: 'Claim Number',
    width: '130px',
    render: (row) => <span className="font-medium text-gray-900">{row.claim.claimNumber}</span>,
  };

  const cedant: Column<ClaimTabRow> = {
    key: 'cedant',
    label: 'Cedant',
    width: 'minmax(100px, 1fr)',
    render: (row) => <span className="font-bold text-gray-700">{row.placement.cedant.name}</span>,
  };

  const offerPercent: Column<ClaimTabRow> = {
    key: 'offerPercent',
    label: 'Offer %',
    width: '60px',
    className: 'text-right',
    render: (row) => (
      <span className="font-bold text-gray-900 whitespace-nowrap">
        {row.placement.facultativeOffer != null
          ? `${row.placement.facultativeOffer.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
          : '—'}
      </span>
    ),
  };

  const actualClaim: Column<ClaimTabRow> = {
    key: 'finalLossAmount',
    label: '100% Actual Claim',
    width: '150px',
    className: 'text-right',
    render: (row) => (
      <span className="font-bold text-gray-900 whitespace-nowrap">
        {fmtAmount(row.claim.finalLossAmount, row.claim.currency)}
      </span>
    ),
  };

  const claimShare: Column<ClaimTabRow> = {
    key: 'claimShare',
    label: 'Claim Share',
    width: '120px',
    className: 'text-right',
    render: (row) => (
      <span className="font-semibold text-gray-900 whitespace-nowrap">
        {fmtAmount(row.claimShare, row.claim.currency)}
      </span>
    ),
  };

  const totalRecovered: Column<ClaimTabRow> = {
    key: 'recoveredAmount',
    label: 'Total Recovered',
    width: '120px',
    className: 'text-right',
    render: (row) => (
      <span
        className={cn(
          'font-bold whitespace-nowrap',
          row.recoveredAmount && row.recoveredAmount > 0 ? 'text-emerald-600' : 'text-gray-400',
        )}
      >
        {fmtAmount(row.recoveredAmount, row.claim.currency)}
      </span>
    ),
  };

  const claimEntryDate: Column<ClaimTabRow> = {
    key: 'createdAt',
    label: 'Claim entry date',
    width: '130px',
    render: (row) => (
      <span className="font-semibold text-gray-600">{fmtDate(row.claim.occurrenceDate)}</span>
    ),
  };

  if (tab === 'open') {
    return [
      policyNumber,
      insuredRiskType,
      claimNumber,
      cedant,
      actualClaim,
      offerPercent,
      claimShare,
      totalRecovered,
      claimEntryDate,
    ];
  }

  if (tab === 'closed') {
    return [
      policyNumber,
      insuredRiskType,
      claimNumber,
      cedant,
      actualClaim,
      offerPercent,
      claimShare,
      {
        key: 'recoveredAt',
        label: 'Recovered Date',
        width: '120px',
        render: (row) => (
          <span className="font-semibold text-gray-600">{fmtDate(row.recoveredAt)}</span>
        ),
      },
    ];
  }

  // notification
  return [
    policyNumber,
    insuredRiskType,
    claimNumber,
    cedant,
    {
      key: 'estimatedLossAmount',
      label: '100% Claim Amount',
      width: '150px',
      className: 'text-right',
      render: (row) => (
        <span className="font-medium text-gray-900 whitespace-nowrap">
          {fmtAmount(row.claim.estimatedLossAmount, row.claim.currency)}
        </span>
      ),
    },
    offerPercent,
    {
      // Reinsurer's share of the estimated claim = 100% estimate × fac offer %. Matches the
      // Total Allocated Claim figure once the claim is finalized and allocations are generated.
      key: 'notificationPayable',
      label: 'Payable Amount',
      width: '120px',
      className: 'text-right',
      render: (row) => {
        const estimated =
          row.claim.estimatedLossAmount != null && row.claim.estimatedLossAmount !== ''
            ? parseFloat(row.claim.estimatedLossAmount)
            : null;
        const offer = row.placement.facultativeOffer;
        const payable =
          estimated != null && !isNaN(estimated) && offer != null
            ? estimated * (offer / 100)
            : null;
        return (
          <span className="font-semibold text-gray-900 whitespace-nowrap">
            {payable != null ? fmtAmount(payable, row.claim.currency) : '—'}
          </span>
        );
      },
    },
    claimEntryDate,
  ];
}

interface ClaimsTableProps {
  tab?: ClaimsTableTab;
}

export function ClaimsTable({ tab = 'notification' }: ClaimsTableProps) {
  const router = useRouter();
  const toast = useToast();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [cedantFilter, setCedantFilter] = useState('');
  const [page, setPage] = useState(1);
  const [panelTarget, setPanelTarget] = useState<ClaimTabRow | null>(null);
  const [isAddClaimOpen, setIsAddClaimOpen] = useState(false);
  const [isAddNotificationOpen, setIsAddNotificationOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClaimTabRow | null>(null);
  const { mutate: deleteClaim, isPending: isDeleting } = useDeletePlacementClaim();

  const [finalizeTarget, setFinalizeTarget] = useState<ClaimTabRow | null>(null);
  const [finalAmount, setFinalAmount] = useState('');
  const [finalAmountError, setFinalAmountError] = useState('');
  const updateClaim = useUpdatePlacementClaimUnbound();
  const generateAllocationsForClaim = useGenerateClaimAllocationsMutation();

  const { data: finalizeAllocations = [] } = useClaimAllocations(
    finalizeTarget?.placement.id ?? '',
    finalizeTarget?.claim.id ?? '',
  );

  const { data: allRows = [], isLoading } = useFacultatives();

  const closingRows = useMemo(
    () => allRows.filter((r) => CLOSING_STATUSES.includes(r.status)),
    [allRows],
  );

  const {
    notification,
    open: openRows,
    closed: closedRows,
    isLoadingClaims,
    isLoadingFinancials,
  } = useClaimsByTab(closingRows);

  const claimRows = tab === 'notification' ? notification : tab === 'open' ? openRows : closedRows;
  const isLoadingTabData = isLoadingClaims || (tab !== 'notification' && isLoadingFinancials);

  const cedantOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of claimRows) seen.set(r.placement.cedant.id, r.placement.cedant.name);
    return Array.from(seen.entries())
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [claimRows]);

  const filtered = useMemo(() => {
    let rows = claimRows;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.placement.policyNumber?.toLowerCase().includes(q) ?? false) ||
          r.placement.title.toLowerCase().includes(q) ||
          (r.placement.classOfBusiness?.toLowerCase().includes(q) ?? false) ||
          r.claim.claimNumber.toLowerCase().includes(q),
      );
    }
    if (cedantFilter) {
      rows = rows.filter((r) => r.placement.cedant.id === cedantFilter);
    }

    const dateOf = (r: ClaimTabRow) => (tab === 'closed' ? r.recoveredAt : r.claim.occurrenceDate);
    return [...rows].sort((a, b) => {
      const bTime = dateOf(b) ? new Date(dateOf(b) as string).getTime() : 0;
      const aTime = dateOf(a) ? new Date(dateOf(a) as string).getTime() : 0;
      return bTime - aTime;
    });
  }, [claimRows, search, cedantFilter, tab]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const columns = useMemo(() => buildColumns(tab), [tab]);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteClaim(
      { placementId: deleteTarget.placement.id, claimId: deleteTarget.claim.id },
      {
        onSuccess: () => {
          toast.success('Claim deleted successfully');
          setDeleteTarget(null);
        },
        onError: (err) => toast.error(extractError(err, 'Failed to delete claim')),
      },
    );
  };

  const handleCloseFinalize = () => {
    setFinalizeTarget(null);
    setFinalAmount('');
    setFinalAmountError('');
  };

  const handleFinalize = async () => {
    if (!finalizeTarget) return;
    const parsed = parseFloat(finalAmount);
    if (isNaN(parsed) || parsed <= 0) {
      setFinalAmountError('Actual claim amount is required');
      return;
    }

    try {
      await updateClaim.mutateAsync({
        placementId: finalizeTarget.placement.id,
        claimId: finalizeTarget.claim.id,
        finalLossAmount: parsed,
      });

      if (finalizeAllocations.length === 0) {
        try {
          await generateAllocationsForClaim.mutateAsync({
            placementId: finalizeTarget.placement.id,
            claimId: finalizeTarget.claim.id,
          });
        } catch (allocationError) {
          toast.error(
            `Claim finalized, but allocations could not be generated: ${extractError(allocationError)}`,
          );
        }
      }

      toast.success('Claim finalized successfully');
      handleCloseFinalize();
    } catch (error) {
      toast.error(extractError(error, 'Failed to finalize claim'));
    }
  };

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading || isLoadingTabData}
        searchPlaceholder="Search claims…"
        searchValue={search}
        onRowClick={(row) =>
          router.push(
            `/${tenantSlug}/operations/reinsurance/claims/${row.claim.id}?placementId=${row.placement.id}&tab=${tab}`,
          )
        }
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        extraFilters={
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
        }
        actionButton={
          tab === 'open'
            ? { label: 'Add Claim', onClick: () => setIsAddClaimOpen(true) }
            : tab === 'notification'
              ? { label: 'Add Notification', onClick: () => setIsAddNotificationOpen(true) }
              : undefined
        }
        rowActions={
          tab === 'closed'
            ? undefined
            : (row) => {
                const view = {
                  label: 'View',
                  onClick: () =>
                    router.push(
                      `/${tenantSlug}/operations/reinsurance/claims/${row.claim.id}?placementId=${row.placement.id}&tab=${tab}`,
                    ),
                };
                const edit = { label: 'Edit Claim', onClick: () => setPanelTarget(row) };
                if (tab === 'open') return [view, edit];

                return [
                  view,
                  edit,
                  {
                    label: 'Move to Open',
                    onClick: () => {
                      setFinalizeTarget(row);
                      setFinalAmount(row.claim.estimatedLossAmount);
                      setFinalAmountError('');
                    },
                  },
                  { label: 'Delete', onClick: () => setDeleteTarget(row), danger: true },
                ];
              }
        }
        emptyMessage="No claims found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <MakeClaimPanel
        isOpen={!!panelTarget}
        placement={panelTarget?.placement}
        claim={panelTarget?.claim}
        onClose={() => setPanelTarget(null)}
      />

      {tab === 'open' && (
        <MakeClaimPanel
          isOpen={isAddClaimOpen}
          mode="actual"
          onClose={() => setIsAddClaimOpen(false)}
        />
      )}

      {tab === 'notification' && (
        <MakeClaimPanel
          isOpen={isAddNotificationOpen}
          mode="notification"
          onClose={() => setIsAddNotificationOpen(false)}
        />
      )}

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Claim"
        description={`Are you sure you want to delete claim "${deleteTarget?.claim.claimNumber}"? This cannot be undone.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              loadingText="Deleting…"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </div>
        }
      />

      <Modal
        isOpen={!!finalizeTarget}
        onClose={handleCloseFinalize}
        title="Finalize Claim"
        description={`Enter the actual claim amount for claim "${finalizeTarget?.claim.claimNumber}". This moves it out of Notification.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={handleCloseFinalize}
              disabled={updateClaim.isPending}
            >
              Cancel
            </Button>
            <Button
              isLoading={updateClaim.isPending}
              loadingText="Finalizing…"
              onClick={handleFinalize}
            >
              Finalize Claim
            </Button>
          </div>
        }
      >
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-gray-600">
            The claim amount was{' '}
            <span className="font-medium text-gray-900">
              {fmtAmount(finalizeTarget?.claim.estimatedLossAmount, finalizeTarget?.claim.currency)}
            </span>{' '}
            for the loss that occurred on the{' '}
            <span className="font-medium text-gray-900">
              {fmtDate(finalizeTarget?.claim.occurrenceDate)}
            </span>
            .
          </p>
          <NumberField
            label="100 % Claim Amount"
            value={finalAmount ? Number(finalAmount) : 0}
            onChange={(n) => {
              setFinalAmount(String(n));
              setFinalAmountError('');
            }}
            error={finalAmountError}
            placeholder="0.00"
          />
        </div>
      </Modal>
    </>
  );
}
