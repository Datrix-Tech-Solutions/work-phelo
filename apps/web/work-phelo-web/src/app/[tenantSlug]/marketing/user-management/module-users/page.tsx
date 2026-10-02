'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Button } from '@/components/atoms/Button';
import { TableButton } from '@/components/atoms/TableButton';
import { Modal } from '@/components/organisms/shared/Modal';

interface ModuleUserRow {
  id: string;
  name: string;
  email: string;
  department: string;
  roles: string[];
  status: string;
}

export default function MarketingModuleUsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [revokeTarget, setRevokeTarget] = useState<ModuleUserRow | null>(null);

  const rows: ModuleUserRow[] = [];

  const columns: Column<ModuleUserRow>[] = [
    {
      key: 'name',
      label: 'Name',
      width: 'minmax(150px, 0.8fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'email',
      label: 'Email',
      width: '150px',
      render: (row) => <span className="text-sm text-gray-600">{row.email}</span>,
    },
    {
      key: 'department',
      label: 'Department',
      width: 'minmax(140px, 1fr)',
      render: (row) => <span className="text-sm text-gray-600">{row.department || '—'}</span>,
    },
    {
      key: 'roles',
      label: 'Roles',
      width: 'minmax(160px, 1.5fr)',
      render: (row) => <span className="text-sm text-gray-600">{row.roles.join(', ') || '—'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      render: (row) => <span className="text-sm text-gray-600">{row.status}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 'minmax(140px, auto)',
      render: (row) => (
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <TableButton variant="red" onClick={() => setRevokeTarget(row)}>
            Revoke Access
          </TableButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="shrink-0">
          <p className="font-semibold text-gray-600">Users with module access</p>
        </div>

        <DataTable
          columns={columns}
          data={rows}
          emptyMessage="No module users found"
          searchPlaceholder="Search users..."
          searchValue={search}
          onSearch={(q) => {
            setSearch(q);
            setPage(1);
          }}
          currentPage={page}
          totalPages={1}
          onPageChange={setPage}
          noInternalScroll
        />
      </div>

      <Modal
        isOpen={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        title="Revoke Access"
        description={`Are you sure you want to revoke ${revokeTarget?.name}'s marketing access?`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => setRevokeTarget(null)}>
              Revoke
            </Button>
          </div>
        }
      />
    </>
  );
}
