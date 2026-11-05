'use client';

import { useEffect } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { StatusRadioGroup } from '@/components/atoms/StatusRadioGroup';
import { FormField } from '@/components/molecules/shared/FormField';
import {
  useInventoryParties,
  type InventoryParty,
  type PartyKind,
} from '@/hooks/inventory/useInventoryParties';
import { useMultiEntryPanel } from '@/hooks/useMultiEntryPanel';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface PartyFormValues {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  status: 'ACTIVE' | 'INACTIVE';
}

const FORM_DEFAULTS: PartyFormValues = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  status: 'ACTIVE',
};

const COPY: Record<PartyKind, { noun: string; placeholder: string; intro: string }> = {
  CUSTOMER: {
    noun: 'Customer',
    placeholder: 'e.g. Customer Company Limited',
    intro: 'Add someone you issue stock to.',
  },
  SUPPLIER: {
    noun: 'Supplier',
    placeholder: 'e.g. Supplier Company Limited',
    intro: 'Add someone you receive stock from.',
  },
};

interface PartyModalProps {
  kind: PartyKind;
  isOpen: boolean;
  onClose: () => void;
  /** The customer or supplier being edited; omit to add a new one. */
  party?: InventoryParty | null;
}

export function PartyModal({ kind, isOpen, onClose, party }: PartyModalProps) {
  const toast = useToast();
  const copy = COPY[kind];
  const isEditing = !!party;
  const { createParty, updateParty, isPending } = useInventoryParties(kind);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors },
  } = useForm<PartyFormValues>({ defaultValues: FORM_DEFAULTS });

  useEffect(() => {
    if (!isOpen) return;
    reset(
      party
        ? {
            name: party.name,
            contactPerson: party.contactPerson ?? '',
            phone: party.phone ?? '',
            email: party.email ?? '',
            address: party.address ?? '',
            status: party.status,
          }
        : FORM_DEFAULTS,
    );
  }, [isOpen, party, reset]);

  const status = useWatch({ control, name: 'status' });

  const handleClose = () => {
    reset(FORM_DEFAULTS);
    onClose();
  };

  const entry = useMultiEntryPanel({
    isOpen,
    onStop: handleClose,
    onContinue: () => reset(FORM_DEFAULTS),
  });

  const save = async (data: PartyFormValues) => {
    const values = {
      name: data.name.trim(),
      contactPerson: data.contactPerson.trim() || null,
      phone: data.phone.trim() || null,
      email: data.email.trim() || null,
      address: data.address.trim() || null,
      status: data.status,
    };
    if (party) {
      await updateParty(party.id, values);
      toast.success(`${copy.noun} updated successfully`);
      handleClose();
      return;
    }
    await createParty(values);
    toast.success(`${copy.noun} created successfully`);
    entry.finishSave(
      { title: `${copy.noun} Added!`, message: `${values.name} has been added.` },
      handleClose,
    );
  };

  const onSubmit = async (data: PartyFormValues) => {
    try {
      await save(data);
    } catch (err) {
      toast.error(extractError(err, `Could not save ${copy.noun.toLowerCase()}`));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={isEditing ? `Edit ${copy.noun}` : `Add ${copy.noun}`}
      description={
        isEditing ? `Update the details of this ${copy.noun.toLowerCase()}.` : copy.intro
      }
      width="max-w-xl"
      {...entry.panelProps}
      lock={isEditing ? undefined : entry.panelProps.lock}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            {isEditing ? 'Save Changes' : `Save ${copy.noun}`}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4 mt-4">
        <FormField
          label={`${copy.noun} Name`}
          registration={register('name', {
            required: `${copy.noun} name is required`,
            validate: (v) => v.trim().length > 0 || `${copy.noun} name is required`,
            maxLength: { value: 150, message: 'Name cannot exceed 150 characters' },
          })}
          error={errors.name}
          placeholder={copy.placeholder}
        />

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1 min-w-0">
            <FormField
              label="Contact Person"
              registration={register('contactPerson', {
                maxLength: { value: 150, message: 'Cannot exceed 150 characters' },
              })}
              error={errors.contactPerson}
              placeholder="e.g. Ama Mensah"
            />
          </div>
          <div className="flex-1 min-w-0">
            <FormField
              label="Phone"
              registration={register('phone', {
                maxLength: { value: 30, message: 'Cannot exceed 30 characters' },
              })}
              error={errors.phone}
              placeholder="e.g. +233 24 000 0000"
            />
          </div>
        </div>

        <FormField
          label="Email"
          type="email"
          registration={register('email', {
            pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address' },
            maxLength: { value: 150, message: 'Cannot exceed 150 characters' },
          })}
          error={errors.email}
          placeholder="e.g. accounts@company.com"
        />

        <FormField
          label="Address"
          type="textarea"
          rows={3}
          registration={register('address', {
            maxLength: { value: 300, message: 'Address cannot exceed 300 characters' },
          })}
          error={errors.address}
          placeholder="e.g. 12 Industrial Road, Tema"
        />

        <StatusRadioGroup value={status} onChange={(v) => setValue('status', v)} />
      </div>
    </Modal>
  );
}
