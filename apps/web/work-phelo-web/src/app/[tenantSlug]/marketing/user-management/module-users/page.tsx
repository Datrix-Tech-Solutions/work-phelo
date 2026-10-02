'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { TableButton } from '@/components/atoms/TableButton';
import { Modal } from '@/components/organisms/shared/Modal';
import { useRemovePermissionSet } from '@/hooks/hr/useRoles';
import {
  useMarketingModuleUsers,
  type MarketingModuleUser,
} from '@/hooks/marketing/useMarketingModuleUsers';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

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

export default function MarketingModuleUsersPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [revokeTarget, setRevokeTarget] = useState<MarketingModuleUser | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  const { users, isLoading } = useMarketingModuleUsers();
  const { mutateAsync: removePermissionSet } = useRemovePermissionSet();

  const term = search.trim().toLowerCase();
  const filtered = users.filter(
    (u) => !term || u.name.toLowerCase().includes(term) || u.email.toLowerCase().includes(term),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<MarketingModuleUser>[] = [
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
      key: 'roles',
      label: 'Roles',
      width: 'minmax(160px, 1.5fr)',
      render: (row) => (
        <span className="text-sm text-gray-600">{row.roles.map((r) => r.name).join(', ')}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '140px',
      render: (row) => <Badge variant={statusVariant(row.status)} label={row.status} />,
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

  // Revoking access removes the user from every marketing role they hold.
  const handleRevoke = async () => {
    if (!revokeTarget) return;
    setIsRevoking(true);
    try {
      await Promise.all(
        revokeTarget.roles.map((role) =>
          removePermissionSet({ userId: revokeTarget.id, permissionSetId: role.id }),
        ),
      );
      toast.success('Marketing access revoked');
      setRevokeTarget(null);
    } catch (err) {
      toast.error(extractError(err, 'Failed to revoke access'));
    } finally {
      setIsRevoking(false);
    }
  };

  return (
    <>
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

      <Modal
        isOpen={!!revokeTarget}
        onClose={() => setRevokeTarget(null)}
        title="Revoke Access"
        description={`Revoke ${revokeTarget?.name}'s marketing access? They will be removed from: ${revokeTarget?.roles.map((r) => r.name).join(', ')}.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isRevoking}
              loadingText="Revoking..."
              onClick={handleRevoke}
            >
              Revoke
            </Button>
          </div>
        }
      />
    </>
  );
}
