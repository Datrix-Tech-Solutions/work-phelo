'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { EndorsedReferencePill } from '@/components/atoms/EndorsedReferencePill';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  Facultative,
  FacultativeStatus,
  PlacementClaim,
  PlacementClaimAllocation,
  PlacementClaimRecoveryPosition,
} from '@/types/reinsurance';
import {
  useFacultatives,
  recoveryPositionKey,
  allocationsKey,
  useDeletePlacementClaim,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { MakeClaimPanel } from '@/components/organisms/reinsurance/panels/MakeClaimPanel';
import { displayPolicyNumber } from '@/lib/reinsurance/policyNumber';

const PAGE_SIZE = 10;

const CLOSING_STATUSES: FacultativeStatus[] = [
  'PARTIALLY_PLACED',
  'PLACED',
  'CLOSING',
  'CLOSED',
  'DECLINED',
  'CANCELLED',
];

interface ClaimTableRow {
  id: string;
  placement: Facultative;
  claim: PlacementClaim;
  /** Bank-confirmed amount recovered from reinsurers so far, net of reversals — only
   * populated on the Open/Closed tabs, where recovery-position data is fetched. */
  recoveredAmount?: number;
}

export type ClaimsTableTab = 'notification' | 'open' | 'closed';

// Brokerage isn't a single rate on the offer — it's the sum of each accepted/closed
// participant's own brokerage cut. Same formula as BrokerageByCurrencyCard.
function brokerageAmountFor(placement: Facultative): number | null {
  if (placement.premium == null) return null;
  let total: number | null = null;
  for (const p of placement.participants ?? []) {
    if (p.status !== 'ACCEPTED' && p.status !== 'CLOSED') continue;
    const share = p.sharePercent != null ? parseFloat(p.sharePercent) : null;
    const fee = p.brokerageFee != null ? parseFloat(p.brokerageFee) : null;
    if (share == null || fee == null) continue;
    total = (total ?? 0) + placement.premium * (share / 100) * (fee / 100);
  }
  return total;
}

function fmtAmount(val: number | string | null | undefined, currency?: string | null) {
  if (val == null || val === '') return '—';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '—';
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildColumns(tab: ClaimsTableTab): Column<ClaimTableRow>[] {
  return [
    {
      key: 'reference',
      label: 'Policy Number',
      width: '150px',
      render: (row) => (
        <EndorsedReferencePill
          id={row.placement.id}
          reference={displayPolicyNumber(row.placement.policyNumber)}
        />
      ),
    },
    {
      key: 'title',
      label: 'Insured / Risk Type',
      width: 'minmax(150px, 1fr)',
      render: (row) => (
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-gray-900 leading-tight">{row.placement.title}</span>
          <span className="text-xs text-gray-400">{row.placement.classOfBusiness ?? '—'}</span>
        </div>
      ),
    },
    {
      key: 'claimNumber',
      label: 'Claim Number',
      width: '100px',
      render: (row) => <span className="font-medium text-gray-900">{row.claim.claimNumber}</span>,
    },
    {
      key: 'cedant',
      label: 'Cedant',
      width: 'minmax(100px, 1fr)',
      render: (row) => <span className="text-gray-700">{row.placement.cedant.name}</span>,
    },
    tab === 'open'
      ? {
          key: 'recoveredAmount',
          label: 'Total Recovered',
          width: '150px',
          className: 'text-right',
          render: (row) => (
            <span className="text-gray-900 whitespace-nowrap">
              {fmtAmount(row.recoveredAmount, row.claim.currency)}
            </span>
          ),
        }
      : {
          key: 'facultativeOffer',
          label: 'Fac. Sum Insured',
          width: '150px',
          className: 'text-right',
          render: (row) => {
            const placement = row.placement;
            const facSumInsured =
              placement.sumInsured != null && placement.facultativeOffer != null
                ? placement.sumInsured * (placement.facultativeOffer / 100)
                : null;
            return (
              <span className="text-gray-900 whitespace-nowrap">
                {facSumInsured != null
                  ? `${placement.currency ?? ''} ${fmtAmount(facSumInsured)}`
                  : '—'}
              </span>
            );
          },
        },
    tab !== 'notification'
      ? {
          key: 'finalLossAmount',
          label: 'Actual Claim',
          width: '150px',
          className: 'text-right',
          render: (row) => (
            <span className="font-medium text-gray-900 whitespace-nowrap">
              {fmtAmount(row.claim.finalLossAmount, row.claim.currency)}
            </span>
          ),
        }
      : {
          key: 'estimatedLossAmount',
          label: 'Claim Amount',
          width: '150px',
          className: 'text-right',
          render: (row) => (
            <span className="font-medium text-gray-900 whitespace-nowrap">
              {fmtAmount(row.claim.estimatedLossAmount, row.claim.currency)}
            </span>
          ),
        },

    {
      key: 'brokerage',
      label: 'Brokerage',
      width: '150px',
      className: 'text-right',
      render: (row) => (
        <span className="text-gray-900 whitespace-nowrap">
          {fmtAmount(brokerageAmountFor(row.placement), row.placement.currency)}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Claim entry date',
      width: '150px',
      render: (row) => (
        <span className="text-gray-600">
          {new Date(row.claim.occurrenceDate).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      ),
    },
  ];
}

interface ClaimsTableProps {
  /** 'notification' (default) shows claims still awaiting an actual amount. 'open' shows
   * claims that have an actual claim amount but are not yet fully recovered, and swaps the
   * header action to "Add Claim". 'closed' shows claims fully recovered from reinsurers.
   * The three tabs partition every claim with no overlap. */
  tab?: ClaimsTableTab;
}

export function ClaimsTable({ tab = 'notification' }: ClaimsTableProps) {
  const router = useRouter();
  const toast = useToast();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [cedantFilter, setCedantFilter] = useState('');
  const [page, setPage] = useState(1);
  const [panelTarget, setPanelTarget] = useState<ClaimTableRow | null>(null);
  const [isAddClaimOpen, setIsAddClaimOpen] = useState(false);
  const [isAddNotificationOpen, setIsAddNotificationOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClaimTableRow | null>(null);
  const { mutate: deleteClaim, isPending: isDeleting } = useDeletePlacementClaim();

  const { data: allRows = [], isLoading } = useFacultatives();

  const closingRows = useMemo(
    () => allRows.filter((r) => CLOSING_STATUSES.includes(r.status)),
    [allRows],
  );

  const claimQueries = useQueries({
    queries: closingRows.map((row) => ({
      queryKey: ['reinsurance', 'placements', row.id, 'claims'] as const,
      queryFn: async () => {
        const res = await api.get(`/operations/reinsurance/placements/${row.id}/claims`);
        return (res.data?.items ?? res.data ?? []) as PlacementClaim[];
      },
    })),
  });
  const isLoadingClaims = claimQueries.some((query) => query.isLoading);

  // Claims with an actual amount already set — the Open and Closed tabs both draw from
  // these, split further below by whether the claim has been fully recovered.
  const finalizedRows = useMemo<ClaimTableRow[]>(
    () =>
      closingRows.flatMap((placement, i) =>
        (claimQueries[i]?.data ?? [])
          .filter((claim) => claim.finalLossAmount != null)
          .map((claim) => ({ id: claim.id, placement, claim })),
      ),
    [closingRows, claimQueries],
  );

  // Fully recovered = every reinsurer cash call on the claim is settled — checked via the
  // recovery-position endpoint, only fetched for finalized claims and only on the Open/Closed tabs.
  const isFinancialTab = tab === 'open' || tab === 'closed';
  const recoveryQueries = useQueries({
    queries: finalizedRows.map((row) => ({
      queryKey: recoveryPositionKey(row.placement.id, row.claim.id),
      queryFn: async () => {
        const res = await api.get(
          `/operations/reinsurance/placements/${row.placement.id}/claims/${row.claim.id}/recovery-position`,
        );
        return res.data as PlacementClaimRecoveryPosition;
      },
      enabled: isFinancialTab,
    })),
  });
  const isLoadingRecovery = isFinancialTab && recoveryQueries.some((q) => q.isLoading);

  // recovery-position's own totalAllocated reads 0 from the backend, so the "every allocation
  // cash-called" check below sums the allocations directly instead — same figure the Claim
  // Allocations table's "Total Allocated Claim" bar uses.
  const allocationQueries = useQueries({
    queries: finalizedRows.map((row) => ({
      queryKey: allocationsKey(row.placement.id, row.claim.id),
      queryFn: async () => {
        const res = await api.get(
          `/operations/reinsurance/placements/${row.placement.id}/claims/${row.claim.id}/allocations`,
        );
        return (res.data?.items ?? res.data ?? []) as PlacementClaimAllocation[];
      },
      enabled: isFinancialTab,
    })),
  });
  const isLoadingAllocations = isFinancialTab && allocationQueries.some((q) => q.isLoading);

  const claimRows = useMemo<ClaimTableRow[]>(() => {
    if (tab === 'notification') {
      // Only claims still awaiting an actual amount — once finalLossAmount is set, the
      // claim has moved on to the Open/Closed tabs, so it drops off Notification.
      return closingRows.flatMap((placement, i) =>
        (claimQueries[i]?.data ?? [])
          .filter((claim) => claim.finalLossAmount == null)
          .map((claim) => ({ id: claim.id, placement, claim })),
      );
    }
    return finalizedRows
      .map((row, i): ClaimTableRow | null => {
        const position = recoveryQueries[i]?.data;
        const allocations = allocationQueries[i]?.data;
        if (!position || !allocations) return null;
        const totalAllocated = allocations.reduce(
          (sum, a) =>
            sum + parseFloat(a.allocatedFinalLossAmount ?? a.allocatedEstimatedLossAmount),
          0,
        );
        const totalCashCalled = parseFloat(position.recoveries.totalCashCalled);
        const totalOutstanding = parseFloat(position.recoveries.totalOutstanding);
        const totalConfirmed = parseFloat(position.recoveries.totalConfirmed);
        const totalReversed = parseFloat(position.recoveries.totalReversed);
        // Fully recovered requires every allocation to have been cash-called (not just that
        // whatever's been called is covered) — otherwise a reinsurer who was never sent a
        // cash call would silently make the claim look closed.
        const allAllocationsCalled = totalAllocated > 0 && totalCashCalled >= totalAllocated - 0.01;
        const isFullyRecovered = allAllocationsCalled && totalOutstanding <= 0.01;
        if (tab === 'closed' ? !isFullyRecovered : isFullyRecovered) return null;
        return { ...row, recoveredAmount: totalConfirmed - totalReversed };
      })
      .filter((row): row is ClaimTableRow => row !== null);
  }, [tab, closingRows, claimQueries, finalizedRows, recoveryQueries, allocationQueries]);

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
    return rows;
  }, [claimRows, search, cedantFilter]);

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

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading || isLoadingClaims || isLoadingRecovery || isLoadingAllocations}
        searchPlaceholder="Search claims…"
        searchValue={search}
        onRowClick={(row) =>
          router.push(
            `/${tenantSlug}/operations/reinsurance/claims/${row.claim.id}?placementId=${row.placement.id}`,
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
          // Closed claims are read-only, and the row click already opens View — no action
          // menu needed there.
          tab === 'closed'
            ? undefined
            : (row) => {
                const view = {
                  label: 'View',
                  onClick: () =>
                    router.push(
                      `/${tenantSlug}/operations/reinsurance/claims/${row.claim.id}?placementId=${row.placement.id}`,
                    ),
                };
                const edit = { label: 'Edit Claim', onClick: () => setPanelTarget(row) };
                if (tab === 'open') return [view, edit];

                // Notification: still just a draft entry, so it can be deleted outright.
                return [
                  view,
                  edit,
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
    </>
  );
}
