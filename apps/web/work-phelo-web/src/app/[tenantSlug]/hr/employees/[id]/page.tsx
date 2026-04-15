// EMPLOYEE DETAILS PAGE //

'use client';

import { use, useState } from 'react';
import {
  useEmployee,
  useEmployees,
  useResendEmployeeInvite,
  useUpdateEmployee,
} from '@/hooks/hr/useEmployees';
import { useDepartments } from '@/hooks/useDepartments';
import { useToast } from '@/hooks/useToast';
import { OffboardEmployeePanel } from '@/components/organisms/employee/OffboardEmployeePanel';
import { EditEmployeePanel } from '@/components/organisms/employee/EditEmployeePanel';
import { AssignAssetPanel } from '@/components/organisms/employee/AssignAssetEmployeePanel';
import { Breadcrumb } from '@/components/molecules/employees/employeebreadcrumps';
import { EmployeeActionsBar } from '@/components/molecules/employees/employeeActionBar';
import { EmployeeProfileCard } from '@/components/molecules/employees/employeeProfileCard';
import { EmploymentDetailsSection } from '@/components/molecules/employees/employeeDetailsSection';
import { AccountDetailsSection } from '@/components/molecules/employees/accountDetailSection';
import { AssetsSection } from '@/components/molecules/employees/assetSection';
import { EmployeeDetailSkeleton } from '@/components/molecules/employees/employeeDetailSkeleton';

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);

  const [offboardOpen, setOffboardOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [assignAssetOpen, setAssignAssetOpen] = useState(false);

  // Data fetching
  const { data: employee, isLoading } = useEmployee(id);
  const { data: departments = [] } = useDepartments();
  const { data: allHrResult } = useEmployees();
  const allHrEmployees = allHrResult?.data ?? [];

  const toast = useToast();
  const { mutate: resendInvite, isPending: isResending } = useResendEmployeeInvite();
  const { mutate: updateEmployee, isPending: isUpdating } = useUpdateEmployee();

  const handleResendInvite = () => {
    resendInvite(id, {
      onSuccess: () => toast.success('Invite resent successfully'),
      onError: () => toast.error('Failed to resend invite'),
    });
  };

  const handleUpdateEmployee = (data: import('@/types').UpdateEmployeePayload) => {
    updateEmployee(
      { id, ...data },
      {
        onSuccess: () => {
          toast.success('Employee updated successfully');
          setEditOpen(false);
        },
        onError: () => toast.error('Failed to update employee'),
      },
    );
  };

  if (isLoading) {
    return <EmployeeDetailSkeleton />;
  }

  if (!employee) {
    return <div className="p-8 text-center">Employee not found.</div>;
  }

  const name = `${employee.firstName} ${employee.lastName}`;

  return (
    <div className="p-8 flex flex-col gap-6 overflow-y-auto">
      {/* Breadcrumb */}
      <Breadcrumb tenantSlug={tenantSlug} name={name} />

      {/* Actions Bar */}
      <EmployeeActionsBar
        isPendingInvite={!employee.userId}
        isOffboarded={employee.employmentStatus === 'OFFBOARDED'}
        resendInvite={handleResendInvite}
        isResending={isResending}
        onAssignAsset={() => setAssignAssetOpen(true)}
        onOffboard={() => setOffboardOpen(true)}
        onEdit={() => setEditOpen(true)}
      />

      {/* Main Content */}
      <div className="flex gap-6 items-start">
        {/* Left Sidebar */}
        <EmployeeProfileCard employee={employee} />

        {/* Right Sections */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <EmploymentDetailsSection
            employee={employee}
            departments={departments}
            allHrEmployees={allHrEmployees}
          />
          <AccountDetailsSection employee={employee} />
          <AssetsSection assets={employee.assets || []} />
        </div>
      </div>

      {/* Side Panels */}
      <OffboardEmployeePanel
        isOpen={offboardOpen}
        onClose={() => setOffboardOpen(false)}
        employeeId={id}
        employeeName={name}
      />

      <EditEmployeePanel
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        employee={employee}
        departments={departments}
        name={name}
        onSave={handleUpdateEmployee}
        isUpdating={isUpdating}
      />

      <AssignAssetPanel
        isOpen={assignAssetOpen}
        onClose={() => setAssignAssetOpen(false)}
        employeeName={name}
        availableAssets={[]}
        onAssign={() => {}}
      />
    </div>
  );
}
