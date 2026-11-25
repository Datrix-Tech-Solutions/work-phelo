'use client';

import { useMemo } from 'react';
import {
  InviteEmployeePanel,
  type InviteEmployeeDefaults,
} from '@/components/organisms/hr/employee/inviteEmployeePanel';
import { useAllEmployees } from '@/hooks/hr/useEmployees';
import { useCandidate, useJobOpening } from '@/hooks/hr/useRecruitment';
import { usePermission } from '@/hooks/hr/usePermission';
import { useToast } from '@/hooks/useToast';
import { Permission } from '@/lib/permissionMap';
import type { RecruitmentCandidate } from '@/types/recruitment';

interface Props {
  candidate: RecruitmentCandidate | null;
  onClose: () => void;
}

/** The new employee form, pre-filled from a hired candidate's application and job opening. */
export function OnboardCandidatePanel({ candidate, onClose }: Props) {
  const toast = useToast();
  const canReadCandidate = usePermission(Permission.READ_RECRUITMENT_CANDIDATES);
  const { data: vacancy } = useJobOpening(candidate?.vacancyId ?? '');
  const { data: detail } = useCandidate(canReadCandidate ? (candidate?.id ?? '') : '');
  const { data: employees } = useAllEmployees(undefined, { enabled: !!candidate });

  const defaults = useMemo<InviteEmployeeDefaults | undefined>(() => {
    if (!candidate) return undefined;
    return {
      recruitmentCandidateId: candidate.id,
      firstName: candidate.firstName ?? '',
      lastName: candidate.lastName ?? '',
      email: detail?.email ?? '',
      phone: detail?.phone ?? '',
      jobTitle: vacancy?.title ?? candidate.vacancy.title ?? '',
      departmentId: vacancy?.departmentId ?? undefined,
      branchId: vacancy?.branchId ?? undefined,
      employmentType: vacancy?.jobType ?? 'FULL_TIME',
    };
  }, [candidate, vacancy, detail]);

  return (
    <InviteEmployeePanel
      isOpen={!!candidate}
      onClose={onClose}
      onSuccess={(fullName) => {
        toast.success(`${fullName} has been onboarded`);
        onClose();
      }}
      employees={employees?.data ?? []}
      initialValues={defaults}
    />
  );
}
