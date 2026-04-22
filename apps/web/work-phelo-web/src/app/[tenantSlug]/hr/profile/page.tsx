// EMPLOYEE SELF-PROFILE PAGE //

'use client';

import { useState } from 'react';
import { useMyProfile, useUpdateEmployee } from '@/hooks/hr/useEmployees';
import { useUserPermissions } from '@/hooks/useRoles';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { EmployeeProfileCard } from '@/components/molecules/employees/employeeProfileCard';
import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { DetailField } from '@/components/molecules/shared/DetailField';
import { Button } from '@/components/atoms/Button';
import { EditMyProfilePanel } from '@/components/organisms/employee/EditMyProfilePanel';
import { EmployeeDetailSkeleton } from '@/components/molecules/employees/employeeDetailSkeleton';
import type { UpdateEmployeePayload } from '@/types/hr';
import { ResignationPanel } from '@/components/organisms/employee/resignationPanel';

function formatDate(iso?: string | null) {
  if (!iso) return undefined;
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatEnum(val?: string | null) {
  if (!val) return undefined;
  return val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
export default function MyProfilePage() {
  const [editOpen, setEditOpen] = useState(false);
  const [resignOpen, setResignOpen] = useState(false);
  const toast = useToast();

  const { data: employee, isLoading } = useMyProfile();
  const { mutate: updateEmployee, isPending: isUpdating } = useUpdateEmployee();

  const { data: userPermsRaw } = useUserPermissions(employee?.userId ?? '');
  const userPerms = userPermsRaw as
    | {
        companyRole?: string | null;
        permissionSets?: { id: string; name: string }[];
      }
    | undefined;
  const currentRoleName = userPerms?.companyRole ?? null;
  const assignedSets: { id: string; name: string }[] = userPerms?.permissionSets ?? [];

  const handleSave = (data: UpdateEmployeePayload) => {
    if (!employee) return;
    updateEmployee(
      { id: employee.id, ...data },
      {
        onSuccess: () => {
          toast.success('Profile updated successfully');
          setEditOpen(false);
        },
        onError: (err) => toast.error(extractError(err, 'Failed to update profile')),
      },
    );
  };

  if (isLoading) return <EmployeeDetailSkeleton />;
  if (!employee) {
    return (
      <div className="p-8 text-center text-sm text-gray-400">
        Profile not found. Contact your administrator.
      </div>
    );
  }

  return (
    <div className="p-8 flex flex-col gap-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
          <p className="text-sm text-gray-400 mt-0.5">View and update your personal details</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setResignOpen(true)}
            className="gap-2 text-amber-600 border-amber-200 hover:bg-amber-50"
          >
            Resign
          </Button>
          <Button onClick={() => setEditOpen(true)}>Edit Profile</Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex gap-6 items-start">
        {/* Left — avatar card */}
        <EmployeeProfileCard
          employee={employee}
          roles={[
            ...(currentRoleName ? [currentRoleName] : []),
            ...assignedSets.filter((s) => s.name !== `${currentRoleName} Set`).map((s) => s.name),
          ]}
        />

        {/* Right — detail sections */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          {/* Personal Information */}
          <SectionCard title="Personal Information">
            <div className="grid grid-cols-3 gap-x-6 gap-y-5">
              <DetailField label="First Name" value={employee.firstName} />
              <DetailField label="Last Name" value={employee.lastName} />
              <DetailField label="Phone" value={employee.phone} />
              <DetailField label="Date of Birth" value={formatDate(employee.dateOfBirth)} />
              <DetailField label="Gender" value={formatEnum(employee.gender)} />
              <DetailField label="Marital Status" value={formatEnum(employee.maritalStatus)} />
              <DetailField label="Nationality" value={employee.nationality} />
              <DetailField label="Address" value={employee.address} />
              <DetailField
                label="City / Region"
                value={[employee.city, employee.region].filter(Boolean).join(', ') || undefined}
              />
            </div>
          </SectionCard>

          {/* Emergency Contact */}
          <SectionCard title="Emergency Contact">
            <div className="grid grid-cols-3 gap-x-6 gap-y-5">
              <DetailField label="Full Name" value={employee.emergencyName} />
              <DetailField label="Phone" value={employee.emergencyPhone} />
              <DetailField label="Relationship" value={employee.emergencyRelation} />
            </div>
          </SectionCard>

          {/* Banking & Compliance */}
          <SectionCard title="Banking & Compliance">
            <div className="grid grid-cols-3 gap-x-6 gap-y-5">
              <DetailField label="Bank Name" value={employee.bankName} />
              <DetailField label="Account Number" value={employee.bankAccountNumber} />
              <DetailField label="Bank Branch" value={employee.bankBranch} />
              <DetailField label="SSNIT Number" value={employee.ssnit} />
              <DetailField label="TIN Number" value={employee.tinNumber} />
            </div>
          </SectionCard>
        </div>
      </div>

      <EditMyProfilePanel
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        employee={employee}
        onSave={handleSave}
        isUpdating={isUpdating}
      />
      <ResignationPanel
        isOpen={resignOpen}
        onClose={() => setResignOpen(false)}
        employee={employee}
      />
    </div>
  );
}
