'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { AddAgreementPanel } from '@/components/organisms/companyPolicies/AddAgreementPanel';

const AGREEMENT_TYPE_LABELS: Record<string, string> = {
  NDA: 'Non-Disclosure Agreement',
  EMPLOYMENT_CONTRACT: 'Employment Contract',
  CONFIDENTIALITY: 'Confidentiality Agreement',
  NON_COMPETE: 'Non-Compete Agreement',
  CODE_OF_CONDUCT: 'Code of Conduct',
  IP_ASSIGNMENT: 'IP Assignment Agreement',
  PROBATION_AGREEMENT: 'Probation Agreement',
  OTHER: 'Other',
};

interface Agreement {
  id: string;
  type: string;
  title: string;
  details: string;
  createdAt: string;
}

const COLUMNS: Column<Agreement>[] = [
  {
    key: 'title',
    label: 'Title',
    width: '2fr',
  },
  {
    key: 'type',
    label: 'Type',
    width: '2fr',
    render: (row) => AGREEMENT_TYPE_LABELS[row.type] ?? row.type,
  },
  {
    key: 'details',
    label: 'Details',
    width: '3fr',
    render: (row) => <span className="line-clamp-2 text-gray-500">{row.details}</span>,
  },
  {
    key: 'createdAt',
    label: 'Created',
    width: '120px',
    render: (row) =>
      new Date(row.createdAt).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
  },
];

const PAGE_SIZE = 10;

export default function CompanyAgreementsPage() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = agreements.filter(
    (a) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      (AGREEMENT_TYPE_LABELS[a.type] ?? a.type).toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="flex items-center justify-between shrink-0">
        <p className="text-sm text-gray-500">
          Manage agreements and documents employees are required to sign.
        </p>
        <Button onClick={() => setPanelOpen(true)}>+ Add Agreement</Button>
      </div>

      <DataTable
        columns={COLUMNS}
        data={paginated}
        emptyMessage="No agreements found"
        searchPlaceholder="Search by title or type…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        rowActions={(row) => [
          {
            label: 'Delete',
            danger: true,
            onClick: () => setAgreements((prev) => prev.filter((a) => a.id !== row.id)),
          },
        ]}
      />

      <AddAgreementPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSubmit={(data) => {
          setAgreements((prev) => [
            {
              id: crypto.randomUUID(),
              type: data.type,
              title: data.title,
              details: data.details,
              createdAt: new Date().toISOString(),
            },
            ...prev,
          ]);
          setPanelOpen(false);
        }}
      />
    </div>
  );
}
