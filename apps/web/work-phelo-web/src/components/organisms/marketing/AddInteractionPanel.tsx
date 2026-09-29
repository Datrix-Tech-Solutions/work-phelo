'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { FormField } from '@/components/molecules/shared/FormField';
import { buildCreateOptionEmptyState } from '@/components/molecules/marketing/CreateOptionEmptyState';
import { useAddProspectInteraction } from '@/hooks/marketing/useProspects';
import {
  useCreateProspectingSetting,
  useProspectingSettings,
} from '@/hooks/marketing/useProspectingSettings';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';

interface AddInteractionPanelProps {
  prospectId: string;
  isOpen: boolean;
  onClose: () => void;
  /** The prospect's contact person — picking their role fills in their name. */
  primaryContact?: { name: string; decisionMakerId?: string | null };
}

type FormValues = { decisionMakerName: string; notes: string };

export function AddInteractionPanel({
  prospectId,
  isOpen,
  onClose,
  primaryContact,
}: AddInteractionPanelProps) {
  const toast = useToast();
  const addInteraction = useAddProspectInteraction(prospectId);
  const { data: media = [] } = useProspectingSettings('interaction-media');
  const { data: decisionMakers = [] } = useProspectingSettings('decision-makers');
  const decisionMakerOptions = useMemo(
    () => decisionMakers.map((d) => ({ value: d.id, label: d.name })),
    [decisionMakers],
  );
  const createMedium = useCreateProspectingSetting('interaction-media');
  const createDecisionMaker = useCreateProspectingSetting('decision-makers');
  const mediumOptions = useMemo(() => media.map((m) => ({ value: m.id, label: m.name })), [media]);

  const [mediumId, setMediumId] = useState('');
  const [decisionMakerId, setDecisionMakerId] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [dateError, setDateError] = useState<string>();

  const { register, handleSubmit, reset, setValue, getValues } = useForm<FormValues>({
    defaultValues: { decisionMakerName: '', notes: '' },
  });

  function handleDecisionMakerChange(id: string) {
    setDecisionMakerId(id);
    if (!primaryContact) return;
    if (id && id === primaryContact.decisionMakerId) {
      setValue('decisionMakerName', primaryContact.name);
    } else if (getValues('decisionMakerName') === primaryContact.name) {
      // Only clear a name we filled in ourselves, never one the user typed.
      setValue('decisionMakerName', '');
    }
  }

  function handleClose() {
    reset({ decisionMakerName: '', notes: '' });
    setMediumId('');
    setDecisionMakerId('');
    setOccurredAt('');
    setDateError(undefined);
    onClose();
  }

  function onSubmit(values: FormValues) {
    if (!occurredAt) {
      setDateError('Date is required');
      return;
    }
    addInteraction.mutate(
      {
        occurredAt,
        interactionMediumId: mediumId || undefined,
        decisionMakerTypeId: decisionMakerId || undefined,
        decisionMakerName: values.decisionMakerName.trim() || undefined,
        notes: values.notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          toast.success('Interaction added');
          handleClose();
        },
        onError: (error) => toast.error(apiErrorMessage(error, 'Failed to add interaction')),
      },
    );
  }

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="Add Interaction"
      description="Log a contact you had with this prospect."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={addInteraction.isPending}>
            Add Interaction
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <SearchSelect
          label="Interaction Type"
          placeholder="Select or type to add new"
          options={mediumOptions}
          value={mediumId}
          onChange={setMediumId}
          emptyState={buildCreateOptionEmptyState(
            'interaction type',
            createMedium,
            setMediumId,
            toast,
          )}
        />
        <SearchSelect
          label="Decision Maker Met"
          placeholder="Select or type to add new"
          options={decisionMakerOptions}
          value={decisionMakerId}
          onChange={handleDecisionMakerChange}
          emptyState={buildCreateOptionEmptyState(
            'decision maker',
            createDecisionMaker,
            handleDecisionMakerChange,
            toast,
          )}
        />
        <FormField
          label="Decision Maker Name"
          registration={register('decisionMakerName')}
          placeholder="Name of the person met"
        />
        <DatePicker
          label="Date Contacted"
          value={occurredAt}
          onChange={(v) => {
            setOccurredAt(v);
            setDateError(undefined);
          }}
          error={dateError}
          disableFuture
        />
        <FormField
          label="Notes"
          type="textarea"
          rows={4}
          registration={register('notes')}
          placeholder="What was discussed?"
        />
      </div>
    </SidePanel>
  );
}
