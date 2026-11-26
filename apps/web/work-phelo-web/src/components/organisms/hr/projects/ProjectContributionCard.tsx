'use client';

import { useState } from 'react';
import { Avatar } from '@/components/atoms/Avatar';
import { Button } from '@/components/atoms/Button';
import { DetailField } from '@/components/atoms/DetailField';
import { NumberField } from '@/components/atoms/NumberField';
import { ExportTimesheetButton } from '@/components/organisms/hr/projects/ExportTimesheetButton';
import { useProjectSetup, useUpdateProjectMemberRate } from '@/hooks';
import { useSaveWithToast } from '@/hooks/hr/useProjectWork';
import { useProjectLabels } from '@/hooks/useModuleLabels';
import { formatMoney } from '@/lib/projectPricing';
import type { ProjectPerson } from '@/lib/projectPeople';
import { cardClass } from '@/lib/utils';

interface Props {
  projectId: string;
  person: ProjectPerson;
  canManage: boolean;
}

/** The person's name, role and rate, the rate editable by whoever manages the team. */
function PersonDetails({ projectId, person, canManage }: Props) {
  const labels = useProjectLabels();
  const setup = useProjectSetup(projectId);
  const billsTime = !!setup?.billable && setup.pricing?.type === 'TIMED';
  const updateRate = useUpdateProjectMemberRate();
  const save = useSaveWithToast();
  const current = person.member?.hourlyRate ?? 0;
  // Null until the rate is being edited.
  const [draft, setDraft] = useState<number | null>(null);

  const saveRate = async () => {
    if (draft === null) return;
    await save(
      updateRate.mutateAsync({
        projectId,
        employeeId: person.id,
        hourlyRate: draft > 0 ? draft : null,
      }),
    );
    setDraft(null);
  };

  const role = !person.member
    ? 'Not on the team'
    : person.member.role === 'MANAGER'
      ? `${labels.singular} Lead`
      : person.member.role === 'OWNER'
        ? 'Owner'
        : 'Member';

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <Avatar name={person.name} avatarUrl={person.avatarUrl} size="md" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-gray-900">{person.name}</p>
        <p className="truncate text-xs text-gray-400">
          {[person.member?.jobTitle, role].filter(Boolean).join(' · ')}
        </p>
      </div>
      <ExportTimesheetButton projectId={projectId} employeeId={person.id} />
      {person.member && (
        <div className="flex flex-col items-end gap-1">
          {draft === null ? (
            <div className="flex items-center gap-3">
              <p className="text-sm font-semibold text-gray-900">
                {current > 0 ? `${formatMoney(current)} / hour` : 'No rate set'}
              </p>
              {canManage && (
                <Button size="xs" variant="outline" onClick={() => setDraft(current)}>
                  {current > 0 ? 'Edit Rate' : 'Set Rate'}
                </Button>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <NumberField
                ariaLabel={`Hourly rate for ${person.name}`}
                placeholder="Rate / hour"
                value={draft}
                onChange={setDraft}
              />
              <Button
                size="xs"
                onClick={saveRate}
                isLoading={updateRate.isPending}
                loadingText="Saving…"
              >
                Save
              </Button>
              <Button size="xs" variant="outline" onClick={() => setDraft(null)}>
                Cancel
              </Button>
            </div>
          )}
          <p className="text-xs text-gray-400">
            {billsTime
              ? 'Their time is billed at this rate'
              : 'Values their time; it never changes an invoice'}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * What the summary is showing: the picked person, if any, above the task counts and time that go with
 * the selection.
 */
export function ProjectContributionCard({
  projectId,
  person,
  canManage,
  figures,
}: Omit<Props, 'person'> & {
  /** Missing for everyone and for the unassigned tasks. */
  person?: ProjectPerson;
  figures: { label: string; value: string }[];
}) {
  return (
    <div className={cardClass('flex flex-col gap-4 px-5 py-4')}>
      {person && (
        <div className="border-b border-gray-100 pb-4">
          <PersonDetails
            // A new editor for each person.
            key={person.id}
            projectId={projectId}
            person={person}
            canManage={canManage}
          />
        </div>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        {figures.map((f) => (
          <DetailField key={f.label} label={f.label} value={f.value} />
        ))}
      </div>
    </div>
  );
}
