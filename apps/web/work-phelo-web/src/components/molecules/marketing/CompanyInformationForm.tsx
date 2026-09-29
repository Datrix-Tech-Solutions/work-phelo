'use client';

import { inputClass } from '@/lib/utils';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import { EmailField } from '@/components/atoms/EmailField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { ProspectFormSection } from '@/components/molecules/marketing/ProspectFormSection';

export interface CompanyInformationFields {
  companyName: string;
  businessType: string;
  contactName: string;
  phone: string;
  email: string;
  interactionType: string;
  roleJobTitle: string;
  sourceType: string;
  dateContacted: string;
}

export type CompanyInformationErrors = Partial<Record<keyof CompanyInformationFields, string>>;

type EmptyState = (ctx: { query: string; close: () => void }) => React.ReactNode;

interface Props {
  values: CompanyInformationFields;
  onChange: (values: CompanyInformationFields) => void;
  errors?: CompanyInformationErrors;
  businessTypeOptions?: { value: string; label: string }[];
  interactionTypeOptions?: { value: string; label: string }[];
  roleOptions?: { value: string; label: string }[];
  sourceTypeOptions?: { value: string; label: string }[];
  /** Hides interaction type and date contacted (not editable after creation). */
  hideInteraction?: boolean;
  /** Lets the user create a new option inline when nothing matches what they typed —
   *  see components/molecules/marketing/CreateOptionEmptyState.tsx. */
  businessTypeEmptyState?: EmptyState;
  interactionTypeEmptyState?: EmptyState;
  roleEmptyState?: EmptyState;
  sourceTypeEmptyState?: EmptyState;
}

export function CompanyInformationForm({
  values,
  onChange,
  errors,
  businessTypeOptions = [],
  interactionTypeOptions = [],
  roleOptions = [],
  sourceTypeOptions = [],
  hideInteraction = false,
  businessTypeEmptyState,
  interactionTypeEmptyState,
  roleEmptyState,
  sourceTypeEmptyState,
}: Props) {
  function set<K extends keyof CompanyInformationFields>(key: K, val: CompanyInformationFields[K]) {
    onChange({ ...values, [key]: val });
  }

  return (
    <div>
      {/* Section 1 — Company Data */}
      <ProspectFormSection title="Company Data">
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Company Name</label>
          <input
            type="text"
            placeholder="eg; Company Name Limited"
            value={values.companyName}
            onChange={(e) => set('companyName', e.target.value)}
            className={inputClass(errors?.companyName)}
          />
          {errors?.companyName && <p className="text-xs text-red-500">{errors.companyName}</p>}
        </div>

        <SearchSelect
          label="Type of Business"
          placeholder="Select or type to add new"
          options={businessTypeOptions}
          value={values.businessType}
          onChange={(v) => set('businessType', v)}
          error={errors?.businessType}
          emptyState={businessTypeEmptyState}
        />
      </ProspectFormSection>

      {/* Section 2 — Contact Person Data */}
      <ProspectFormSection title="Contact Person Data">
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Name</label>
          <input
            type="text"
            placeholder="Contact person's full name"
            value={values.contactName}
            onChange={(e) => set('contactName', e.target.value)}
            className={inputClass(errors?.contactName)}
          />
          {errors?.contactName && <p className="text-xs text-red-500">{errors.contactName}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <PhoneInput
            label="Phone"
            value={values.phone}
            onChange={(v) => set('phone', v)}
            error={errors?.phone}
          />
          <EmailField
            label="Email"
            value={values.email}
            onChange={(v) => set('email', v)}
            error={errors?.email}
          />
        </div>

        {!hideInteraction && (
          <SearchSelect
            label="Interaction Type"
            placeholder="Select or type to add new"
            options={interactionTypeOptions}
            value={values.interactionType}
            onChange={(v) => set('interactionType', v)}
            error={errors?.interactionType}
            emptyState={interactionTypeEmptyState}
          />
        )}

        <SearchSelect
          label="Role / Job Title"
          placeholder="Select or type to add new"
          options={roleOptions}
          value={values.roleJobTitle}
          onChange={(v) => set('roleJobTitle', v)}
          error={errors?.roleJobTitle}
          emptyState={roleEmptyState}
        />

        <SearchSelect
          label="Source Type"
          placeholder="Select or type to add new"
          options={sourceTypeOptions}
          value={values.sourceType}
          onChange={(v) => set('sourceType', v)}
          error={errors?.sourceType}
          emptyState={sourceTypeEmptyState}
        />

        {!hideInteraction && (
          <DatePicker
            label="Date Contacted"
            value={values.dateContacted}
            onChange={(v) => set('dateContacted', v)}
            error={errors?.dateContacted}
          />
        )}
      </ProspectFormSection>
    </div>
  );
}
