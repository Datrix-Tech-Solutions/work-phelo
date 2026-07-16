'use client';

import Image from 'next/image';
import { getGreeting } from '@/lib/formatters';
import { cardClass } from '@/lib/utils';

interface EmployeeWelcomeCardProps {
  fullName: string;
  avatarUrl?: string;
  jobTitle?: string;
  department?: string;
  branch?: string;
  managerName?: string;
  companyName?: string;
}

function initialsOf(name: string) {
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export function EmployeeWelcomeCard({
  fullName,
  avatarUrl,
  jobTitle,
  department,
  branch,
  managerName,
  companyName,
}: EmployeeWelcomeCardProps) {
  const fields = [
    { label: 'Job Title', value: jobTitle },
    { label: 'Department', value: department },
    { label: 'Branch', value: branch },
    { label: 'Manager', value: managerName },
    { label: 'Company', value: companyName },
  ].filter((f): f is { label: string; value: string } => !!f.value);

  return (
    <div className={cardClass('w-full max-w-md p-5 flex flex-col gap-4 shrink-0 border-gray-200')}>
      <div className="flex items-center gap-3 min-w-0">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt={fullName}
            width={48}
            height={48}
            className="w-12 h-12 rounded-full object-cover ring-2 ring-brand/10 shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center text-white text-base font-bold shrink-0">
            {initialsOf(fullName)}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold text-orange-500">{getGreeting()}</p>
          <h1 className="text-xl font-bold text-gray-900 truncate">{fullName}</h1>
        </div>
      </div>

      {fields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-3 pt-3 border-t border-gray-100">
          {fields.map((f) => (
            <div key={f.label} className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[11px] text-gray-400 font-medium tracking-wider">
                {f.label}
              </span>
              <span className="text-sm font-semibold text-gray-900 truncate">{f.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
