'use client';

import { useState } from 'react';
import { ShieldCheck, Users } from 'lucide-react';
import { extractError } from '@/lib/extractError';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import {
  CreateRolePanel,
  CreateRoleSubmitValues,
} from '@/components/organisms/roles/CreateRolePanel';
import { RolePermissionsPanel } from '@/components/organisms/roles/RolePermissionsPanel';
import { RoleMembersPanel } from '@/components/organisms/roles/RoleMembersPanel';
import { FeaturePermissions } from '@/components/molecules/roles/PermissionMatrix';
import {
  useCompanyRoles,
  useCreateCompanyRole,
  useUpdateCompanyRole,
  useDeleteCompanyRole,
} from '@/hooks/useTenants';
import { useToast } from '@/hooks/useToast';
import { transformFeaturePermissions } from '@/lib/permissionMap';

interface CompanyRole {
  id: string;
  name: string;
  description?: string | null;
  isSystem: boolean;
  isActive: boolean;
  _count?: { users: number };
}

export function RolesContent() {
  const toast = useToast();
  const [panelOpen, setPanelOpen] = useState(false);
  const [permissionsTarget, setPermissionsTarget] = useState<CompanyRole | null>(null);
  const [membersTarget, setMembersTarget] = useState<CompanyRole | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompanyRole | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data: rolesRaw = [], isLoading } = useCompanyRoles();
  const roles: CompanyRole[] = Array.isArray(rolesRaw) ? rolesRaw : [];

  const { mutate: createRole, isPending: isCreating } = useCreateCompanyRole();
  const { mutate: updateRole, isPending: isSavingPermissions } = useUpdateCompanyRole();
  const { mutate: deleteRole, isPending: isDeleting } = useDeleteCompanyRole();

  const filtered = roles.filter((r) =>
    search ? r.name.toLowerCase().includes(search.toLowerCase()) : true,
  );

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<CompanyRole>[] = [
    {
      key: 'name',
      label: 'Role Name',
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
          variant={row.isSystem ? 'info' : 'neutral'}
          label={row.isSystem ? 'System' : 'Custom'}
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

  const handleCreate = (values: CreateRoleSubmitValues) => {
    createRole(
      {
        name: values.name,
        description: values.description || undefined,
        permissions: transformFeaturePermissions(values.featurePermissions),
      },
      {
        onSuccess: () => {
          toast.success('Role created');
          setPanelOpen(false);
        },
        onError: (err) => toast.error(extractError(err, 'Failed to create role')),
      },
    );
  };

  const handleSavePermissions = (roleId: string, featurePermissions: FeaturePermissions) => {
    updateRole(
      { id: roleId, permissions: transformFeaturePermissions(featurePermissions) },
      {
        onSuccess: () => {
          toast.success('Permissions saved');
          setPermissionsTarget(null);
        },
        onError: (err) => toast.error(extractError(err, 'Failed to save permissions')),
      },
    );
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteRole(deleteTarget.id, {
      onSuccess: () => {
        toast.success('Role deleted');
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to delete role')),
    });
  };

  return (
    <>
      <div className="flex flex-col gap-6 h-full">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Roles & Permissions</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Manage roles and control what each role can access
            </p>
          </div>
          <Button onClick={() => setPanelOpen(true)}>+ New Role</Button>
        </div>

        {/* Table */}
        <DataTable
          columns={columns}
          data={paged}
          isLoading={isLoading}
          emptyMessage="No roles found"
          searchPlaceholder="Search roles..."
          searchValue={search}
          onSearch={(q) => {
            setSearch(q);
            setPage(1);
          }}
          currentPage={page}
          totalPages={totalPages}
          onPageChange={setPage}
          rowActions={(row) => [
            { label: 'View Members', onClick: () => setMembersTarget(row) },
            { label: 'Permissions', onClick: () => setPermissionsTarget(row) },
            ...(!row.isSystem
              ? [{ label: 'Delete', danger: true, onClick: () => setDeleteTarget(row) }]
              : []),
          ]}
        />
      </div>

      <CreateRolePanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={isCreating}
      />

      <RoleMembersPanel
        isOpen={!!membersTarget}
        onClose={() => setMembersTarget(null)}
        role={membersTarget}
      />

      <RolePermissionsPanel
        key={permissionsTarget?.id}
        isOpen={!!permissionsTarget}
        onClose={() => setPermissionsTarget(null)}
        role={permissionsTarget}
        onSave={handleSavePermissions}
        isSaving={isSavingPermissions}
      />

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
            <Button
              variant="danger"
              isLoading={isDeleting}
              loadingText="Deleting..."
              onClick={handleDeleteConfirm}
            >
              Delete Role
            </Button>
          </div>
        }
      />
    </>
  );
}
