'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { EndorsedReferencePill } from '@/components/atoms/EndorsedReferencePill';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Facultative, FacultativeStatus } from '@/types/reinsurance';
import { useFacultatives, useClaimsByTab, ClaimTabRow, useDeletePlacementClaim } from '@/hooks';
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

function fmtDate(val: string | null | undefined) {
  if (!val) return '—';
  return new Date(val).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function buildColumns(tab: ClaimsTableTab): Column<ClaimTabRow>[] {
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
    tab === 'closed'
      ? {
          key: 'recoveredAt',
          label: 'Recovered Date',
          width: '150px',
          render: (row) => <span className="text-gray-600">{fmtDate(row.recoveredAt)}</span>,
        }
      : {
          key: 'createdAt',
          label: 'Claim entry date',
          width: '150px',
          render: (row) => (
            <span className="text-gray-600">{fmtDate(row.claim.occurrenceDate)}</span>
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
  const [panelTarget, setPanelTarget] = useState<ClaimTabRow | null>(null);
  const [isAddClaimOpen, setIsAddClaimOpen] = useState(false);
  const [isAddNotificationOpen, setIsAddNotificationOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ClaimTabRow | null>(null);
  const { mutate: deleteClaim, isPending: isDeleting } = useDeletePlacementClaim();

  const { data: allRows = [], isLoading } = useFacultatives();

  const closingRows = useMemo(
    () => allRows.filter((r) => CLOSING_STATUSES.includes(r.status)),
    [allRows],
  );

  // Shared with ClaimsStatsRow so the tab tables and the KPI counts stay in lockstep and
  // draw on the same cached queries instead of double-fetching.
  const {
    notification,
    open: openRows,
    closed: closedRows,
    isLoadingClaims,
    isLoadingFinancials,
  } = useClaimsByTab(closingRows);

  const claimRows = tab === 'notification' ? notification : tab === 'open' ? openRows : closedRows;
  // The Notification tab doesn't need recovery-position/allocations data, so it doesn't wait on it.
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
    // Most recent first, by whichever date the tab's date column shows — recovered date on
    // Closed, claim entry date elsewhere. Copy before sorting — `rows` may still be the same
    // array reference `claimRows` holds, and sort() mutates in place.
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
          // Closed claims are read-only, and the row click already opens View — no action
          // menu needed there.
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
