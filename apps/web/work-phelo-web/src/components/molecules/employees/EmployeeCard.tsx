'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Icons } from '@/components/atoms/icons';

/* ── Types ── */
export type EmploymentStatus = 'ACTIVE' | 'PROBATION' | 'SUSPENDED' | 'OFFBOARDED';

export interface EmployeeCardProps {
  firstName: string;
  lastName: string;
  jobTitle: string;
  department?: string;
  email?: string;
  phone?: string;
  hireDate?: string;
  status: string;
  avatarUrl?: string;
  onClick?: () => void;
}

/* ── Status badge ── */
const STATUS_STYLES: Record<string, { dot: string; text: string; bg: string; label: string }> = {
  ACTIVE: { dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50', label: 'Active' },
  PROBATION: {
    dot: 'bg-yellow-400',
    text: 'text-yellow-700',
    bg: 'bg-yellow-50',
    label: 'Probation',
  },
  SUSPENDED: { dot: 'bg-red-400', text: 'text-red-700', bg: 'bg-red-50', label: 'Suspended' },
  OFFBOARDED: { dot: 'bg-gray-400', text: 'text-gray-600', bg: 'bg-gray-100', label: 'Offboarded' },
  PENDING_VERIFICATION: {
    dot: 'bg-orange-400',
    text: 'text-orange-700',
    bg: 'bg-orange-50',
    label: 'Invite Pending',
  },
  INACTIVE: { dot: 'bg-gray-400', text: 'text-gray-500', bg: 'bg-gray-100', label: 'Inactive' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.OFFBOARDED;
  return (
    <span
      className={cn(
        'flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold',
        s.bg,
        s.text,
      )}
    >
      <span className={cn('w-2 h-2 rounded-full shrink-0', s.dot)} />
      {s.label}
    </span>
  );
}

/* ── Avatar ── */
function Avatar({
  firstName,
  lastName,
  avatarUrl,
}: {
  firstName: string;
  lastName: string;
  avatarUrl?: string;
}) {
  const initials = `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();

  if (avatarUrl) {
    return (
      <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-white shadow-sm shrink-0">
        <Image
          src={avatarUrl}
          alt={`${firstName} ${lastName}`}
          width={96}
          height={96}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className="w-24 h-24 rounded-full bg-brand flex items-center justify-center text-white text-2xl font-bold shrink-0 shadow-sm">
      {initials}
    </div>
  );
}

/* ── Icons ── */
const EmailIcon = () => <Icons.Mail />;

const PhoneIcon = () => <Icons.Phone />;

/* ── Card ── */
export function EmployeeCard({
  firstName,
  lastName,
  jobTitle,
  department,
  email,
  phone,
  hireDate,
  status,
  avatarUrl,
  onClick,
}: EmployeeCardProps) {
  const formattedDate = hireDate
    ? new Date(hireDate).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      })
    : '—';

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white border border-gray-200 rounded-card p-5 flex flex-col gap-4',
        onClick &&
          'cursor-pointer hover:shadow-md hover:border-gray-300 hover:-translate-y-0.5 transition-all duration-200',
      )}
    >
      {/* Top row — avatar + status */}
      <div className="flex items-start justify-between">
        <Avatar firstName={firstName} lastName={lastName} avatarUrl={avatarUrl} />
        <StatusBadge status={status} />
      </div>

      {/* Name + job title */}
      <div>
        <p className="text-lg font-bold text-gray-900">
          {firstName} {lastName}
        </p>
        <p className="text-sm text-gray-400 mt-0.5">{jobTitle}</p>
      </div>

      {/* Details */}
      <div className="flex flex-col gap-3 pt-1 border-t border-gray-10">
        {/* Department + hire date */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <p className="text-xs text-gray-400">Department</p>
            <p className="text-sm font-semibold text-gray-700 mt-0.5">{department ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400">Date Hired</p>
            <p className="text-sm font-semibold text-gray-700 mt-0.5">{formattedDate}</p>
          </div>
        </div>

        {/* Email */}
        {email && (
          <div className="flex items-center gap-2.5 text-gray-500">
            <EmailIcon />
            <span className="text-sm truncate">{email}</span>
          </div>
        )}

        {/* Phone */}
        {phone && (
          <div className="flex items-center gap-2.5 text-gray-500">
            <PhoneIcon />
            <span className="text-sm">{phone}</span>
          </div>
        )}
      </div>
    </div>
  );
}
