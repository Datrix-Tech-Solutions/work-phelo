'use client';

import { useState } from 'react';
import { ShieldCheck, Users, Layers } from 'lucide-react';
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
import {
  CreatePermissionSetPanel,
  PermissionSetSubmitValues,
} from '@/components/organisms/roles/CreatePermissionSetPanel';
import { FeaturePermissions } from '@/components/molecules/roles/PermissionMatrix';
import {
  useCompanyRoles,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  usePermissionSets,
  useCreatePermissionSet,
  useUpdatePermissionSet,
} from '@/hooks/useRoles';
import { useToast } from '@/hooks/useToast';
import { transformFeaturePermissions } from '@/lib/permissionMap';
import type { CompanyRole, PermissionSet } from '@/types/roles';
import { cn } from '@/lib/utils';

type Tab = 'roles' | 'permission-sets';

export function RolesContent() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<Tab>('roles');

  // ── Roles state ───────────────────────────────────────────
  const [panelOpen, setPanelOpen] = useState(false);
  const [permissionsTarget, setPermissionsTarget] = useState<CompanyRole | null>(null);
  const [membersTarget, setMembersTarget] = useState<CompanyRole | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompanyRole | null>(null);
  const [rolesSearch, setRolesSearch] = useState('');
  const [rolesPage, setRolesPage] = useState(1);

  // ── Permission Sets state ─────────────────────────────────
  const [setsPanelOpen, setSetsPanelOpen] = useState(false);
  const [editPermSet, setEditPermSet] = useState<PermissionSet | null>(null);
  const [setsSearch, setSetsSearch] = useState('');
  const [setsPage, setSetsPage] = useState(1);

  // ── Data ──────────────────────────────────────────────────
  const { data: rolesRaw = [], isLoading: rolesLoading } = useCompanyRoles();
  const roles: CompanyRole[] = Array.isArray(rolesRaw) ? rolesRaw : [];

  const { data: permSetsRaw = [], isLoading: setsLoading } = usePermissionSets();
  const permSets: PermissionSet[] = Array.isArray(permSetsRaw) ? permSetsRaw : [];

  // ── Mutations ─────────────────────────────────────────────
  const { mutate: createRole, isPending: isCreating } = useCreateRole();
  const { mutate: updateRole, isPending: isSavingPermissions } = useUpdateRole();
  const { mutate: deleteRole, isPending: isDeleting } = useDeleteRole();
  const { mutate: createPermSet, isPending: isCreatingSet } = useCreatePermissionSet();
  const { mutate: updatePermSet, isPending: isUpdatingSet } = useUpdatePermissionSet();

  // ── Roles table ───────────────────────────────────────────
  const PAGE_SIZE = 10;

  const filteredRoles = roles.filter((r) =>
    rolesSearch ? r.name.toLowerCase().includes(rolesSearch.toLowerCase()) : true,
  );
  const rolesTotalPages = Math.max(1, Math.ceil(filteredRoles.length / PAGE_SIZE));
  const pagedRoles = filteredRoles.slice((rolesPage - 1) * PAGE_SIZE, rolesPage * PAGE_SIZE);

  const roleColumns: Column<CompanyRole>[] = [
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

  // ── Permission Sets table ─────────────────────────────────
  const filteredSets = permSets.filter((s) =>
    setsSearch ? s.name.toLowerCase().includes(setsSearch.toLowerCase()) : true,
  );
  const setsTotalPages = Math.max(1, Math.ceil(filteredSets.length / PAGE_SIZE));
  const pagedSets = filteredSets.slice((setsPage - 1) * PAGE_SIZE, setsPage * PAGE_SIZE);

  const setColumns: Column<PermissionSet>[] = [
    {
      key: 'name',
      label: 'Set Name',
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 text-brand" />
          </div>
          <span className="font-medium text-gray-900">{row.name}</span>
        </div>
      ),
    },
    {
      key: 'resources',
      label: 'Permissions',
      width: '130px',
      render: (row) => (
        <span className="text-sm text-gray-600">{row.resources.length} entries</span>
      ),
    },
    {
      key: 'members',
      label: 'Assigned To',
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

  // ── Handlers ──────────────────────────────────────────────
  const handleCreateRole = (values: CreateRoleSubmitValues) => {
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

  const handleCreatePermSet = (values: PermissionSetSubmitValues) => {
    createPermSet(values, {
      onSuccess: () => {
        toast.success('Permission set created');
        setSetsPanelOpen(false);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to create permission set')),
    });
  };

  const handleUpdatePermSet = (values: PermissionSetSubmitValues) => {
    if (!editPermSet) return;
    updatePermSet(
      { id: editPermSet.id, ...values },
      {
        onSuccess: () => {
          toast.success('Permission set updated');
          setEditPermSet(null);
        },
        onError: (err) => toast.error(extractError(err, 'Failed to update permission set')),
      },
    );
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
          {activeTab === 'roles' ? (
            <Button onClick={() => setPanelOpen(true)}>+ New Role</Button>
          ) : (
            <Button onClick={() => setSetsPanelOpen(true)}>+ New Set</Button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-gray-200 shrink-0">
          {(['roles', 'permission-sets'] as Tab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                activeTab === tab
                  ? 'border-brand text-brand'
                  : 'border-transparent text-gray-500 hover:text-gray-700',
              )}
            >
              {tab === 'roles' ? 'Company Roles' : 'Permission Sets'}
            </button>
          ))}
        </div>

        {/* Roles Tab */}
        {activeTab === 'roles' && (
          <DataTable
            columns={roleColumns}
            data={pagedRoles}
            isLoading={rolesLoading}
            emptyMessage="No roles found"
            searchPlaceholder="Search roles..."
            searchValue={rolesSearch}
            onSearch={(q) => {
              setRolesSearch(q);
              setRolesPage(1);
            }}
            currentPage={rolesPage}
            totalPages={rolesTotalPages}
            onPageChange={setRolesPage}
            rowActions={(row) => [
              { label: 'View Members', onClick: () => setMembersTarget(row) },
              { label: 'Permissions', onClick: () => setPermissionsTarget(row) },
              ...(!row.isSystem
                ? [{ label: 'Delete', danger: true, onClick: () => setDeleteTarget(row) }]
                : []),
            ]}
          />
        )}

        {/* Permission Sets Tab */}
        {activeTab === 'permission-sets' && (
          <DataTable
            columns={setColumns}
            data={pagedSets}
            isLoading={setsLoading}
            emptyMessage="No permission sets found"
            searchPlaceholder="Search permission sets..."
            searchValue={setsSearch}
            onSearch={(q) => {
              setSetsSearch(q);
              setSetsPage(1);
            }}
            currentPage={setsPage}
            totalPages={setsTotalPages}
            onPageChange={setSetsPage}
            rowActions={(row) => [{ label: 'Edit', onClick: () => setEditPermSet(row) }]}
          />
        )}
      </div>

      {/* Roles panels */}
      <CreateRolePanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        onSubmit={handleCreateRole}
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

      {/* Permission Sets panels */}
      <CreatePermissionSetPanel
        isOpen={setsPanelOpen}
        onClose={() => setSetsPanelOpen(false)}
        onSubmit={handleCreatePermSet}
        isSubmitting={isCreatingSet}
      />

      <CreatePermissionSetPanel
        isOpen={!!editPermSet}
        onClose={() => setEditPermSet(null)}
        onSubmit={handleUpdatePermSet}
        isSubmitting={isUpdatingSet}
        editTarget={editPermSet}
      />
    </>
  );
}
