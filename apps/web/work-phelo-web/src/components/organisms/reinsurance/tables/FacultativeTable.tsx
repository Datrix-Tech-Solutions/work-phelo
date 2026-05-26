'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { CreateFacultativePanel } from '@/components/organisms/reinsurance/panels/CreateFacultativePanel';
import { Facultative, FacultativeStatus, FACULTATIVE_STATUSES } from '@/types/reinsurance';

const PAGE_SIZE = 10;

function fmtMonth(iso: string) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

const STATUS_VARIANT_MAP: Record<FacultativeStatus, 'success' | 'warning' | 'neutral' | 'danger'> =
  {
    Active: 'success',
    Pending: 'warning',
    Expired: 'neutral',
    Cancelled: 'danger',
  };

const STATUS_FILTER_OPTIONS = FACULTATIVE_STATUSES.map((s) => ({ value: s, label: s }));

// TODO: replace with useFacultative() hook once API is ready
const MOCK_DATA: Facultative[] = [];

const COLUMNS: Column<Facultative>[] = [
  {
    key: 'policyNumber',
    label: 'Policy Number',
    width: '1.4fr',
    render: (row) => <span className="font-medium text-gray-900">{row.policyNumber}</span>,
  },
  {
    key: 'cedant',
    label: 'Cedant',
    width: '1.6fr',
    render: (row) => <span className="text-gray-700">{row.cedant}</span>,
  },
  {
    key: 'riskType',
    label: 'Risk Type',
    width: '1.2fr',
    render: (row) => <span className="text-gray-600">{row.riskType}</span>,
  },
  {
    key: 'classOfBusiness',
    label: 'Class',
    width: '1.2fr',
    render: (row) => <span className="text-gray-600">{row.classOfBusiness}</span>,
  },
  {
    key: 'period',
    label: 'Period',
    width: '1.4fr',
    render: (row) => (
      <span className="text-gray-600">
        {fmtMonth(row.periodStart)} – {fmtMonth(row.periodEnd)}
      </span>
    ),
  },
  {
    key: 'year',
    label: 'Year',
    width: '70px',
    render: (row) => <span className="text-gray-700">{row.year}</span>,
  },
  {
    key: 'yourShare',
    label: 'Your Share',
    width: '90px',
    render: (row) => <span className="text-gray-700">{row.yourShare}%</span>,
  },
  {
    key: 'grossPremium',
    label: 'Gross Premium',
    width: '1.2fr',
    render: (row) => <span className="text-gray-700">{row.grossPremium.toLocaleString()}</span>,
  },
  {
    key: 'netPremium',
    label: 'Net Premium',
    width: '1.2fr',
    render: (row) => <span className="text-gray-700">{row.netPremium.toLocaleString()}</span>,
  },
  {
    key: 'status',
    label: 'Status',
    width: '110px',
    render: (row) => <Badge label={row.status} variant={STATUS_VARIANT_MAP[row.status]} />,
  },
];

export function FacultativeTable() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);

  const filtered = useMemo(() => {
    let rows = MOCK_DATA;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.policyNumber.toLowerCase().includes(q) ||
          r.cedant.toLowerCase().includes(q) ||
          r.riskType.toLowerCase().includes(q) ||
          r.classOfBusiness.toLowerCase().includes(q),
      );
    }
    if (statusFilter) {
      rows = rows.filter((r) => r.status === (statusFilter as FacultativeStatus));
    }
    return rows;
  }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={paged}
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
        actionButton={{ label: 'New Facultative', onClick: () => setPanelOpen(true) }}
        rowActions={() => [
          {
            label: 'View',
            onClick: () => {
              /* TODO */
            },
          },
          {
            label: 'Edit',
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
