'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Avatar } from '@/components/atoms/Avatar';
import { Badge } from '@/components/atoms/Badge';

const PAGE_SIZE = 10;

export interface WarehouseStaffMember {
  id: string;
  name: string;
  role: string;
  email: string;
  phone: string;
  status: 'ACTIVE' | 'INACTIVE';
}

interface WarehouseStaffTableProps {
  /** Staff assigned to the warehouse. There is no source for this yet, so it defaults to none. */
  staff?: WarehouseStaffMember[];
}

/** Staff working in one warehouse. */
export function WarehouseStaffTable({ staff = [] }: WarehouseStaffTableProps) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const term = search.trim().toLowerCase();
  const filtered = staff.filter(
    (m) =>
      !term ||
      m.name.toLowerCase().includes(term) ||
      m.role.toLowerCase().includes(term) ||
      m.email.toLowerCase().includes(term),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<WarehouseStaffMember>[] = [
    {
      key: 'name',
      label: 'Name',
      width: 'minmax(180px, 2fr)',
      render: (row) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <Avatar name={row.name} size="sm" />
          <span className="font-bold text-gray-900 truncate">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'role',
      label: 'Role',
      width: 'minmax(120px, 1fr)',
      render: (row) => <span className="text-sm font-semibold text-gray-600">{row.role}</span>,
    },
    {
      key: 'email',
      label: 'Email',
      width: 'minmax(180px, 1.5fr)',
      render: (row) => <span className="text-sm text-gray-600 truncate">{row.email}</span>,
    },
    {
      key: 'phone',
      label: 'Phone',
      width: '140px',
      render: (row) => <span className="text-sm text-gray-600">{row.phone}</span>,
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
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      emptyMessage="No staff assigned to this warehouse"
      searchPlaceholder="Search by name, role or email..."
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
  );
}
