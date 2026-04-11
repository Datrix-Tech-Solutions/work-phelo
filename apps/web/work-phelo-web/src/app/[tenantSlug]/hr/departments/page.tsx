// DEPARTMENT PAGE //

'use client';

import { use, useState } from 'react';
import { useDepartments } from '@/hooks/useDepartments';
import { useEmployees, useUpdateEmployee } from '@/hooks/useEmployees';
import { Department } from '@/types/hr';
import { useAuthStore } from '@/store/auth.store';
import { SuccessModal } from '@/components/organisms/shared/SuccessModal';
import { DepartmentsTable } from '@/components/organisms/departments/departmentTable';
import { CreateDepartmentPanel } from '@/components/organisms/departments/createDepartmentPanel';
import { EditDepartmentPanel } from '@/components/organisms/departments/editDepartmentPanel';
import { AddMembersPanel } from '@/components/organisms/departments/addMembersPanel';

export default function DepartmentsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = use(params);

  const user = useAuthStore((s) => s.user);
  const isEmployee = user?.role === 'EMPLOYEE' && !user?.isManager;

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Department | null>(null);
  const [membersTarget, setMembersTarget] = useState<Department | null>(null);
  const [successName, setSuccessName] = useState<string | null>(null);

  // Data fetching
  const { data: departments = [], isLoading } = useDepartments();
  const { data: empResult } = useEmployees({ limit: 500 });
  const employees = empResult?.data ?? [];

  // Mutations
  const { mutateAsync: updateEmployeeAsync } = useUpdateEmployee();

  const handleAddMembers = async (departmentId: string, employeeIds: string[]) => {
    await Promise.all(employeeIds.map((id) => updateEmployeeAsync({ id, departmentId })));
  };

  const openCreate = () => setCreateOpen(true);

  const openEdit = (dept: Department) => setEditTarget(dept);

  const openMembers = (dept: Department) => setMembersTarget(dept);

  return (
    <div className="p-8 flex flex-col gap-6 h-full">
      <DepartmentsTable
        departments={departments}
        isLoading={isLoading}
        isEmployee={isEmployee}
        onCreate={openCreate}
        onEdit={openEdit}
        onAddMembers={openMembers}
      />

      {/* Side Panels */}
      <CreateDepartmentPanel
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        tenantSlug={tenantSlug}
        onSuccess={(name) => setSuccessName(name)}
      />

      <EditDepartmentPanel
        isOpen={!!editTarget}
        onClose={() => setEditTarget(null)}
        tenantSlug={tenantSlug}
        editTarget={editTarget}
      />

      <AddMembersPanel
        isOpen={!!membersTarget}
        onClose={() => setMembersTarget(null)}
        department={membersTarget}
        employees={employees}
        onAddMembers={handleAddMembers}
      />

      <SuccessModal
        isOpen={!!successName}
        onClose={() => setSuccessName(null)}
        title="Department Created!"
        message={`"${successName}" has been added to your organisation.`}
      />
    </div>
  );
}
