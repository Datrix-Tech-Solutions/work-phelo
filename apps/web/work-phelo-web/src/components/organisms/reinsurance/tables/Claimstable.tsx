'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { EndorsedReferencePill } from '@/components/atoms/EndorsedReferencePill';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Facultative, FacultativeStatus, PlacementClaim } from '@/types/reinsurance';
import { useCedants, useFacultatives } from '@/hooks';
import { MakeClaimPanel } from '@/components/organisms/reinsurance/panels/MakeClaimPanel';
import { isForeignCedant, FOREIGN_CEDANT_DEDUCTION_RATE } from '@/lib/reinsuranceTax';
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
}

function fmtAmount(val: number | string | null | undefined, currency?: string | null) {
  if (val == null || val === '') return '—';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '—';
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function netPremiumFor(row: Facultative, deductionRate: number): number {
  const facPremium =
    row.premium != null && row.facultativeOffer != null
      ? (row.facultativeOffer / 100) * row.premium
      : 0;
  const netPremium = row.commission != null ? facPremium * (1 - row.commission / 100) : facPremium;
  return netPremium - facPremium * deductionRate;
}

function NetPremiumCell({ row }: { row: Facultative }) {
  const { data: cedants = [] } = useCedants();
  const deductionRate = isForeignCedant(cedants.find((c) => c.id === row.cedant.id))
    ? FOREIGN_CEDANT_DEDUCTION_RATE
    : 0;
  return <>{fmtAmount(netPremiumFor(row, deductionRate), row.currency)}</>;
}

const COLUMNS: Column<ClaimTableRow>[] = [
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
  {
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
          {facSumInsured != null ? `${placement.currency ?? ''} ${fmtAmount(facSumInsured)}` : '—'}
        </span>
      );
    },
  },
  {
    key: 'premium',
    label: 'Net Premium',
    width: '150px',
    className: 'text-right',
    render: (row) => (
      <span className="font-medium text-gray-900 whitespace-nowrap">
        <NetPremiumCell row={row.placement} />
      </span>
    ),
  },

  {
    key: 'createdAt',
    label: 'Offer Date',
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

export function ClaimsTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [cedantFilter, setCedantFilter] = useState('');
  const [page, setPage] = useState(1);
  const [panelTarget, setPanelTarget] = useState<ClaimTableRow | null>(null);

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

  const claimRows = useMemo<ClaimTableRow[]>(
    () =>
      closingRows.flatMap((placement, i) =>
        (claimQueries[i]?.data ?? []).map((claim) => ({
          id: claim.id,
          placement,
          claim,
        })),
      ),
    [closingRows, claimQueries],
  );

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

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={paged}
        isLoading={isLoading || isLoadingClaims}
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
        actionButton={{
          label: 'Receive Cedant Claim',
          onClick: () => router.push(`/${tenantSlug}/operations/reinsurance/claims/new`),
        }}
        rowActions={(row) => [
          {
            label: 'View',
            onClick: () =>
              router.push(
                `/${tenantSlug}/operations/reinsurance/claims/${row.claim.id}?placementId=${row.placement.id}`,
              ),
          },
          {
            label: 'Edit Claim',
            onClick: () => setPanelTarget(row),
          },
        ]}
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
    </>
  );
}
