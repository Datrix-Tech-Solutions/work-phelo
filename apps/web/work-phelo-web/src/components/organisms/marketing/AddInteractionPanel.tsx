'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import { Toggle } from '@/components/atoms/Toggle';
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
  /** The prospect's decision maker — marking them as met prefills the contact person with their details. */
  primaryContact?: { name: string; phone?: string | null; role?: string | null };
}

function fieldError(message?: string) {
  return message ? { type: 'required', message } : undefined;
}

type FormValues = { contactPersonName: string; contactRole: string; notes: string };

export function AddInteractionPanel({
  prospectId,
  isOpen,
  onClose,
  primaryContact,
}: AddInteractionPanelProps) {
  const toast = useToast();
  const addInteraction = useAddProspectInteraction(prospectId);
  const { data: media = [] } = useProspectingSettings('interaction-media');
  const createMedium = useCreateProspectingSetting('interaction-media');
  const mediumOptions = useMemo(() => media.map((m) => ({ value: m.id, label: m.name })), [media]);

  const [mediumId, setMediumId] = useState('');
  const [decisionMakerMet, setDecisionMakerMet] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [dateError, setDateError] = useState<string>();
  const [mediumError, setMediumError] = useState<string>();
  const [participantErrors, setParticipantErrors] = useState<
    Partial<Record<'name' | 'phone' | 'role', string>>
  >({});

  const { register, handleSubmit, reset, setValue, getValues } = useForm<FormValues>({
    defaultValues: { contactPersonName: '', contactRole: '', notes: '' },
  });

  function handleDecisionMakerMetChange(met: boolean) {
    setDecisionMakerMet(met);
    if (!primaryContact) return;
    const dmPhone = primaryContact.phone ?? '';
    const dmRole = primaryContact.role ?? '';
    if (met) {
      setValue('contactPersonName', primaryContact.name);
      setValue('contactRole', dmRole);
      setContactPhone(dmPhone);
    } else if (
      getValues('contactPersonName') === primaryContact.name &&
      getValues('contactRole') === dmRole &&
      contactPhone === dmPhone
    ) {
      // Only clear details we filled in ourselves, never ones the user typed.
      setValue('contactPersonName', '');
      setValue('contactRole', '');
      setContactPhone('');
    }
  }

  function handleClose() {
    reset({ contactPersonName: '', contactRole: '', notes: '' });
    setMediumId('');
    setDecisionMakerMet(false);
    setContactPhone('');
    setOccurredAt('');
    setDateError(undefined);
    setMediumError(undefined);
    setParticipantErrors({});
    onClose();
  }

  function onSubmit(values: FormValues) {
    const fullName = values.contactPersonName.trim();
    const phone = contactPhone.trim();
    const role = values.contactRole.trim();
    // A participant is optional, but the API needs all three of its fields when one is given.
    const hasParticipant = !!(fullName || phone || role);

    const nextParticipantErrors: typeof participantErrors = hasParticipant
      ? {
          ...(fullName ? {} : { name: 'Name is required' }),
          ...(phone ? {} : { phone: 'Number is required' }),
          ...(role ? {} : { role: 'Role is required' }),
        }
      : {};

    setDateError(occurredAt ? undefined : 'Date is required');
    setMediumError(mediumId ? undefined : 'Interaction type is required');
    setParticipantErrors(nextParticipantErrors);
    if (!occurredAt || !mediumId || Object.keys(nextParticipantErrors).length > 0) return;

    addInteraction.mutate(
      {
        occurredAt,
        interactionMediumId: mediumId,
        decisionMakerInvolved: decisionMakerMet,
        ...(hasParticipant ? { participants: [{ fullName, phone, role }] } : {}),
        ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
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
          onChange={(v) => {
            setMediumId(v);
            setMediumError(undefined);
          }}
          error={mediumError}
          emptyState={buildCreateOptionEmptyState(
            'interaction type',
            createMedium,
            setMediumId,
            toast,
          )}
        />
        <div className="flex items-center justify-between gap-4">
          <span className="text-sm font-bold text-gray-900">Decision maker was met</span>
          <Toggle enabled={decisionMakerMet} onChange={handleDecisionMakerMetChange} />
        </div>
        <FormField
          label="Contact Person Name"
          registration={register('contactPersonName')}
          placeholder="Name of the person met"
          error={fieldError(participantErrors.name)}
        />
        <PhoneInput
          label="Contact Person Number"
          value={contactPhone}
          onChange={setContactPhone}
          error={participantErrors.phone}
        />
        <FormField
          label="Contact Person Role"
          registration={register('contactRole')}
          placeholder="e.g. Finance Director"
          error={fieldError(participantErrors.role)}
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
