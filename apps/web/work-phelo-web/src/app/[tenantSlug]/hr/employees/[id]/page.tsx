// EMPLOYEE DETAILS PAGE //

'use client';

import { use, useState } from 'react';
import axios from 'axios';
import {
  useEmployee,
  useEmployeeOptions,
  useResendEmployeeInvite,
  useUpdateEmployee,
  useResignationRecord,
} from '@/hooks/hr/useEmployees';
import { useAssignAsset, useAvailableAssets } from '@/hooks/useAssets';
import { useToast } from '@/hooks/useToast';
import { usePermission } from '@/hooks/usePermission';
import { Permission } from '@/lib/permissionMap';
import {
  useAssignPermissionSet,
  usePermissionSets,
  useRemovePermissionSet,
  useUserPermissions,
} from '@/hooks/useRoles';
import { OffboardEmployeePanel } from '@/components/organisms/employee/OffboardEmployeePanel';
import { ResignationPanel } from '@/components/organisms/employee/resignationPanel';
import { EditEmployeePanel } from '@/components/organisms/employee/EditEmployeePanel';
import { AssignAssetPanel } from '@/components/organisms/employee/AssignAssetEmployeePanel';
import { EmployeePermissionsPanel } from '@/components/organisms/roles/EmployeePermissionsPanel';
import { AssignPermissionPanel } from '@/components/organisms/roles/assignPermissionPanel';
import { Breadcrumb } from '@/components/molecules/employees/employeebreadcrumps';
import { EmployeeActionsBar } from '@/components/molecules/employees/employeeActionBar';
import { EmployeeProfileCard } from '@/components/molecules/employees/employeeProfileCard';
import { EmploymentDetailsSection } from '@/components/molecules/employees/employeeDetailsSection';
import { AssetsSection } from '@/components/molecules/employees/assetSection';
import { BankingComplianceSection } from '@/components/molecules/employees/bankingComplianceSection';
import { EmergencyContactSection } from '@/components/molecules/employees/emergencyContactSection';
import { EmployeeDetailSkeleton } from '@/components/molecules/employees/employeeDetailSkeleton';

const NOTIFY_DELAY_MS = 30 * 60 * 1000;

