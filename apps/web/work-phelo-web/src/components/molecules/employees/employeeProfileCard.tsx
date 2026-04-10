import Image from 'next/image';
import { DetailField } from '../payroll/DetailField';
import type { Employee } from '@/types/hr';

interface EmployeeProfileCardProps {
  employee: Employee;
}

export function EmployeeProfileCard({ employee }: EmployeeProfileCardProps) {
  const name = `${employee.firstName} ${employee.lastName}`;
  const initials = `${employee.firstName[0] ?? ''}${employee.lastName[0] ?? ''}`.toUpperCase();

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
        <div className="w-24 h-24 rounded-full bg-[#0D2244] flex items-center justify-center text-white text-2xl font-bold">
          {initials}
        </div>
      )}

      <div className="text-left">
        <p className="text-base font-bold text-gray-900">{name}</p>
        {employee?.jobTitle && <p className="text-sm text-gray-400 mt-0.5">{employee.jobTitle}</p>}
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
    </div>
  );
}
