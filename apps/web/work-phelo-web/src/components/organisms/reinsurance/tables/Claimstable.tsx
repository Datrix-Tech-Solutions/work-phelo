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
  PlacementPayment,
  toStatusLabel,
} from '@/types/reinsurance';
import { useFacultatives } from '@/hooks';
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

const RAW_STATUS_VARIANT_MAP: Record<
  FacultativeStatus,
  'success' | 'warning' | 'neutral' | 'danger'
> = {
  DRAFT: 'neutral',
  MARKETING: 'warning',
  PARTIALLY_PLACED: 'success',
  PLACED: 'success',
  CLOSING: 'warning',
  CLOSED: 'success',
  DECLINED: 'danger',
  CANCELLED: 'danger',
};

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

function StatusCell({ placement }: { placement: Facultative }) {
  return (
    <Badge
      label={toStatusLabel(placement.status)}
      variant={RAW_STATUS_VARIANT_MAP[placement.status]}
    />
  );
}

const COLUMNS: Column<Facultative>[] = [
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
    render: (row) => <StatusCell placement={row} />,
  },
];

const CLOSING_STATUSES: FacultativeStatus[] = [
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

  const cedantOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const r of paidRows) seen.set(r.cedant.id, r.cedant.name);
    return Array.from(seen.entries())
      .map(([id, name]) => ({ value: id, label: name }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [paidRows]);

  const filtered = useMemo(() => {
    let rows = paidRows;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.reference.toLowerCase().includes(q) ||
          r.title.toLowerCase().includes(q) ||
          (r.classOfBusiness?.toLowerCase().includes(q) ?? false),
      );
    }
    if (cedantFilter) {
      rows = rows.filter((r) => r.cedant.id === cedantFilter);
    }
    return rows;
  }, [paidRows, search, cedantFilter]);

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
        extraFilters={cedantDropdown}
        // actionButton={{ label: 'Make Claim', onClick: () => setClaimTarget({} as Facultative) }}
        rowActions={(row) => [
          {
            label: 'View Claim',
            onClick: () => router.push(`/${tenantSlug}/operations/reinsurance/claims/${row.id}`),
          },
          {
            label: 'Make Claim',
            onClick: () => setClaimTarget(row),
          },
          {
            label: 'Claim Request',
            onClick: () => {
              /* TODO */
            },
          },
        ]}
        emptyMessage="No paid placements found"
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
