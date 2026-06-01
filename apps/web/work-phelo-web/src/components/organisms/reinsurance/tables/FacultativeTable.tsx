'use client';

import { useState, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { CreateFacultativePanel } from '@/components/organisms/reinsurance/panels/CreateFacultativePanel';
import { Facultative, FacultativeStatus, FACULTATIVE_STATUSES } from '@/types/reinsurance';
import { useFacultatives } from '@/hooks';

const PAGE_SIZE = 10;

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function fmtAmount(val: number) {
  return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const STATUS_VARIANT_MAP: Record<FacultativeStatus, 'success' | 'warning' | 'neutral' | 'danger'> =
  {
    Open: 'success',
    Closed: 'warning',
    Expired: 'neutral',
    Cancelled: 'danger',
  };

const STATUS_FILTER_OPTIONS = FACULTATIVE_STATUSES.map((s) => ({ value: s, label: s }));

const COLUMNS: Column<Facultative>[] = [
  {
    key: 'policyNumber',
    label: 'Policy Number',
    width: '1.2fr',
    render: (row) => <span className="font-medium text-gray-900">{row.policyNumber}</span>,
  },
  {
    key: 'insuranceCompany',
    label: 'Insurance Company',
    width: '1.5fr',
    render: (row) => <span className="text-gray-700">{row.insuranceCompany}</span>,
  },
  {
    key: 'insured',
    label: 'Insured',
    width: '1.5fr',
    render: (row) => <span className="text-gray-700">{row.insured}</span>,
  },
  {
    key: 'riskType',
    label: 'Risk Type',
    width: '1.2fr',
    render: (row) => <span className="text-gray-600">{row.riskType}</span>,
  },
  {
    key: 'sumInsured',
    label: 'Sum Insured',
    width: '1.1fr',
    render: (row) => <span className="text-gray-700">{fmtAmount(row.sumInsured)}</span>,
  },
  {
    key: 'rate',
    label: 'Rate (%)',
    width: '90px',
    render: (row) => <span className="text-gray-700">{row.rate}%</span>,
  },
  {
    key: 'offerDate',
    label: 'Offer Date',
    width: '1.1fr',
    render: (row) => <span className="text-gray-600">{fmtDate(row.offerDate)}</span>,
  },
  {
    key: 'status',
    label: 'Status',
    width: '110px',
    render: (row) => <Badge label={row.status} variant={STATUS_VARIANT_MAP[row.status]} />,
  },
];

export function FacultativeTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);

  const { data: allRows = [], isLoading } = useFacultatives();

  const filtered = useMemo(() => {
    let rows = allRows;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.policyNumber.toLowerCase().includes(q) ||
          r.insuranceCompany.toLowerCase().includes(q) ||
          r.insured.toLowerCase().includes(q) ||
          r.riskType.toLowerCase().includes(q),
      );
    }
    if (statusFilter) {
      rows = rows.filter((r) => r.status === (statusFilter as FacultativeStatus));
    }
    return rows;
  }, [allRows, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search facultative…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        filterOptions={STATUS_FILTER_OPTIONS}
        onFilter={(v) => {
          setStatusFilter(v);
          setPage(1);
        }}
        onExport={() => {
          /* TODO: implement export */
        }}
        actionButton={{ label: 'New Offer', onClick: () => setPanelOpen(true) }}
        rowActions={(row) => [
          {
            label: 'View',
            onClick: () =>
              router.push(`/${tenantSlug}/operations/reinsurance/facultative/${row.id}`),
          },
          {
            label: 'Generate Slip',
            onClick: () => {
              /* TODO */
            },
          },
          {
            label: 'Edit Slip',
            onClick: () => {
              /* TODO */
            },
          },
          {
            label: 'Delete',
            onClick: () => {
              /* TODO */
            },
            danger: true,
          },
        ]}
        emptyMessage="No facultative placements found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <CreateFacultativePanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}
