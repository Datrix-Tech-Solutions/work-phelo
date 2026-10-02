'use client';

import { useMemo, useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import { EmailField } from '@/components/atoms/EmailField';
import { ToggleRow } from '@/components/molecules/shared/ToggleRow';
import { buildCreateOptionEmptyState } from '@/components/molecules/marketing/CreateOptionEmptyState';
import {
  CompanyLocationFields,
  CompanyLocationForm,
} from '@/components/molecules/marketing/CompanyLocationForm';
import {
  useCreateProspectingSetting,
  useProspectingSettings,
} from '@/hooks/marketing/useProspectingSettings';
import { useCreateClient } from '@/hooks/marketing/useClients';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { inputClass, isValidEmail } from '@/lib/utils';
import type { CreateClientPayload, ProspectingSetting } from '@/types/marketing';

interface FormValues {
  companyName: string;
  businessType: string;
  sourceType: string;
  contactName: string;
  roleJobTitle: string;
  phone: string;
  email: string;
  productIds: string[];
  isBillable: boolean;
  location: CompanyLocationFields;
}

type FormErrors = Partial<
  Record<'companyName' | 'businessType' | 'contactName' | 'email' | 'location', string>
>;

const EMPTY: FormValues = {
  companyName: '',
  businessType: '',
  sourceType: '',
  contactName: '',
  roleJobTitle: '',
  phone: '',
  email: '',
  productIds: [],
  isBillable: false,
  location: { location: '' },
};

function toOptions(items: ProspectingSetting[]) {
  return items.map((item) => ({ value: item.id, label: item.name }));
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-2">{children}</p>
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AddClientPanel({ isOpen, onClose }: Props) {
  const toast = useToast();
  const createClient = useCreateClient();

  const [values, setValues] = useState<FormValues>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});

  const { data: businessTypes = [] } = useProspectingSettings('business-types');
  const { data: sourceTypes = [] } = useProspectingSettings('source-types');
  const { data: decisionMakers = [] } = useProspectingSettings('decision-makers');
  const { data: products = [] } = useProspectingSettings('products');

  const businessTypeOptions = useMemo(() => toOptions(businessTypes), [businessTypes]);
  const sourceTypeOptions = useMemo(() => toOptions(sourceTypes), [sourceTypes]);
  const roleOptions = useMemo(() => toOptions(decisionMakers), [decisionMakers]);
  const productOptions = useMemo(() => toOptions(products), [products]);

  const createBusinessType = useCreateProspectingSetting('business-types');
  const createSourceType = useCreateProspectingSetting('source-types');
  const createDecisionMaker = useCreateProspectingSetting('decision-makers');

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleClose() {
    setValues(EMPTY);
    setErrors({});
    onClose();
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (!values.companyName.trim()) next.companyName = 'Company name is required.';
    if (!values.businessType) next.businessType = 'Type of business is required.';
    if (!values.contactName.trim()) next.contactName = 'Contact name is required.';
    if (values.email.trim() && !isValidEmail(values.email))
      next.email = 'Enter a valid email address.';
    if (values.location.lat == null || values.location.lng == null)
      next.location = 'Select a location on the map or from search.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function buildPayload(): CreateClientPayload {
    return {
      companyName: values.companyName.trim(),
      ...(values.businessType ? { businessTypeId: values.businessType } : {}),
      ...(values.sourceType ? { sourceTypeId: values.sourceType } : {}),
      isBillable: values.isBillable,
      primaryContact: {
        name: values.contactName.trim(),
        ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
        ...(values.email.trim() ? { email: values.email.trim() } : {}),
        ...(values.roleJobTitle ? { decisionMakerTypeId: values.roleJobTitle } : {}),
      },
      productIds: values.productIds,
      location: {
        label: values.location.location,
        latitude: values.location.lat as number,
        longitude: values.location.lng as number,
      },
    };
  }

  function handleSubmit() {
    if (!validate()) return;
    createClient.mutate(buildPayload(), {
      onSuccess: () => {
        toast.success('Client created');
        handleClose();
      },
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to create client')),
    });
  }

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="New Client"
      description="Add a business you already work with."
      // width="sm:w-[640px]"
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={createClient.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={createClient.isPending} loadingText="Saving…">
            Create Client
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-(--field-stack-gap,0.75rem)">
        <SectionTitle>Company Data</SectionTitle>

        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Company Name</label>
          <input
            type="text"
            placeholder="eg; Company Name Limited"
            value={values.companyName}
            onChange={(e) => set('companyName', e.target.value)}
            className={inputClass(errors.companyName)}
          />
          {errors.companyName && <p className="text-xs text-red-500">{errors.companyName}</p>}
        </div>

        <SearchSelect
          label="Type of Business"
          placeholder="Select or type to add new"
          options={businessTypeOptions}
          value={values.businessType}
          onChange={(v) => set('businessType', v)}
          error={errors.businessType}
          emptyState={buildCreateOptionEmptyState(
            'business type',
            createBusinessType,
            (id) => set('businessType', id),
            toast,
          )}
        />

        <SearchSelect
          label="Source Type"
          placeholder="Select or type to add new"
          options={sourceTypeOptions}
          value={values.sourceType}
          onChange={(v) => set('sourceType', v)}
          emptyState={buildCreateOptionEmptyState(
            'source type',
            createSourceType,
            (id) => set('sourceType', id),
            toast,
          )}
        />

        <SectionTitle>Contact Person</SectionTitle>

        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <label className="text-sm font-bold text-gray-900">Name</label>
          <input
            type="text"
            placeholder="Contact person's full name"
            value={values.contactName}
            onChange={(e) => set('contactName', e.target.value)}
            className={inputClass(errors.contactName)}
          />
          {errors.contactName && <p className="text-xs text-red-500">{errors.contactName}</p>}
        </div>

        <SearchSelect
          label="Role / Job Title"
          placeholder="Select or type to add new"
          options={roleOptions}
          value={values.roleJobTitle}
          onChange={(v) => set('roleJobTitle', v)}
          emptyState={buildCreateOptionEmptyState(
            'role',
            createDecisionMaker,
            (id) => set('roleJobTitle', id),
            toast,
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <PhoneInput label="Phone" value={values.phone} onChange={(v) => set('phone', v)} />
          <EmailField
            label="Email"
            value={values.email}
            onChange={(v) => set('email', v)}
            error={errors.email}
          />
        </div>

        <SectionTitle>Products &amp; Services</SectionTitle>

        <MultiSelect
          label="Products / Services"
          placeholder="Select products or services"
          options={productOptions}
          value={values.productIds}
          onChange={(v) => set('productIds', v)}
        />

        <SectionTitle>Billing</SectionTitle>

        <ToggleRow
          label="Make billable"
          description="Mark this client as billable."
          enabled={values.isBillable}
          onChange={(v) => set('isBillable', v)}
        />

        <SectionTitle>Location</SectionTitle>

        <CompanyLocationForm values={values.location} onChange={(v) => set('location', v)} />
        {errors.location && <p className="text-xs text-red-500">{errors.location}</p>}
      </div>
    </SidePanel>
  );
}
