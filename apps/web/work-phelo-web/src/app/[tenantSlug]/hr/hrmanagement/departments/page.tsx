'use client';

import { use, useState } from 'react';
import { useDepartments, useUpdateDepartment, useDeleteDepartment } from '@/hooks/useDepartments';
import { useEmployeeOptions, useUpdateEmployee } from '@/hooks/hr/useEmployees';
import { Department } from '@/types/hr';
import { usePermission } from '@/hooks/usePermission';
import { Permission } from '@/lib/permissionMap';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { SuccessModal } from '@/components/organisms/shared/SuccessModal';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { DepartmentsTable } from '@/components/organisms/departments/departmentTable';
import { CreateDepartmentPanel } from '@/components/organisms/departments/createDepartmentPanel';
import { EditDepartmentPanel } from '@/components/organisms/departments/editDepartmentPanel';
import { AddMembersPanel } from '@/components/organisms/departments/addMembersPanel';

export default function DepartmentsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);
  const toast = useToast();

  const canCreate = usePermission(Permission.CREATE_DEPARTMENT);
  const canUpdate = usePermission(Permission.UPDATE_DEPARTMENT);
  const canDelete = usePermission(Permission.DELETE_DEPARTMENT);

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Department | null>(null);
  const [membersTarget, setMembersTarget] = useState<Department | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [toggleActiveTarget, setToggleActiveTarget] = useState<Department | null>(null);
  const [successName, setSuccessName] = useState<string | null>(null);

  const { data: departments = [], isLoading } = useDepartments();
  const { data: employees = [] } = useEmployeeOptions();

  const { mutateAsync: updateEmployeeAsync } = useUpdateEmployee();
  const { mutateAsync: updateDepartmentAsync } = useUpdateDepartment();
  const { mutate: deleteDepartment, isPending: isDeleting } = useDeleteDepartment();
  const { mutate: updateDepartment, isPending: isTogglingActive } = useUpdateDepartment();

  const handleAddMembers = async (departmentId: string, employeeIds: string[]) => {
    await Promise.all(
      employeeIds.map(async (empId) => {
        const oldDept = departments.find((d) => d.managerId === empId && d.id !== departmentId);
        if (oldDept) {
          await updateDepartmentAsync({ id: oldDept.id, managerId: null });
        }
        await updateEmployeeAsync({ id: empId, departmentId });
      }),
    );
  };

  const handleToggleActiveConfirm = () => {
    if (!toggleActiveTarget) return;
    updateDepartment(
      { id: toggleActiveTarget.id, isActive: !toggleActiveTarget.isActive },
      {
        onSuccess: () => {
          toast.success(
            toggleActiveTarget.isActive
              ? `"${toggleActiveTarget.name}" deactivated`
              : `"${toggleActiveTarget.name}" activated`,
          );
          setToggleActiveTarget(null);
        },
        onError: (err) => toast.error(extractError(err, 'Failed to update department')),
      },
    );
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteDepartment(deleteTarget.id, {
      onSuccess: () => {
        toast.success(`"${deleteTarget.name}" deleted`);
        setDeleteTarget(null);
      },
      onError: (err) => toast.error(extractError(err, 'Failed to delete department')),
    });
  };

  return (
    <div className="flex flex-col gap-6 h-full">
      <DepartmentsTable
        departments={departments}
        employees={employees}
        isLoading={isLoading}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
        onCreate={() => setCreateOpen(true)}
        onEdit={(dept) => setEditTarget(dept)}
        onAddMembers={(dept) => setMembersTarget(dept)}
        onDelete={(dept) => setDeleteTarget(dept)}
        onToggleActive={(dept) => setToggleActiveTarget(dept)}
      />

      {canCreate && (
        <CreateDepartmentPanel
          isOpen={createOpen}
          onClose={() => setCreateOpen(false)}
          tenantSlug={tenantSlug}
          employees={employees}
          onSuccess={(name) => setSuccessName(name)}
        />
      )}

      {canUpdate && (
        <EditDepartmentPanel
          isOpen={!!editTarget}
          onClose={() => setEditTarget(null)}
          editTarget={editTarget}
        />
      )}

      {canUpdate && (
        <AddMembersPanel
          isOpen={!!membersTarget}
          onClose={() => setMembersTarget(null)}
          department={membersTarget}
          employees={employees}
          onAddMembers={handleAddMembers}
        />
      )}

      {canUpdate && (
        <Modal
          isOpen={!!toggleActiveTarget}
          onClose={() => setToggleActiveTarget(null)}
          title={toggleActiveTarget?.isActive ? 'Deactivate Department' : 'Activate Department'}
          description={
            toggleActiveTarget?.isActive
              ? `Are you sure you want to deactivate "${toggleActiveTarget?.name}"? Members will remain assigned but the department will be marked inactive.`
              : `Are you sure you want to activate "${toggleActiveTarget?.name}"?`
          }
          footer={
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setToggleActiveTarget(null)}>
                Cancel
              </Button>
              <Button
                variant={toggleActiveTarget?.isActive ? 'danger' : 'primary'}
                isLoading={isTogglingActive}
                loadingText={toggleActiveTarget?.isActive ? 'Deactivating...' : 'Activating...'}
                onClick={handleToggleActiveConfirm}
              >
                {toggleActiveTarget?.isActive ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          }
        />
      )}

      {canDelete && (
        <Modal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          title="Delete Department"
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
                Delete Department
              </Button>
            </div>
          }
        />
      )}

      <SuccessModal
        isOpen={!!successName}
        onClose={() => setSuccessName(null)}
        title="Department Created!"
        message={`"${successName}" has been added to your organisation.`}
      />
    </div>
  );
}
