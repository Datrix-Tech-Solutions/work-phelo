'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Badge } from '@/components/atoms/Badge';
import { EndorsedReferencePill } from '@/components/atoms/EndorsedReferencePill';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { MakeClaimPanel } from '@/components/organisms/reinsurance/panels/MakeClaimPanel';
import { useFacultatives, usePlacementClaims } from '@/hooks';
import type { Facultative, FacultativeStatus, PlacementClaim } from '@/types/reinsurance';

const PAGE_SIZE = 10;

const CLOSING_STATUSES: FacultativeStatus[] = [
  'PARTIALLY_PLACED',
  'PLACED',
  'CLOSING',
  'CLOSED',
  'DECLINED',
  'CANCELLED',
];

interface PlacementWithClaim extends Facultative {
  claimsLoaded?: boolean;
  latestClaim?: PlacementClaim | null;
}

function fmtAmount(val: number | string | null | undefined, currency?: string | null) {
  if (val == null || val === '') return '—';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '—';
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function netPremiumFor(row: Facultative): number {
  const facPremium =
    row.premium != null && row.facultativeOffer != null
      ? (row.facultativeOffer / 100) * row.premium
      : 0;
  return row.commission != null ? facPremium * (1 - row.commission / 100) : facPremium;
}

const COLUMNS: Column<PlacementWithClaim>[] = [
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
    key: 'cedant',
    label: 'Cedant',
    width: '1fr',
    render: (row) => <span className="text-gray-700">{row.cedant.name}</span>,
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
        <span className="text-gray-900 whitespace-nowrap">
          {facSumInsured != null ? `${row.currency ?? ''} ${fmtAmount(facSumInsured)}` : '—'}
        </span>
      );
    },
  },
  {
    key: 'premium',
    label: 'Net Premium',
    width: '1.1fr',
    render: (row) => (
      <span className="font-medium text-gray-900 whitespace-nowrap">
        {fmtAmount(netPremiumFor(row), row.currency)}
      </span>
    ),
  },
  {
    key: 'participants',
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
    key: 'createdAt',
    label: 'Offer Date',
    width: '1fr',
    render: (row) => (
      <span className="text-gray-600">
        {new Date(row.createdAt).toLocaleDateString('en-GB', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })}
      </span>
    ),
  },
  {
    key: 'claimStatus',
    label: 'Claim Status',
    width: '140px',
    className: 'pr-6',
    render: (row) => {
      if (row.latestClaim) return <Badge label="Claimed" variant="success" />;
      if (row.claimsLoaded) return <Badge label="Unclaimed" variant="neutral" />;
      return <Badge label="Review" variant="neutral" />;
    },
  },
];

export function ClaimsTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [cedantFilter, setCedantFilter] = useState('');
  const [page, setPage] = useState(1);
  const [panelTarget, setPanelTarget] = useState<PlacementWithClaim | null>(null);

  const { data: allRows = [], isLoading } = useFacultatives();
  const selectedPlacementId = panelTarget?.id ?? '';
  const { data: selectedPlacementClaims = [], isFetching: isLoadingSelectedClaims } =
    usePlacementClaims(selectedPlacementId);
  const selectedClaim = selectedPlacementClaims[0] ?? null;

  const closingRows = useMemo(
    () => allRows.filter((r) => CLOSING_STATUSES.includes(r.status)),
    [allRows],
  );

  const tableRows = useMemo<PlacementWithClaim[]>(
    () =>
      closingRows.map((placement) => {
        const claimsLoaded = placement.id === selectedPlacementId && !isLoadingSelectedClaims;

        return {
          ...placement,
          claimsLoaded,
          latestClaim: claimsLoaded ? selectedClaim : undefined,
        };
      }),
    [closingRows, isLoadingSelectedClaims, selectedClaim, selectedPlacementId],
  );

  const cedantOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of tableRows) seen.set(r.cedant.id, r.cedant.name);
    return Array.from(seen.entries())
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [tableRows]);

  const filtered = useMemo(() => {
    let rows = tableRows;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.reference.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          (r.classOfBusiness?.toLowerCase().includes(q) ?? false) ||
          (r.latestClaim?.claimNumber.toLowerCase().includes(q) ?? false),
      );
    }
    if (cedantFilter) rows = rows.filter((r) => r.cedant.id === cedantFilter);
    return rows;
  }, [tableRows, search, cedantFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const panelPlacement = isLoadingSelectedClaims ? undefined : (panelTarget ?? undefined);

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search claims…"
        searchValue={search}
        onRowClick={(row) => router.push(`/${tenantSlug}/operations/reinsurance/claims/${row.id}`)}
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
        rowActions={(row) => [
          {
            label: 'View',
            onClick: () => router.push(`/${tenantSlug}/operations/reinsurance/claims/${row.id}`),
          },
          {
            label: row.latestClaim
              ? 'Edit Claim'
              : row.claimsLoaded
                ? 'Make Claim'
                : 'Manage Claim',
            onClick: () => setPanelTarget(row),
          },
        ]}
        emptyMessage="No placed offers found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <MakeClaimPanel
        isOpen={!!panelTarget}
        placement={panelPlacement}
        claim={selectedClaim}
        onClose={() => setPanelTarget(null)}
      />
    </>
  );
}
