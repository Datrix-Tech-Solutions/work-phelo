'use client';

import { useFieldArray, useWatch } from 'react-hook-form';
import type { Control, UseFormRegister, UseFormSetValue, FieldErrors } from 'react-hook-form';
import { FormField } from '@/components/molecules/shared/FormField';
import { FormSection } from '@/components/atoms/FormSection';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import { Icons } from '@/components/atoms/icons';
import type { BrokerFormValues } from '@/types/reinsurance';

interface BrokerFormFieldsProps {
  control: Control<BrokerFormValues>;
  register: UseFormRegister<BrokerFormValues>;
  setValue: UseFormSetValue<BrokerFormValues>;
  errors: FieldErrors<BrokerFormValues>;
}

export function BrokerFormFields({ control, register, setValue, errors }: BrokerFormFieldsProps) {
  const {
    fields: emailFields,
    append: appendEmail,
    remove: removeEmail,
  } = useFieldArray({ control, name: 'email' });

  const {
    fields: phoneFields,
    append: appendPhone,
    remove: removePhone,
  } = useFieldArray({ control, name: 'phoneNumber' });

  // Mirror inviteEmployeePanel: useWatch + setValue for PhoneInput
  const phoneValues = useWatch({ control, name: 'phoneNumber' });

  return (
    <div className="flex flex-col gap-6">
      {/* ── Basic info ── */}
      <FormSection title="Basic Info">
        <FormField
          label="Broker Name"
          registration={register('name', { required: 'Broker name is required' })}
          error={errors.name}
          placeholder="e.g. Insurance Company Ltd."
        />
      </FormSection>

      {/* ── Email addresses ── */}
      <FormSection title="Email Addresses">
        <div className="flex flex-col gap-3">
          {emailFields.map((field, index) => (
            <div key={field.id} className="relative">
              <FormField
                label={index === 0 ? 'Primary Email' : 'Email'}
                type="email"
                registration={register(`email.${index}.value`, {
                  required: index === 0 ? 'Primary email is required' : false,
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Enter a valid email address',
                  },
                })}
                error={errors.email?.[index]?.value}
                placeholder={index === 0 ? 'e.g. info@brokercompany.com' : 'Additional email'}
              />

              {index > 0 && (
                <button
                  type="button"
                  onClick={() => removeEmail(index)}
                  className="absolute top-0 right-0 p-1 rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                  aria-label="Remove email"
                >
                  <Icons.X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}

          <button
            type="button"
            onClick={() => appendEmail({ value: '' })}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm font-medium text-gray-400 hover:border-brand/40 hover:text-brand transition-colors"
          >
            <Icons.Plus className="w-4 h-4" />
            Add another email
          </button>
        </div>
      </FormSection>

      {/* ── Phone numbers ── */}
      <FormSection title="Phone Numbers">
        <div className="flex flex-col gap-3">
          {phoneFields.map((field, index) => (
            // Each phone sits in a block (flex-col) container — PhoneInput fills full width naturally
            <div key={field.id} className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">
                  {index === 0 ? 'Primary Contact' : 'Phone Number'}
                </span>
                {index > 0 && (
                  <button
                    type="button"
                    onClick={() => removePhone(index)}
                    className="p-1 rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
                    aria-label="Remove phone number"
                  >
                    <Icons.X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <PhoneInput
                placeholder={index === 0 ? '00 000 0000' : 'Additional number'}
                value={phoneValues?.[index]?.value ?? ''}
                onChange={(v) => setValue(`phoneNumber.${index}.value`, v)}
                error={errors.phoneNumber?.[index]?.value?.message}
              />
            </div>
          ))}

          <button
            type="button"
            onClick={() => appendPhone({ value: '' })}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-sm font-medium text-gray-400 hover:border-brand/40 hover:text-brand transition-colors"
          >
            <Icons.Plus className="w-4 h-4" />
            Add another number
          </button>
        </div>
      </FormSection>
    </div>
  );
}
