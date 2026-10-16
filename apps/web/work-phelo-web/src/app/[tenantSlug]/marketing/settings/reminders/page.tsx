'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { NumberField } from '@/components/atoms/NumberField';
import { Skeleton } from '@/components/atoms/Skeleton';
import { useCrmPreferences, useUpdateCrmPreferences } from '@/hooks/marketing/useCrmPreferences';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { cardClass } from '@/lib/utils';

const MAX_DAYS = 365;

export default function RemindersSettingsPage() {
  const toast = useToast();
  const canEdit = usePermissionRule('marketing.crm-settings:EDIT');
  const { data, isLoading, isError } = useCrmPreferences();
  const update = useUpdateCrmPreferences();
  // Only holds a value once the user edits; until then the saved setting shows.
  const [draft, setDraft] = useState<number | null>(null);

  if (isLoading) return <Skeleton className="h-40 w-full max-w-xl" />;
  if (isError || !data) {
    return <p className="text-sm text-red-500 text-center py-8">Failed to load settings.</p>;
  }

  const days = draft ?? data.followUpDelayDays;
  const error =
    days < 1 || days > MAX_DAYS || !Number.isInteger(days)
      ? `Enter a whole number of days from 1 to ${MAX_DAYS}.`
      : undefined;
  const dirty = days !== data.followUpDelayDays;

  function handleSave() {
    if (error) return;
    update.mutate(
      { followUpDelayDays: days },
      {
        onSuccess: () => {
          toast.success('Reminder settings saved');
          setDraft(null);
        },
        onError: (e) => toast.error(apiErrorMessage(e, 'Failed to save reminder settings')),
      },
    );
  }

  return (
    <div className={cardClass('flex flex-col gap-4 p-5 max-w-xl')}>
      <div>
        <h2 className="text-base font-semibold text-gray-900">Automatic reminder</h2>
        <p className="text-sm text-gray-500 mt-1">
          When a prospect has no reminder scheduled, one falls due this many days after its latest
          interaction. Changing this moves the automatic reminder of every prospect; reminders
          scheduled by hand are not affected.
        </p>
      </div>
      <NumberField
        label="Days after last interaction"
        decimals={0}
        value={days}
        onChange={setDraft}
        disabled={!canEdit}
        error={dirty ? error : undefined}
      />
      {canEdit && (
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={!dirty || !!error || update.isPending}>
            Save
          </Button>
        </div>
      )}
    </div>
  );
}
