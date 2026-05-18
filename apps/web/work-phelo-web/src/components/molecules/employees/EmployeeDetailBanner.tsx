'use client';

import Image from 'next/image';
import { Pencil, BadgeCheck } from 'lucide-react';
import { Button } from '@/components/atoms/Button';
import { Icons } from '@/components/atoms/icons';
import type { Employee } from '@/types/hr';

interface EmployeeDetailBannerProps {
  employee: Employee;
  hasPendingResignation: boolean;
  onEdit?: () => void;
  onOffboard?: () => void;
  onResign: () => void;
  onResendInvite: () => void;
  isResending?: boolean;
}

export function EmployeeDetailBanner({
  employee,
  hasPendingResignation,
  onEdit,
  onOffboard,
  onResign,
  onResendInvite,
  isResending,
}: EmployeeDetailBannerProps) {
  const name = `${employee.firstName} ${employee.lastName}`;
  const initials = `${employee.firstName[0] ?? ''}${employee.lastName[0] ?? ''}`.toUpperCase();
  const isPendingInvite = employee.userStatus === 'PENDING_VERIFICATION';
  const isOffboarded = employee.employmentStatus === 'OFFBOARDED';

  return (
    <div className="w-full rounded-card overflow-hidden bg-[#1a3557]">
      <div className="flex items-center gap-6 px-8 py-7">
        {employee.avatarUrl ? (
          <Image
            src={employee.avatarUrl}
            alt={initials}
            width={96}
            height={96}
            className="w-24 h-24 rounded-full object-cover ring-4 ring-white/20 shrink-0"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-white/10 ring-4 ring-white/20 flex items-center justify-center text-white text-2xl font-bold shrink-0">
            {initials}
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-white">{name}</h1>
            {!isPendingInvite && <BadgeCheck className="w-5 h-5 text-white/70 shrink-0" />}
          </div>
          <div className="flex flex-col gap-1">
            {employee.jobTitle && (
              <p className="text-sm">
                <span className="text-white/50 mr-2">Job Title:</span>
                <span className="text-white/80">{employee.jobTitle}</span>
              </p>
            )}
            <p className="text-sm">
              <span className="text-white/50 mr-2">Email:</span>
              <span className="text-white/80">{employee.email}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {isPendingInvite && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResendInvite}
              isLoading={isResending}
              loadingText="Sending…"
              className="text-white border-white/40 bg-transparent hover:bg-white/10"
            >
              Resend Invite
            </Button>
          )}

          {hasPendingResignation && (
            <Button
              variant="outline"
              size="sm"
              onClick={onResign}
              className="text-amber-400 border-amber-400 bg-transparent hover:bg-amber-400/10"
            >
              Pending Resignation
            </Button>
          )}

          {!isOffboarded && onEdit && (
            <Button size="sm" onClick={onEdit} className="gap-2">
              Edit
              <Pencil className="w-4 h-4" />
            </Button>
          )}

          {!isOffboarded && onOffboard && (
            <Button
              variant="outline"
              size="sm"
              onClick={onOffboard}
              className="gap-2 text-red-400 border-red-400/60 bg-transparent hover:bg-red-400/10"
            >
              Off-Board
              <Icons.UserMinus className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
