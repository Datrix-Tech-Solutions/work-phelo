'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQueries } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import {
  Facultative,
  PlacementPayment,
  PlacementClaim,
  PlacementClaimStatus,
} from '@/types/reinsurance';
import { useFacultatives } from '@/hooks';
import { claimsKey } from '@/hooks/reinsurance/useClaims';
import { MakeClaimPanel } from '@/components/organisms/reinsurance/panels/MakeClaimPanel';

const PAGE_SIZE = 10;

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number | null | undefined) {
  if (val == null) return '—';
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const CLAIM_STATUS_VARIANT: Record<
  PlacementClaimStatus,
  'success' | 'warning' | 'neutral' | 'danger' | 'info'
> = {
  DRAFT: 'neutral',
  NOTIFIED: 'info',
  RESERVED: 'warning',
  PARTIALLY_SETTLED: 'warning',
  SETTLED: 'success',
  DECLINED: 'danger',
  CLOSED: 'success',
  VOID: 'danger',
};

function statusLabel(status: PlacementClaimStatus) {
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, ' ');
}

function netPremiumFor(row: Facultative): number {
  const facPremium =
    row.premium != null && row.facultativeOffer != null
      ? (row.facultativeOffer / 100) * row.premium
      : 0;
  return row.commission != null ? facPremium * (1 - row.commission / 100) : facPremium;
}

function totalPaidFor(payments: { amount: string; status: string }[]): number {
  return payments
    .filter((p) => p.status === 'RECORDED')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);
}

type ClaimPlacementRow = Facultative & {
  latestClaim: PlacementClaim | null;
  claimCount: number;
};

function StatusCell({ claim }: { claim: PlacementClaim | null }) {
  if (!claim) return <Badge label="Not recorded" variant="neutral" />;
  return <Badge label={statusLabel(claim.status)} variant={CLAIM_STATUS_VARIANT[claim.status]} />;
}

const COLUMNS: Column<ClaimPlacementRow>[] = [
  {
    key: 'reference',
    label: 'Policy Number',
    width: '190px',
    render: (row) => (
      <span className="inline-flex items-center px-3 py-1 rounded-full border border-blue-300 text-xs font-medium text-blue-700 bg-blue-50 whitespace-nowrap">
        {row.reference}
      </span>
    ),
  },
  {
    key: 'latestClaim',
    label: 'Claim Number',
    width: '130px',
    render: (row) => (
      <span className="font-medium text-gray-700">
        {row.latestClaim?.claimNumber ?? '—'}
        {row.claimCount > 1 && (
          <span className="ml-1 text-xs text-gray-400">+{row.claimCount - 1}</span>
        )}
      </span>
    ),
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
    key: 'sumInsured',
    label: 'Sum Insured',
    width: '1.1fr',
    render: (row) => (
      <span className="text-gray-900 whitespace-nowrap">
        {row.sumInsured != null ? `${row.currency ?? ''} ${fmtAmount(row.sumInsured)}` : '—'}
      </span>
    ),
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
    render: (row) => {
      const facPremium =
        row.premium != null && row.facultativeOffer != null
          ? (row.facultativeOffer / 100) * row.premium
          : null;
      const netPremium =
        facPremium != null && row.commission != null
          ? facPremium * (1 - row.commission / 100)
          : facPremium;
      return (
        <span className="font-medium text-gray-900 whitespace-nowrap">
          {netPremium != null ? `${row.currency ?? ''} ${fmtAmount(netPremium)}` : '—'}
        </span>
      );
    },
  },
  {
    key: 'participants' as keyof Facultative,
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
    render: (row) => <span className="text-gray-600">{fmtDate(row.createdAt)}</span>,
  },
  {
    key: 'status',
    label: 'Claim Status',
    width: '130px',
    className: 'pr-6',
    render: (row) => <StatusCell claim={row.latestClaim} />,
  },
];