export default function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; id: string }>;
}) {
  const { tenantSlug, id } = use(params);

  const [offboardOpen, setOffboardOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [assignAssetOpen, setAssignAssetOpen] = useState(false);
  const [permissionSetsOpen, setPermissionSetsOpen] = useState(false);
  const [assignPermOpen, setAssignPermOpen] = useState(false);
  const [resignOpen, setResignOpen] = useState(false);

  // Data fetching
  const { data: employee, isLoading, error } = useEmployee(id);
  const { data: resignationRecord } = useResignationRecord(id);
  const hrIsNotified =
    resignationRecord?.status === 'PENDING' &&
    // eslint-disable-next-line react-hooks/purity
    Date.now() - new Date(resignationRecord.submittedAt).getTime() >= NOTIFY_DELAY_MS;
  const { data: allHrResult = [] } = useEmployeeOptions();
  const { data: availableAssets = [] } = useAvailableAssets();
  const canGrantPermission = usePermission(Permission.GRANT_PERMISSION);
  const canAssignAsset = usePermission(Permission.ASSIGN_ASSET);
  const canEditEmployee = usePermission(Permission.UPDATE_EMPLOYEE);
  const canOffboardEmployee = usePermission(Permission.OFFBOARD_EMPLOYEE);
  const { data: permissionSets = [] } = usePermissionSets({
    enabled: canGrantPermission,
  });
  const allHrEmployees = allHrResult;

  const toast = useToast();
  const { mutate: resendInvite, isPending: isResending } = useResendEmployeeInvite();
  const { mutate: updateEmployee, isPending: isUpdating } = useUpdateEmployee();
  const { mutate: assignAsset } = useAssignAsset();
  const { mutate: assignPermissionSet, isPending: isAssigningPermissionSet } =
    useAssignPermissionSet();
  const { mutate: removePermissionSet, isPending: isRemovingPermissionSet } =
    useRemovePermissionSet();

  const { data: userPerms } = useUserPermissions(employee?.userId ?? '');
  const assignedSets = userPerms?.permissionSets ?? [];
  const customPermissionSets = permissionSets.filter((set) => !set.isSystem);

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

  const handleAssignPermissionSet = (permissionSetId: string) => {
    if (!employee?.userId) return;
    assignPermissionSet(
      { userId: employee.userId, permissionSetId },
      {
        onSuccess: () => toast.success('Permission set assigned successfully'),
        onError: () => toast.error('Failed to assign permission set'),
      },
    );
  };

  const handleRemovePermissionSet = (permissionSetId: string) => {
    if (!employee?.userId) return;
    removePermissionSet(
      { userId: employee.userId, permissionSetId },
      {
        onSuccess: () => toast.success('Permission set removed successfully'),
        onError: () => toast.error('Failed to remove permission set'),
      },
    );
  };

  const handleAssignAsset = (assetId: string) => {
    assignAsset(
      { assetId, employeeId: id },
      {
        onSuccess: () => {
          toast.success('Asset assigned successfully');
          setAssignAssetOpen(false);
        },
        onError: () => {
          toast.error('Failed to assign asset');
        },
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
        isPendingInvite={employee.userStatus === 'PENDING_VERIFICATION'}
        isOffboarded={employee.employmentStatus === 'OFFBOARDED'}
        resendInvite={handleResendInvite}
        isResending={isResending}
        onAssignAsset={canAssignAsset ? () => setAssignAssetOpen(true) : undefined}
        onAssignRole={
          employee.userId && canGrantPermission ? () => setPermissionSetsOpen(true) : undefined
        }
        onAssignPermission={
          employee.userId && canGrantPermission ? () => setAssignPermOpen(true) : undefined
        }
        onOffboard={canOffboardEmployee ? () => setOffboardOpen(true) : undefined}
        onResign={() => setResignOpen(true)}
        hasPendingResignation={hrIsNotified}
        onEdit={canEditEmployee ? () => setEditOpen(true) : undefined}
      />

      {/* Main Content */}
      <div className="flex gap-6 items-start">
        {/* Left Sidebar */}
        <EmployeeProfileCard employee={employee} roles={assignedSets.map((s) => s.name)} />

        {/* Right Sections */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <EmploymentDetailsSection employee={employee} allHrEmployees={allHrEmployees} />
          <BankingComplianceSection employee={employee} />
          <EmergencyContactSection employee={employee} />
          <AssetsSection assets={employee.assets || []} />
        </div>
      </div>

      {/* Side Panels */}
      <ResignationPanel
        isOpen={resignOpen}
        onClose={() => setResignOpen(false)}
        employee={employee}
        isHrView
        onAccept={() => setOffboardOpen(true)}
      />

      <OffboardEmployeePanel
        isOpen={offboardOpen}
        onClose={() => setOffboardOpen(false)}
        employeeId={id}
        employeeName={name}
        assignedAssets={employee.assets ?? []}
      />

      <EditEmployeePanel
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        employee={employee}
        employees={allHrEmployees}
        name={name}
        onSave={handleUpdateEmployee}
        isUpdating={isUpdating}
      />

      <AssignAssetPanel
        isOpen={assignAssetOpen}
        onClose={() => setAssignAssetOpen(false)}
        employeeName={name}
        availableAssets={availableAssets.map((asset) => ({
          id: asset.id,
          name: asset.name,
          type: asset.type,
          condition: asset.condition ?? 'GOOD',
          assetNumber: asset.assetNumber ?? '—',
        }))}
        onAssign={handleAssignAsset}
      />

      {employee.userId && (
        <EmployeePermissionsPanel
          isOpen={permissionSetsOpen}
          onClose={() => setPermissionSetsOpen(false)}
          employeeName={name}
          userId={employee.userId}
          availableSets={customPermissionSets}
          assignedSets={assignedSets.map((set) => ({ id: set.id, name: set.name }))}
          baseSetName={null}
          onAssign={handleAssignPermissionSet}
          onRemove={handleRemovePermissionSet}
          isAssigning={isAssigningPermissionSet}
          isRemoving={isRemovingPermissionSet}
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
