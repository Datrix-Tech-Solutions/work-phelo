'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ShieldCheck, Users } from 'lucide-react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';

interface OperationsRole {
  id: string;
  name: string;
  description?: string;
  membersCount: number;
  isSystem?: boolean;
}

// Not wired to a backend yet.
const MOCK_ROLES: OperationsRole[] = [];

const PAGE_SIZE = 10;

export function RolesPermissionsTable() {
  const router = useRouter();
  const params = useParams<{ tenantSlug: string }>();
  const base = `/${params.tenantSlug}/operations/reinsurance/settings/rolespermissions`;

  const [roles, setRoles] = useState<OperationsRole[]>(MOCK_ROLES);
  const [deleteTarget, setDeleteTarget] = useState<OperationsRole | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const filtered = roles.filter((r) =>
    search ? r.name.toLowerCase().includes(search.toLowerCase()) : true,
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<OperationsRole>[] = [
    {
      key: 'name',
      label: 'Roles',
      width: 'minmax(150px, 0.5fr)',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-brand" />
          </div>
          <span className="font-medium text-gray-900">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'members',
      label: 'Members',
      width: '70px',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <Users className="w-3.5 h-3.5 text-gray-400" />
          {row.membersCount}
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      width: 'minmax(200px, 3fr)',
      className: 'overflow-hidden min-w-0 pr-4',
      render: (row) => (
        <span
          className="text-sm text-gray-500 block truncate max-w-xs lg:max-w-sm xl:max-w-md"
          title={row.description ?? undefined}
        >
          {row.description || <span className="text-gray-400 italic">No description</span>}
        </span>
      ),
    },
  ];

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    setRoles((prev) => prev.filter((r) => r.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <>
      <div className="flex flex-col gap-6">
        <div className="shrink-0">
          <h2 className="text-base font-semibold text-gray-900">Roles & Permissions</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage roles and control what each role can access within reinsurance operations
          </p>
        </div>

        <DataTable
          columns={columns}
          data={paged}
          emptyMessage="No roles found"
          searchPlaceholder="Search roles..."
          searchValue={search}
          onSearch={(q) => {
            setSearch(q);
            setPage(1);
          }}
          actionButton={{
            label: 'Create New Role',
            onClick: () => router.push(`${base}/new`),
          }}
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          noInternalScroll
          rowActions={(row) => [
            { label: 'Edit', onClick: () => router.push(`${base}/${row.id}/edit`) },
            ...(row.isSystem
              ? []
              : [{ label: 'Delete', danger: true, onClick: () => setDeleteTarget(row) }]),
          ]}
        />
      </div>

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Role"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </div>
        }
      />
    </>
  );
}
