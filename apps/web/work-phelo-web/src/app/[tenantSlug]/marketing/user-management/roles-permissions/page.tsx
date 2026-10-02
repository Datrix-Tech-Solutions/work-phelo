'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ShieldCheck, Users } from 'lucide-react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';

interface RoleRow {
  id: string;
  name: string;
  members: number;
  description: string;
}

export default function MarketingRolesPermissionsPage() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const base = `/${tenantSlug}/marketing/user-management/roles-permissions`;

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const rows: RoleRow[] = [];

  const columns: Column<RoleRow>[] = [
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
          {row.members}
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      width: 'minmax(200px, 3fr)',
      className: 'overflow-hidden min-w-0 pr-4',
      render: (row) => (
        <span className="text-sm text-gray-500 block truncate">
          {row.description || <span className="text-gray-400 italic">No description</span>}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="shrink-0">
        {/* <h2 className="text-base font-semibold text-gray-900">Roles & Permissions</h2> */}
        <p className="font-semibold text-gray-600">
          Manage roles and control what each role can access
        </p>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        emptyMessage="No permission sets found"
        searchPlaceholder="Search permission sets..."
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
        totalPages={1}
        onPageChange={setPage}
        noInternalScroll
      />
    </div>
  );
}
