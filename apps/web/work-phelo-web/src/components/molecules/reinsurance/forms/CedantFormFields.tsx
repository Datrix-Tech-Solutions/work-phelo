'use client';

import { useFieldArray, useWatch } from 'react-hook-form';
import type { Control, UseFormRegister, UseFormSetValue, FieldErrors } from 'react-hook-form';
import { FormField } from '@/components/molecules/shared/FormField';
import { FormSection } from '@/components/atoms/FormSection';
import { Input } from '@/components/atoms/Input';
import { Icons } from '@/components/atoms/icons';
import { CounterpartyAddressFields } from '@/components/molecules/reinsurance/forms/CounterpartyAddressFields';
import { CONTACT_PERSON_DEFAULTS } from '@/types/reinsurance';
import type { CedantFormValues } from '@/types/reinsurance';

interface CedantFormFieldsProps {
  control: Control<CedantFormValues>;
  register: UseFormRegister<CedantFormValues>;
  setValue: UseFormSetValue<CedantFormValues>;
  errors: FieldErrors<CedantFormValues>;
}

export function CedantFormFields({ control, register, setValue, errors }: CedantFormFieldsProps) {
  const {
    fields: contactFields,
    append: appendContact,
    remove: removeContact,
  } = useFieldArray({ control, name: 'contacts' });

  // Primary phone via useWatch + setValue (digits-only input, not registered directly)
  const primaryPhone = useWatch({ control, name: 'phone' });
  // Contact phones via watching the entire contacts array
  const watchedContacts = useWatch({ control, name: 'contacts' });

  return (
    <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
      {/* ── Basic info ── */}
      <FormSection title="Basic Info">
        <FormField
          label="Cedant Name"
          registration={register('name', { required: 'Cedant name is required' })}
          error={errors.name}
          placeholder="e.g. Insurance Company Ltd."
        />
      </FormSection>

      {/* ── Primary contact ── */}
      <FormSection title="Primary Contact">
        <div className="flex flex-col gap-2">
          <FormField
            label="Primary Email"
            type="email"
            registration={register('email', {
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Enter a valid email address',
              },
            })}
            error={errors.email}
            placeholder="e.g. info@insurancecompany.com"
          />

          <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
            <span className="text-sm font-bold text-gray-900">Primary Phone Number</span>
            <Input
              type="tel"
              inputMode="numeric"
              placeholder="00 000 0000"
              value={primaryPhone ?? ''}
              onChange={(e) => setValue('phone', e.target.value.replace(/\D/g, ''))}
              error={errors.phone?.message}
            />
          </div>
        </div>
      </FormSection>

      {/* ── Additional contacts ── */}
      <FormSection title="Additional Contacts">
        <div className="flex flex-col gap-2">
          {contactFields.map((field, index) => (
            <div
              key={field.id}
              className="relative flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4"
            >
              {/* Remove button */}
              <button
                type="button"
                onClick={() => removeContact(index)}
                className="absolute top-3 right-3 p-1 rounded-xl text-red-500 hover:text-red-700 hover:bg-red-200 transition-colors"
                aria-label="Remove contact"
              >
                <Icons.Trash2 className="w-4 h-4" />
              </button>

              <FormField
                label="Contact Name"
                registration={register(`contacts.${index}.fullName`, {
                  required: 'Contact name is required',
                })}
                error={errors.contacts?.[index]?.fullName}
                placeholder="e.g. Ama Mensah"
              />

              <FormField
                label="Contact Email"
                type="email"
                registration={register(`contacts.${index}.email`, {
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Enter a valid email address',
                  },
                })}
                error={errors.contacts?.[index]?.email}
                placeholder="e.g. ama@example.com"
              />

              <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
                <span className="text-sm font-bold text-gray-900">Contact Phone</span>
                <Input
                  type="tel"
                  inputMode="numeric"
                  placeholder="00 000 0000"
                  value={watchedContacts?.[index]?.phone ?? ''}
                  onChange={(e) =>
                    setValue(`contacts.${index}.phone`, e.target.value.replace(/\D/g, ''))
                  }
                  error={errors.contacts?.[index]?.phone?.message}
                />
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={() => appendContact({ ...CONTACT_PERSON_DEFAULTS })}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm font-medium text-gray-400 hover:border-brand/40 hover:text-brand transition-colors"
          >
            <Icons.Plus className="w-4 h-4" />
            Add another contact
          </button>
        </div>
      </FormSection>

      {/* ── Address / Territory ── */}
      <CounterpartyAddressFields
        control={control}
        register={register}
        setValue={setValue}
        errors={errors}
      />
    </div>
  );
}
