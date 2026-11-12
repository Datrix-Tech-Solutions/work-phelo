'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { TableButton } from '@/components/atoms/TableButton';
import { DeleteInventoryRecordModal } from '@/components/organisms/inventory/DeleteInventoryRecordModal';
import { PartyModal } from '@/components/organisms/inventory/PartyModal';
import {
  useInventoryParties,
  type InventoryParty,
  type PartyKind,
} from '@/hooks/inventory/useInventoryParties';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

const PAGE_SIZE = 10;

const TITLE: Record<PartyKind, { plural: string; noun: string }> = {
  CUSTOMER: { plural: 'Customers', noun: 'Customer' },
  SUPPLIER: { plural: 'Suppliers', noun: 'Supplier' },
};

const dash = <span className="text-gray-400">—</span>;

/** The Customers and Suppliers tabs: the same list and form, for one kind of party. */
export function PartiesPage({ kind }: { kind: PartyKind }) {
  const { plural, noun } = TITLE[kind];
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  // The dashboard's "Add Supplier / Customer" shortcuts arrive with ?new=1.
  const [modalOpen, setModalOpen] = useState(useSearchParams().get('new') === '1');

  const [editTarget, setEditTarget] = useState<InventoryParty | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<InventoryParty | null>(null);
  const toast = useToast();
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const { parties, isLoading, deleteParty, isPending } = useInventoryParties(kind);

  const term = search.trim().toLowerCase();
  const filtered = parties.filter(
    (p) =>
      !term ||
      p.name.toLowerCase().includes(term) ||
      p.contactPerson?.toLowerCase().includes(term) ||
      p.email?.toLowerCase().includes(term) ||
      p.phone?.toLowerCase().includes(term),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<InventoryParty>[] = [
    {
      key: 'name',
      label: `${noun} Name`,
      width: 'minmax(180px, 1.5fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'contactPerson',
      label: 'Contact Person',
      width: 'minmax(140px, 1fr)',
      render: (row) => <span className="text-sm text-gray-600">{row.contactPerson ?? dash}</span>,
    },
    {
      key: 'phone',
      label: 'Phone',
      width: '150px',
      render: (row) => <span className="text-sm text-gray-600">{row.phone ?? dash}</span>,
    },
    {
      key: 'email',
      label: 'Email',
      width: 'minmax(180px, 1.5fr)',
      className: 'overflow-hidden min-w-0 pr-4',
      render: (row) => (
        <span className="text-sm text-gray-600 block truncate" title={row.email ?? undefined}>
          {row.email ?? dash}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      render: (row) => (
        <Badge
          variant={row.status === 'ACTIVE' ? 'success' : 'neutral'}
          label={row.status === 'ACTIVE' ? 'Active' : 'Inactive'}
        />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 'minmax(160px, auto)',
      render: (row) => (
        <div className="flex items-center gap-3.5" onClick={(e) => e.stopPropagation()}>
          <TableButton variant="blue" onClick={() => setEditTarget(row)}>
            Edit
          </TableButton>
          <TableButton variant="red" onClick={() => setDeleteTarget(row)}>
            Delete
          </TableButton>
        </div>
      ),
    },
  ];

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteParty(deleteTarget.id);
    } catch (err) {
      toast.error(extractError(err, `Could not delete ${noun.toLowerCase()}`));
      return;
    }
    toast.success(`${noun} deleted successfully`);
    setDeleteTarget(null);
  };

  return (
    <div className="flex flex-col gap-2">
      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyMessage={`No ${plural.toLowerCase()} found`}
        searchPlaceholder={`Search ${plural.toLowerCase()}...`}
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{ label: `Add ${noun}`, onClick: () => setModalOpen(true) }}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onRowClick={(row) =>
          router.push(`/${tenantSlug}/operations/inventory/suppliers-customers/${row.id}`)
        }
        noInternalScroll
      />

      <PartyModal
        kind={kind}
        isOpen={modalOpen || !!editTarget}
        onClose={() => {
          setModalOpen(false);
          setEditTarget(null);
        }}
        party={editTarget}
      />
      <DeleteInventoryRecordModal
        kind={noun}
        name={deleteTarget?.name ?? null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isDeleting={isPending}
      />
    </div>
  );
}
