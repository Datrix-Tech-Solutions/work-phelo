'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
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

interface PlacementWithClaim extends Facultative {
  latestClaim?: PlacementClaim;
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

const COLUMNS: Column<PlacementWithClaim>[] = [
  {
    key: 'reference',
    label: 'Policy Number',
    width: 'minmax(190px, 1fr)',
    render: (row) => (
      <EndorsedReferencePill id={row.id} reference={displayPolicyNumber(row.policyNumber)} />
    ),
  },
  {
    key: 'title',
    label: 'Insured / Risk Type',
    width: 'minmax(150px, 1fr)',
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
    render: (row) => <span className="text-gray-700">{row.cedant.name}</span>,
  },
  {
    key: 'facultativeOffer',
    label: 'Fac. Sum Insured',
    width: '150px',
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
    width: '150px',
    render: (row) => (
      <span className="font-medium text-gray-900 whitespace-nowrap">
        <NetPremiumCell row={row} />
      </span>
    ),
  },

  {
    key: 'createdAt',
    label: 'Offer Date',
    width: '150px',
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
];

export function ClaimsTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [cedantFilter, setCedantFilter] = useState('');
  const [page, setPage] = useState(1);
  const [panelTarget, setPanelTarget] = useState<PlacementWithClaim | null>(null);

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

  const tableRows = useMemo<PlacementWithClaim[]>(
    () =>
      closingRows.map((placement, i) => ({
        ...placement,
        latestClaim: claimQueries[i]?.data?.[0],
      })),
    [closingRows, claimQueries],
  );

  const claimedRows = useMemo(() => tableRows.filter((r) => !!r.latestClaim), [tableRows]);

  const cedantOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of claimedRows) seen.set(r.cedant.id, r.cedant.name);
    return Array.from(seen.entries())
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [claimedRows]);

  const filtered = useMemo(() => {
    let rows = claimedRows;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.policyNumber?.toLowerCase().includes(q) ?? false) ||
          r.title.toLowerCase().includes(q) ||
          (r.classOfBusiness?.toLowerCase().includes(q) ?? false) ||
          (r.latestClaim?.claimNumber.toLowerCase().includes(q) ?? false),
      );
    }
    if (cedantFilter) {
      rows = rows.filter((r) => r.cedant.id === cedantFilter);
    }
    return rows;
  }, [claimedRows, search, cedantFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
        actionButton={{
          label: 'Receive Cedant Claim',
          onClick: () => router.push(`/${tenantSlug}/operations/reinsurance/claims/new`),
        }}
        rowActions={(row) => [
          {
            label: 'View',
            onClick: () => router.push(`/${tenantSlug}/operations/reinsurance/claims/${row.id}`),
          },
          {
            label: row.latestClaim ? 'Edit Claim' : 'Make Claim',
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
        placement={panelTarget ?? undefined}
        claim={panelTarget?.latestClaim}
        onClose={() => setPanelTarget(null)}
      />
    </>
  );
}
