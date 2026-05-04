import Image from 'next/image';
import { ShieldCheck, BadgeCheck } from 'lucide-react';
import { DetailField } from '../shared/DetailField';
import { StatusBadge } from '@/components/molecules/shared/StatusBadge';
import type { Employee } from '@/types/hr';

interface EmployeeProfileCardProps {
  employee: Employee;
  roles?: string[];
}

export function EmployeeProfileCard({ employee, roles = [] }: EmployeeProfileCardProps) {
  const name = `${employee.firstName} ${employee.lastName}`;
  const initials = `${employee.firstName[0] ?? ''}${employee.lastName[0] ?? ''}`.toUpperCase();
  const isPendingInvite = employee.userStatus === 'PENDING_VERIFICATION';

  return (
    <div className="w-72 shrink-0 bg-white border border-gray-200 rounded-card p-6 flex flex-col items-start gap-4">
      {/* Avatar */}
      {employee.avatarUrl ? (
        <Image
          src={employee.avatarUrl}
          alt={initials}
          width={96}
          height={96}
          className="w-24 h-24 rounded-full object-cover"
        />
      ) : (
        <div className="w-24 h-24 rounded-full bg-brand flex items-center justify-center text-white text-2xl font-bold">
          {initials}
        </div>
      )}

      <div className="text-left">
        <div className="flex items-center gap-1.5">
          <p className="text-base font-bold text-gray-900">{name}</p>
          {!isPendingInvite && <BadgeCheck className="w-4.5 h-4.5 text-brand shrink-0" />}
        </div>
        {employee?.jobTitle && <p className="text-sm text-gray-400 mt-0.5">{employee.jobTitle}</p>}
      </div>

      {/* Status badges */}
      <div className="flex flex-wrap gap-2">
        {employee.employmentStatus === 'ACTIVE' ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
            Permanent Staff
          </span>
        ) : (
          <StatusBadge status={employee.employmentStatus} />
        )}
        {isPendingInvite && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
            Pending Verification
          </span>
        )}
      </div>

      <div className="w-full border-t border-gray-100" />

      {/* Contact Info */}
      <div className="w-full flex flex-col gap-3">
        <DetailField label="Email Address" value={employee.email} />
        {employee.phone && <DetailField label="Phone Number" value={employee.phone} />}
        {employee.employeeNumber && (
          <DetailField label="Employee No." value={employee.employeeNumber} />
        )}
      </div>

      {/* Roles */}
      {roles.length > 0 && (
        <>
          <div className="w-full border-t border-gray-100" />
          <div className="w-full flex flex-col gap-2.5">
            <p className="text-xs text-gray-400 font-medium tracking-wider">Roles</p>
            {roles.map((role) => (
              <div key={role} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-brand/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-brand" />
                </div>
                <span className="text-sm font-medium text-gray-700">{role}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
