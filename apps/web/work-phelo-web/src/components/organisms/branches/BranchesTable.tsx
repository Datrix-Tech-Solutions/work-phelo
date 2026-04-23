'use client';

import { useState, useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { BranchFormPanel } from '@/components/organisms/branches/BranchFormPanel';
import { BranchMembersPanel } from '@/components/organisms/branches/BranchMembersPanel';
import { BranchStatus } from '@/components/molecules/branches/BranchStatus';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { useBranches, useDeleteBranch, useEmployees } from '@/hooks';
import type { Branch, Employee } from '@/types/hr';
import { usePermission } from '@/hooks/usePermission';
import { Permission } from '@/lib/permissionMap';

const PAGE_SIZE = 8;

function branchLocation(b: Branch) {
  return [b.city, b.region, b.country].filter(Boolean).join(', ') || '—';
}

export function BranchesTable() {
  const toast = useToast();
  const canCreate = usePermission(Permission.CREATE_BRANCH);
  const canUpdate = usePermission(Permission.UPDATE_BRANCH);
  const canDelete = usePermission(Permission.DELETE_BRANCH);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Branch | null>(null);
  const [membersTarget, setMembersTarget] = useState<Branch | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Branch | null>(null);

  const { data: branches = [], isLoading } = useBranches();
  const { data: empResult } = useEmployees({ limit: 500 });
  const employees: Employee[] = useMemo(() => empResult?.data ?? [], [empResult?.data]);

  const employeeMap = useMemo(() => {
    const map = new Map<string, Employee>();
    employees.forEach((e) => map.set(e.id, e));
    return map;
  }, [employees]);

  const filtered = useMemo(() => {
    if (!search) return branches;
    const q = search.toLowerCase();
    return branches.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.city?.toLowerCase().includes(q) ||
        b.country?.toLowerCase().includes(q) ||
        b.code?.toLowerCase().includes(q),
    );
  }, [branches, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const { mutate: deleteBranch, isPending: isDeleting } = useDeleteBranch();

  const columns: Column<Branch>[] = [
    {
      key: 'name',
      label: 'Branch Name',
      width: '2fr',
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{row.name}</span>
          {row.code && (
            <span className="text-xs text-gray-400 font-mono bg-gray-100 px-1.5 py-0.5 rounded">
              {row.code}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      width: '2fr',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          {(row.city || row.country) && <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
          <span className="truncate">{branchLocation(row)}</span>
        </div>
      ),
    },
    {
      key: 'managerId',
      label: 'Branch Manager',
      width: '2fr',
      render: (row) => {
        const mgr = row.managerId ? employeeMap.get(row.managerId) : null;
        return mgr ? (
          <span className="text-sm text-gray-900">
            {mgr.firstName} {mgr.lastName}
          </span>
        ) : (
          <span className="text-sm text-gray-400">—</span>
        );
      },
    },
    {
      key: '_count',
      label: 'Members',
      width: '80px',
      render: (row) => (
        <span className="text-sm font-medium text-gray-700">{row._count?.employees ?? 0}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '120px',
      render: (row) => (
        <BranchStatus
          count={row._count?.employees ?? 0}
          isActive={row.isActive}
          isHeadOffice={row.isHeadOffice}
        />
      ),
    },
  ];

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteBranch(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Branch deleted');
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to delete branch')),
    });
  };

  return (
    <>
      <DataTable
        columns={columns}
        data={pageData}
        isLoading={isLoading}
        searchPlaceholder="Search branches..."
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        {...(canCreate && {
          actionButton: { label: 'New Branch', onClick: () => setCreateOpen(true) },
        })}
        rowActions={
          canUpdate || canDelete
            ? (row) => [
                ...(canUpdate
                  ? [
                      { label: 'Edit Branch', onClick: () => setEditTarget(row) },
                      { label: 'Add Members', onClick: () => setMembersTarget(row) },
                    ]
                  : []),
                ...(canDelete
                  ? [
                      {
                        label: 'Delete Branch',
                        danger: true,
                        onClick: () => setDeleteTarget(row),
                      },
                    ]
                  : []),
              ]
            : undefined
        }
        emptyMessage="No branches found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      {(canCreate || canUpdate || canDelete) && (
        <>
          {canCreate && (
            <BranchFormPanel
              isOpen={createOpen}
              onClose={() => setCreateOpen(false)}
              employees={employees}
            />
          )}
          {canUpdate && (
            <>
              <BranchFormPanel
                isOpen={!!editTarget}
                onClose={() => setEditTarget(null)}
                branch={editTarget}
                employees={employees}
              />
              <BranchMembersPanel
                isOpen={!!membersTarget}
                onClose={() => setMembersTarget(null)}
                branch={membersTarget}
                employees={employees}
              />
            </>
          )}
          {canDelete && (
            <Modal
              isOpen={!!deleteTarget}
              onClose={() => setDeleteTarget(null)}
              title="Delete Branch"
              description={`Delete "${deleteTarget?.name}"? This cannot be undone. Employees assigned to this branch will be unassigned.`}
              footer={
                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    isLoading={isDeleting}
                    loadingText="Deleting…"
                    onClick={confirmDelete}
                  >
                    Delete Branch
                  </Button>
                </div>
              }
            />
          )}
        </>
      )}
    </>
  );
}