const CLOSING_STATUSES: Facultative['status'][] = [
  'PARTIALLY_PLACED',
  'PLACED',
  'CLOSING',
  'CLOSED',
  'DECLINED',
  'CANCELLED',
];

export function ClaimsTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [cedantFilter, setCedantFilter] = useState('');
  const [page, setPage] = useState(1);
  const [claimTarget, setClaimTarget] = useState<Facultative | null>(null);

  const { data: allRows = [], isLoading } = useFacultatives();

  const closingRows = useMemo(
    () => allRows.filter((r) => CLOSING_STATUSES.includes(r.status)),
    [allRows],
  );

  const paymentQueries = useQueries({
    queries: closingRows.map((row) => ({
      queryKey: ['reinsurance', 'placements', row.id, 'payments'] as const,
      queryFn: async () => {
        const res = await api.get(`/operations/reinsurance/placements/${row.id}/payments`);
        return (res.data?.items ?? res.data ?? []) as PlacementPayment[];
      },
    })),
  });

  const paidRows = useMemo(() => {
    return closingRows.filter((row, i) => {
      const payments = paymentQueries[i]?.data ?? [];
      const netPremium = netPremiumFor(row);
      const paid = totalPaidFor(payments);
      return netPremium > 0 && paid >= netPremium;
    });
  }, [closingRows, paymentQueries]);

  const claimQueries = useQueries({
    queries: paidRows.map((row) => ({
      queryKey: claimsKey(row.id),
      queryFn: async () => {
        const res = await api.get(`/operations/reinsurance/placements/${row.id}/claims`);
        return (res.data?.items ?? res.data ?? []) as PlacementClaim[];
      },
    })),
  });

  const claimRows = useMemo<ClaimPlacementRow[]>(
    () =>
      paidRows.map((row, index) => {
        const claims = claimQueries[index]?.data ?? [];
        return {
          ...row,
          latestClaim: claims[0] ?? null,
          claimCount: claims.length,
        };
      }),
    [paidRows, claimQueries],
  );

  const cedantOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of claimRows) seen.set(r.cedant.id, r.cedant.name);
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
          r.reference.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          (r.classOfBusiness?.toLowerCase().includes(q) ?? false) ||
          (r.latestClaim?.claimNumber.toLowerCase().includes(q) ?? false) ||
          (r.latestClaim?.claimCause.toLowerCase().includes(q) ?? false),
      );
    }
    if (cedantFilter) {
      rows = rows.filter((r) => r.cedant.id === cedantFilter);
    }
    return rows;
  }, [claimRows, search, cedantFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const cedantDropdown = (
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
  );

  return (
    <>
      {claimQueries.some((query) => query.isError) && (
        <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Some claim records could not be loaded. Refresh before recording another claim.
        </div>
      )}
      <DataTable
        columns={COLUMNS}
        data={paged}
        isLoading={
          isLoading ||
          paymentQueries.some((query) => query.isLoading) ||
          claimQueries.some((query) => query.isLoading)
        }
        searchPlaceholder="Search claims…"
        searchValue={search}
        onRowClick={(row) => {
          if (row.latestClaim) {
            router.push(
              `/${tenantSlug}/operations/reinsurance/claims/${row.id}?claimId=${row.latestClaim.id}`,
            );
          } else {
            setClaimTarget(row);
          }
        }}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        extraFilters={cedantDropdown}
        rowActions={(row) => [
          ...(row.latestClaim
            ? [
                {
                  label: 'View Claim',
                  onClick: () =>
                    router.push(
                      `/${tenantSlug}/operations/reinsurance/claims/${row.id}?claimId=${row.latestClaim?.id}`,
                    ),
                },
              ]
            : []),
          {
            label: 'Record Claim',
            onClick: () => setClaimTarget(row),
          },
        ]}
        emptyMessage="No claim-eligible placements found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <MakeClaimPanel
        isOpen={!!claimTarget}
        placement={Object.keys(claimTarget ?? {}).length > 0 ? claimTarget! : undefined}
        onClose={() => setClaimTarget(null)}
      />
    </>
  );
}
