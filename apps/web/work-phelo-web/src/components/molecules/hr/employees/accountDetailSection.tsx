import { SectionCard } from '@/components/molecules/shared/sectionCard';
import { DetailField } from '@/components/molecules/shared/DetailField';
import { StatusBadge } from '@/components/molecules/shared/StatusBadge';
import type { Employee } from '@/types/hr';

interface Props {
  employee: Employee;
}

export function AccountDetailsSection({ employee }: Props) {
  // No linked user means a record-only employee, not a pending invite.
  const hasAccess = Boolean(employee.userId);
  const isPendingInvite = employee.userStatus === 'PENDING_VERIFICATION';

  return (
    <SectionCard title="Account Details">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
        {/* Employment Status */}
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-gray-400">Employment Status</span>
          <div className="mt-0.5">
            <StatusBadge status={employee.employmentStatus} />
          </div>
        </div>

        {/* Invite Status */}
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-gray-400">System Access</span>
          <div className="mt-0.5">
            {hasAccess ? (
              <StatusBadge status={isPendingInvite ? 'PENDING' : 'ACTIVE'} />
            ) : (
              <span className="text-sm text-gray-500">No system access</span>
            )}
          </div>
        </div>

        {/* Banking & Compliance Fields */}
        {employee?.bankName && <DetailField label="Bank" value={employee.bankName} />}
        {employee?.bankAccountNumber && (
          <DetailField label="Account Number" value={employee.bankAccountNumber} />
        )}
        {employee?.ssnit && <DetailField label="SSNIT" value={employee.ssnit} />}
        {employee?.tinNumber && <DetailField label="TIN" value={employee.tinNumber} />}

        {/* Emergency Contact */}
        {employee?.emergencyName && (
          <DetailField
            label="Emergency Contact"
            value={`${employee.emergencyName}${
              employee.emergencyRelation ? ` (${employee.emergencyRelation})` : ''
            }`}
          />
        )}
        {employee?.emergencyPhone && (
          <DetailField label="Emergency Phone" value={employee.emergencyPhone} />
        )}
      </div>
    </SectionCard>
  );
}
