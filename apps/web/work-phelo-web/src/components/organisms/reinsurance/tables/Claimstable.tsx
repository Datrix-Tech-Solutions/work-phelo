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
  FacultativeStatus,
  PlacementClaim,
  PlacementPayment,
} from '@/types/reinsurance';
import { useFacultatives } from '@/hooks';
import { MakeClaimPanel } from '@/components/organisms/reinsurance/panels/MakeClaimPanel';

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

function netPremiumFor(row: Facultative): number {
  const facPremium =
    row.premium != null && row.facultativeOffer != null
      ? (row.facultativeOffer / 100) * row.premium
      : 0;
  return row.commission != null ? facPremium * (1 - row.commission / 100) : facPremium;
}

function totalPaidFor(payments: PlacementPayment[]): number {
  return payments
    .filter((p) => p.status === 'RECORDED')
    .reduce((sum, p) => sum + parseFloat(p.amount), 0);
}

const COLUMNS: Column<PlacementWithClaim>[] = [
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
  // {
  //   key: 'sumInsured',
  //   label: 'Sum Insured',
  //   width: '1.1fr',
  //   render: (row) => (
  //     <span className="text-gray-900 whitespace-nowrap">
  //       {row.sumInsured != null ? `${row.currency ?? ''} ${fmtAmount(row.sumInsured)}` : '—'}
  //     </span>
  //   ),
  // },
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
    render: (row) =>
      row.latestClaim ? (
        <Badge label="Claimed" variant="success" />
      ) : (
        <Badge label="Unclaimed" variant="neutral" />
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

  const paymentQueries = useQueries({
    queries: closingRows.map((row) => ({
      queryKey: ['reinsurance', 'placements', row.id, 'payments'] as const,
      queryFn: async () => {
        const res = await api.get(`/operations/reinsurance/placements/${row.id}/payments`);
        return (res.data?.items ?? res.data ?? []) as PlacementPayment[];
      },
    })),
  });

  const paidRows = useMemo(
    () =>
      closingRows.filter((row, i) => {
        const payments = paymentQueries[i]?.data ?? [];
        const netPremium = netPremiumFor(row);
        const paid = totalPaidFor(payments);
        return netPremium > 0 && paid >= netPremium;
      }),
    [closingRows, paymentQueries],
  );

  const claimQueries = useQueries({
    queries: paidRows.map((row) => ({
      queryKey: ['reinsurance', 'placements', row.id, 'claims'] as const,
      queryFn: async () => {
        const res = await api.get(`/operations/reinsurance/placements/${row.id}/claims`);
        return (res.data?.items ?? res.data ?? []) as PlacementClaim[];
      },
    })),
  });

  const tableRows = useMemo<PlacementWithClaim[]>(
    () =>
      paidRows.map((placement, i) => ({
        ...placement,
        latestClaim: claimQueries[i]?.data?.[0],
      })),
    [paidRows, claimQueries],
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
    if (cedantFilter) {
      rows = rows.filter((r) => r.cedant.id === cedantFilter);
    }
    return rows;
  }, [tableRows, search, cedantFilter]);

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
        emptyMessage="No paid placements found"
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
