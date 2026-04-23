// DEPARTMENT PAGE //

'use client';

import { use, useState } from 'react';
import { useDepartments, useUpdateDepartment, useDeleteDepartment } from '@/hooks/useDepartments';
import { useEmployees, useUpdateEmployee } from '@/hooks/hr/useEmployees';
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
  const [successName, setSuccessName] = useState<string | null>(null);

  // Data fetching
  const { data: departments = [], isLoading } = useDepartments();
  const { data: empResult } = useEmployees({ limit: 500 });
  const employees = empResult?.data ?? [];

  // Mutations
  const { mutateAsync: updateEmployeeAsync } = useUpdateEmployee();
  const { mutateAsync: updateDepartmentAsync } = useUpdateDepartment();
  const { mutate: deleteDepartment, isPending: isDeleting } = useDeleteDepartment();

  const handleAddMembers = async (departmentId: string, employeeIds: string[]) => {
    await Promise.all(
      employeeIds.map(async (empId) => {
        // If this employee is the head of a different department, clear that role first
        const oldDept = departments.find((d) => d.managerId === empId && d.id !== departmentId);
        if (oldDept) {
          await updateDepartmentAsync({ id: oldDept.id, managerId: null });
        }
        await updateEmployeeAsync({ id: empId, departmentId });
      }),
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
    <div className="p-8 flex flex-col gap-6 h-full">
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
      />

      {/* Side Panels */}
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

      {/* Delete confirmation */}
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
