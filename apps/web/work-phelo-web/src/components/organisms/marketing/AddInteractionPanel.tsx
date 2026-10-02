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
import { useAddClientInteraction } from '@/hooks/marketing/useClients';
import { useCompleteFollowUp } from '@/hooks/marketing/useFollowUps';
import {
  useCreateProspectingSetting,
  useProspectingSettings,
} from '@/hooks/marketing/useProspectingSettings';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';

interface AddInteractionPanelProps {
  /** Exactly one of prospectId / clientId — who the interaction is recorded against. */
  prospectId?: string;
  clientId?: string;
  /** Pending follow-up this interaction completes, when recorded from the follow-ups page. */
  followUpId?: string | null;
  isOpen: boolean;
  onClose: () => void;
  /** The prospect's decision maker — marking them as met prefills the contact person with their details. */
  primaryContact?: { name: string; phone?: string | null; role?: string | null };
}

/** Today's date (YYYY-MM-DD) in the user's local time. */
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fieldError(message?: string) {
  return message ? { type: 'required', message } : undefined;
}

type FormValues = { contactPersonName: string; contactRole: string; notes: string };

export function AddInteractionPanel({
  prospectId,
  clientId,
  followUpId,
  isOpen,
  onClose,
  primaryContact,
}: AddInteractionPanelProps) {
  const toast = useToast();
  const addInteraction = useAddProspectInteraction(prospectId ?? '');
  const addClientInteraction = useAddClientInteraction(clientId ?? '');
  // Clients call these "follow-ups"; prospects keep "interaction" in this panel.
  const noun = clientId ? 'Follow-up' : 'Interaction';
  const completeFollowUp = useCompleteFollowUp();
  const isSaving =
    addInteraction.isPending || addClientInteraction.isPending || completeFollowUp.isPending;
  const { data: media = [] } = useProspectingSettings('interaction-media');
  const createMedium = useCreateProspectingSetting('interaction-media');
  const mediumOptions = useMemo(() => media.map((m) => ({ value: m.id, label: m.name })), [media]);

  const [mediumId, setMediumId] = useState('');
  const [decisionMakerMet, setDecisionMakerMet] = useState(false);
  const [contactPhone, setContactPhone] = useState('');
  // Until the user picks a date it follows today, so a panel left open overnight isn't stale.
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const occurredAt = pickedDate ?? today();
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
    setPickedDate(null);
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

    const interaction = {
      occurredAt,
      interactionMediumId: mediumId,
      decisionMakerInvolved: decisionMakerMet,
      ...(hasParticipant ? { participants: [{ fullName, phone, role }] } : {}),
      ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
    };
    const callbacks = {
      onSuccess: () => {
        toast.success(`${noun} added`);
        handleClose();
      },
      onError: (error: unknown) =>
        toast.error(apiErrorMessage(error, `Failed to add ${noun.toLowerCase()}`)),
    };

    // A follow-up is completed through its own endpoint, which records the interaction too.
    if (followUpId) {
      completeFollowUp.mutate({ id: followUpId, payload: { interaction } }, callbacks);
    } else if (clientId) {
      addClientInteraction.mutate(interaction, callbacks);
    } else {
      addInteraction.mutate(interaction, callbacks);
    }
  }

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title={`Add ${noun}`}
      description={`Log a contact you had with this ${clientId ? 'client' : 'prospect'}.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isSaving}>
            Add {noun}
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
            setPickedDate(v);
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
