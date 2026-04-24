'use client';

import { useState } from 'react';
import { ShieldCheck, Users } from 'lucide-react';
import { extractError } from '@/lib/extractError';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import {
  CreatePermissionSetPanel,
  PermissionSetSubmitValues,
} from '@/components/organisms/roles/CreatePermissionSetPanel';
import {
  usePermissionSets,
  useCreatePermissionSet,
  useUpdatePermissionSet,
} from '@/hooks/useRoles';
import { useToast } from '@/hooks/useToast';
import type { PermissionSet } from '@/types/roles';
import { api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

export function RolesContent() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const [panelOpen, setPanelOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PermissionSet | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PermissionSet | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: setsRaw = [], isLoading } = usePermissionSets();
  const sets: PermissionSet[] = Array.isArray(setsRaw) ? setsRaw : [];

  const { mutate: createSet, isPending: isCreating } = useCreatePermissionSet();
  const { mutate: updateSet, isPending: isSaving } = useUpdatePermissionSet();

  const PAGE_SIZE = 10;
  const filtered = sets.filter((s) =>
    search ? s.name.toLowerCase().includes(search.toLowerCase()) : true,
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<PermissionSet>[] = [
    {
      key: 'name',
      label: 'Permission Set',
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
      key: 'type',
      label: 'Type',
      width: '120px',
      render: (row) => (
        <Badge
          variant={(row as any).isSystem ? 'info' : 'neutral'}
          label={(row as any).isSystem ? 'System' : 'Custom'}
        />
      ),
    },
    {
      key: 'members',
      label: 'Members',
      width: '120px',
      render: (row) => (
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <Users className="w-3.5 h-3.5 text-gray-400" />
          {row._count?.users ?? 0}
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      render: (row) => (
        <span className="text-sm text-gray-500 truncate">
          {row.description || <span className="text-gray-300 italic">No description</span>}
        </span>
      ),
    },
  ];

  const handleCreate = (values: PermissionSetSubmitValues) => {
    createSet(
      { name: values.name, description: values.description, resources: values.resources as any },
      {
        onSuccess: () => {
          toast.success('Permission set created');
          setPanelOpen(false);
        },
        onError: (err) => toast.error(extractError(err, 'Failed to create permission set')),
      },
    );
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await api.delete(`/auth/permissions/sets/${deleteTarget.id}`);
      queryClient.invalidateQueries({ queryKey: ['permissions', 'sets'] });
      toast.success('Permission set deleted');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(extractError(err, 'Failed to delete permission set'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex flex-col gap-6 h-full">
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Permission Sets</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Manage permission sets and control what each set can access
            </p>
          </div>
          <Button onClick={() => setPanelOpen(true)}>+ New Permission Set</Button>
        </div>

        <DataTable
          columns={columns}
          data={paged}
          isLoading={isLoading}
          emptyMessage="No permission sets found"
          searchPlaceholder="Search permission sets..."
          searchValue={search}
          onSearch={(q) => {
            setSearch(q);
            setPage(1);
          }}
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          rowActions={(row) => [
            ...((row as any).isSystem
              ? []
              : [
                  { label: 'Edit', onClick: () => setEditTarget(row) },
                  { label: 'Delete', danger: true, onClick: () => setDeleteTarget(row) },
                ]),
          ]}
        />
      </div>

      <CreatePermissionSetPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={isCreating}
      />

      {editTarget && (
        <CreatePermissionSetPanel
          key={editTarget.id}
          isOpen={!!editTarget}
          onClose={() => setEditTarget(null)}
          editTarget={editTarget}
          onSubmit={(values) => {
            updateSet(
              {
                id: editTarget.id,
                name: values.name,
                description: values.description,
                resources: values.resources as any,
              },
              {
                onSuccess: () => {
                  toast.success('Permission set updated');
                  setEditTarget(null);
                },
                onError: (err) => toast.error(extractError(err, 'Failed to update permission set')),
              },
            );
          }}
          isSubmitting={isSaving}
        />
      )}

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Permission Set"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isDeleting}
              loadingText="Deleting..."
              onClick={handleDeleteConfirm}
            >
              Delete
            </Button>
          </div>
        }
      />
    </>
  );
}
