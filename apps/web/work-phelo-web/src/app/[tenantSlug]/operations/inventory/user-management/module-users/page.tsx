'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import {
  useInventoryModuleUsers,
  type InventoryModuleUser,
} from '@/hooks/inventory/useInventoryModuleUsers';

const PAGE_SIZE = 10;

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'PENDING_VERIFICATION':
      return 'warning';
    case 'SUSPENDED':
    case 'INACTIVE':
      return 'danger';
    default:
      return 'neutral';
  }
}

export default function InventoryModuleUsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { users, isLoading } = useInventoryModuleUsers();

  const term = search.trim().toLowerCase();
  const filtered = users.filter(
    (u) => !term || u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<InventoryModuleUser>[] = [
    {
      key: 'name',
      label: 'Name',
      width: 'minmax(150px, 0.8fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'email',
      label: 'Email',
      width: 'minmax(180px, 1fr)',
      render: (row) => <span className="text-sm text-gray-600 truncate">{row.email}</span>,
    },
    {
      key: 'department',
      label: 'Department',
      width: 'minmax(140px, 1fr)',
      render: (row) => <span className="text-sm text-gray-600">{row.department || '—'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      width: '140px',
      render: (row) => <Badge variant={statusVariant(row.status)} label={row.status} />,
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="shrink-0">
        <h2 className="text-base font-semibold text-gray-900">Module Users</h2>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        isLoading={isLoading}
        emptyMessage="No module users found"
        searchPlaceholder="Search users..."
        searchValue={search}
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
        noInternalScroll
      />
    </div>
  );
}
