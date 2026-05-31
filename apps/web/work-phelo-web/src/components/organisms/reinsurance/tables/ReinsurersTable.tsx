'use client';

import { useState, useMemo } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { AddReinsurancePanel } from '@/components/organisms/reinsurance/panels/AddReinsurancepanel';
import { EditReinsurancePanel } from '@/components/organisms/reinsurance/panels/EditReinsurancePanel';
import { AddContactPanel } from '@/components/organisms/reinsurance/panels/AddContactPanel';
import { useReinsurers, useDeleteReinsurer } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { Counterparty } from '@/types/reinsurance';
import { codeToCountry } from '@/lib/geo';

const PAGE_SIZE = 10;

/** Format the primary address as "Region, Country" or just "Country". */
function formatTerritory(addresses: Counterparty['addresses']): string {
  const primary = addresses.find((a) => a.isPrimary) ?? addresses[0];
  if (!primary) return '—';
  const country = codeToCountry(primary.country);
  return primary.state ? `${primary.state}, ${country}` : country;
}

const COLUMNS: Column<Counterparty>[] = [
  {
    key: 'name',
    label: 'Reinsurer Name',
    width: '2fr',
    render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
  },
  {
    key: 'email',
    label: 'Email',
    width: '2fr',
    render: (row) => <span className="text-gray-700">{row.email ?? '—'}</span>,
  },
  {
    key: 'phone',
    label: 'Phone Number',
    width: '1.5fr',
    render: (row) => <span className="text-gray-700">{row.phone ?? '—'}</span>,
  },
  {
    key: 'addresses',
    label: 'Territory',
    width: '1.5fr',
    render: (row) => <span className="text-gray-700">{formatTerritory(row.addresses)}</span>,
  },
  {
    key: 'brokerageFee',
    label: 'Brokerage Fee',
    width: '1fr',
    render: (row) => (
      <span className="text-gray-700">
        {row.brokerageFee != null ? `${row.brokerageFee}%` : '—'}
      </span>
    ),
  },
];

export function ReinsurersTable() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Counterparty | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Counterparty | null>(null);
  const [contactTarget, setContactTarget] = useState<Counterparty | null>(null);

  const { data = [], isLoading } = useReinsurers();
  const { mutate: deleteReinsurer, isPending: isDeleting } = useDeleteReinsurer();

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.email ?? '').toLowerCase().includes(q) ||
        (r.phone ?? '').includes(q),
    );
  }, [data, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleDelete = () => {
    if (!deleteTarget) return;
    deleteReinsurer(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Reinsurer archived successfully');
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to archive reinsurer')),
    });
  };

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search reinsurers…"
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        actionButton={{ label: 'Add Reinsurer', onClick: () => setPanelOpen(true) }}
        rowActions={(row) => [
          {
            label: 'Edit',
            onClick: () => setEditTarget(row),
          },
          {
            label: 'Add Contact',
            onClick: () => setContactTarget(row),
          },
          {
            label: 'Archive',
            onClick: () => setDeleteTarget(row),
            danger: true,
          },
        ]}
        emptyMessage="No reinsurers found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />

      <AddReinsurancePanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />

      <EditReinsurancePanel reinsurer={editTarget} onClose={() => setEditTarget(null)} />

      <AddContactPanel counterparty={contactTarget} onClose={() => setContactTarget(null)} />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Archive Reinsurer"
        description={`Are you sure you want to archive "${deleteTarget?.name}"? It will no longer appear in lists.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              loadingText="Archiving…"
              onClick={handleDelete}
            >
              Archive
            </Button>
          </div>
        }
      />
    </>
  );
}
