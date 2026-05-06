'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { AddAgreementPanel } from '@/components/organisms/companyPolicies/AddAgreementPanel';
import { AgreementViewModal } from '@/components/organisms/companyPolicies/AgreementViewModal';
import {
  useCompanyAgreements,
  useCreateCompanyAgreement,
  useDeleteCompanyAgreement,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { CompanyAgreement, CompanyAgreementType, CreateCompanyAgreementDto } from '@/types/hr';

const AGREEMENT_TYPE_LABELS: Record<CompanyAgreementType, string> = {
  NDA: 'Non-Disclosure Agreement',
  EMPLOYMENT_CONTRACT: 'Employment Contract',
  CONFIDENTIALITY: 'Confidentiality Agreement',
  NON_COMPETE: 'Non-Compete Agreement',
  CODE_OF_CONDUCT: 'Code of Conduct',
  IP_ASSIGNMENT: 'IP Assignment Agreement',
  PROBATION_AGREEMENT: 'Probation Agreement',
  OTHER: 'Other',
};

const COLUMNS: Column<CompanyAgreement>[] = [
  { key: 'title', label: 'Title' },
  {
    key: 'type',
    label: 'Type',
    render: (row) => AGREEMENT_TYPE_LABELS[row.type] ?? row.type,
  },
  {
    key: 'createdAt',
    label: 'Created',
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
  const toast = useToast();
  const [panelOpen, setPanelOpen] = useState(false);
  const [viewAgreement, setViewAgreement] = useState<CompanyAgreement | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: agreements = [], isLoading } = useCompanyAgreements();
  const { mutate: createAgreement, isPending: isCreating } = useCreateCompanyAgreement();
  const { mutate: deleteAgreement } = useDeleteCompanyAgreement();

  const filtered = agreements.filter(
    (a) =>
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      (AGREEMENT_TYPE_LABELS[a.type] ?? a.type).toLowerCase().includes(search.toLowerCase()),
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleCreate = (data: CreateCompanyAgreementDto) => {
    createAgreement(data, {
      onSuccess: () => {
        toast.success('Agreement created');
        setPanelOpen(false);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to create agreement')),
    });
  };

  const handleDelete = (id: string) => {
    deleteAgreement(id, {
      onSuccess: () => toast.success('Agreement deleted'),
      onError: (err) => toast.error(extractError(err, 'Failed to delete agreement')),
    });
  };

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
        isLoading={isLoading}
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
            label: 'View',
            onClick: () => setViewAgreement(row),
          },
          {
            label: 'Delete',
            danger: true,
            onClick: () => handleDelete(row.id),
          },
        ]}
      />

      <AddAgreementPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={isCreating}
      />

      <AgreementViewModal
        isOpen={!!viewAgreement}
        agreement={viewAgreement}
        mode="view"
        onClose={() => setViewAgreement(null)}
      />
    </div>
  );
}
