// EMPLOYEE DETAILS PAGE //

'use client';

import { use, useState } from 'react';
import axios from 'axios';
import {
  useEmployee,
  useEmployees,
  useResendEmployeeInvite,
  useUpdateEmployee,
} from '@/hooks/hr/useEmployees';
import { useDepartments } from '@/hooks/useDepartments';
import { useBranches } from '@/hooks/useBranches';
import { useToast } from '@/hooks/useToast';
import {
  useCompanyRoles,
  useUserPermissions,
  useAssignRole,
  useUnassignRole,
} from '@/hooks/useRoles';
import { OffboardEmployeePanel } from '@/components/organisms/employee/OffboardEmployeePanel';
import { EditEmployeePanel } from '@/components/organisms/employee/EditEmployeePanel';
import { AssignAssetPanel } from '@/components/organisms/employee/AssignAssetEmployeePanel';
import { AssignRolePanel } from '@/components/organisms/roles/AssignRolePanel';
import { AssignPermissionPanel } from '@/components/organisms/roles/assignPermissionPanel';
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
  const [assignRoleOpen, setAssignRoleOpen] = useState(false);
  const [assignPermOpen, setAssignPermOpen] = useState(false);

  // Data fetching
  const { data: employee, isLoading, error } = useEmployee(id);
  const { data: departments = [] } = useDepartments();
  const { data: branches = [] } = useBranches();
  const { data: allHrResult } = useEmployees();
  const allHrEmployees = allHrResult?.data ?? [];

  const toast = useToast();
  const { mutate: resendInvite, isPending: isResending } = useResendEmployeeInvite();
  const { mutate: updateEmployee, isPending: isUpdating } = useUpdateEmployee();
  const { mutate: assignRole, isPending: isAssigningRole } = useAssignRole();
  const { mutate: unassignRole, isPending: isRemovingRole } = useUnassignRole();

  // Roles data
  const { data: rolesRaw = [] } = useCompanyRoles();
  const roles = Array.isArray(rolesRaw) ? rolesRaw : [];

  // /auth/permissions/users/:id is the authoritative source — always returns companyRole name
  // regardless of whether GET /auth/users includes the companyRole relation.
  const { data: userPerms } = useUserPermissions(employee?.userId ?? '');

  const currentRoleName = userPerms?.companyRole ?? null;
  const assignedSets = userPerms?.permissionSets ?? [];

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
    const status = axios.isAxiosError(error) ? error.response?.status : undefined;
    return (
      <div className="p-8 text-center">
        {status === 403
          ? "You don't have permission to access this. Contact your administrator."
          : 'Employee not found.'}
      </div>
    );
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
        onAssignRole={employee.userId ? () => setAssignRoleOpen(true) : undefined}
        onAssignPermission={employee.userId ? () => setAssignPermOpen(true) : undefined}
        onOffboard={() => setOffboardOpen(true)}
        onEdit={() => setEditOpen(true)}
      />

      {/* Main Content */}
      <div className="flex gap-6 items-start">
        {/* Left Sidebar */}
        <EmployeeProfileCard
          employee={employee}
          roles={[
            ...(currentRoleName ? [currentRoleName] : []),
            ...assignedSets.filter((s) => s.name !== `${currentRoleName} Set`).map((s) => s.name),
          ]}
        />

        {/* Right Sections */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <EmploymentDetailsSection
            employee={employee}
            departments={departments}
            allHrEmployees={allHrEmployees}
            currentRoleName={currentRoleName}
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
        branches={branches}
        employees={allHrEmployees}
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

      {employee.userId && (
        <AssignRolePanel
          isOpen={assignRoleOpen}
          onClose={() => setAssignRoleOpen(false)}
          employeeName={name}
          userId={employee.userId}
          assignedSets={assignedSets}
          roles={roles}
          isAssigning={isAssigningRole}
          isRemoving={isRemovingRole}
          onAssign={(roleId, userId) => {
            assignRole(
              { roleId, userId },
              {
                onSuccess: () => toast.success(`Role added to ${name}`),
                onError: () => toast.error('Failed to assign role'),
              },
            );
          }}
          onRemove={(roleId, userId) => {
            unassignRole(
              { roleId, userId },
              {
                onSuccess: () => toast.success(`Role removed from ${name}`),
                onError: () => toast.error('Failed to remove role'),
              },
            );
          }}
        />
      )}

      {employee.userId && (
        <AssignPermissionPanel
          isOpen={assignPermOpen}
          onClose={() => setAssignPermOpen(false)}
          employeeName={name}
          userId={employee.userId}
        />
      )}
    </div>
  );
}
