'use client';

import { useState, useMemo } from 'react';
import { MapPin } from 'lucide-react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { BranchFormPanel } from '@/components/organisms/branches/BranchFormPanel';
import { BranchMembersPanel } from '@/components/organisms/branches/BranchMembersPanel';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { useBranches, useDeleteBranch, useEmployees } from '@/hooks';
import type { Branch, Employee } from '@/types/hr';
import { useAuthStore } from '@/store/auth.store';

const PAGE_SIZE = 8;

function branchLocation(b: Branch) {
  return [b.city, b.region, b.country].filter(Boolean).join(', ') || '—';
}

function BranchStatus({
  count,
  isActive,
  isHeadOffice,
}: {
  count: number;
  isActive: boolean;
  isHeadOffice: boolean;
}) {
  if (isHeadOffice)
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#EEF1F8] text-[#0D2244]">
        Head Office
      </span>
    );
  if (!isActive)
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-600">
        Inactive
      </span>
    );
  if (count === 0)
    return (
      <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-500">
        Empty
      </span>
    );
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
      Active
    </span>
  );
}

export default function BranchesPage() {
  const toast = useToast();

  const user = useAuthStore((s) => s.user);
  const isEmployee = user?.role === 'EMPLOYEE' && !user?.isManager;

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

  const COLUMNS: Column<Branch>[] = [
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

  const { mutate: deleteBranch, isPending: isDeleting } = useDeleteBranch();

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
    <div className="p-8 flex flex-col gap-6 flex-1 min-h-0">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Branches</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Manage your company&apos;s office locations and branch members
        </p>
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        <DataTable
          columns={COLUMNS}
          data={pageData}
          isLoading={isLoading}
          searchPlaceholder="Search branches..."
          onSearch={(q) => {
            setSearch(q);
            setPage(1);
          }}
          {...(!isEmployee && {
            actionButton: { label: 'New Branch', onClick: () => setCreateOpen(true) },
          })}
          rowActions={
            isEmployee
              ? undefined
              : (row) => [
                  { label: 'Edit Branch', onClick: () => setEditTarget(row) },
                  { label: 'Add Members', onClick: () => setMembersTarget(row) },
                  { label: 'Delete Branch', danger: true, onClick: () => setDeleteTarget(row) },
                ]
          }
          emptyMessage="No branches found"
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>

      {!isEmployee && (
        <>
          <BranchFormPanel
            isOpen={createOpen}
            onClose={() => setCreateOpen(false)}
            employees={employees}
          />

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
        </>
      )}
    </div>
  );
}
