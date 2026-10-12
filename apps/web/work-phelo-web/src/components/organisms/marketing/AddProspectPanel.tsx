'use client';

import { useMemo, useState } from 'react';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { MultiSelect } from '@/components/atoms/MultiSelect';
import { PhoneInput } from '@/components/atoms/PhoneInput';
import { EmailField } from '@/components/atoms/EmailField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { AssignedToSelect } from '@/components/molecules/marketing/AssignedToSelect';
import {
  ClientProductDetail,
  ClientProductDetails,
  ClientProductTotals,
  EMPTY_PRODUCT_DETAIL,
} from '@/components/organisms/marketing/ClientProductDetails';
import { buildCreateOptionEmptyState } from '@/components/molecules/marketing/CreateOptionEmptyState';
import {
  CompanyLocationFields,
  CompanyLocationForm,
} from '@/components/molecules/marketing/CompanyLocationForm';
import { usePipelineStages } from '@/hooks/marketing/usePipelineStages';
import {
  useCreateProspectingSetting,
  useProspectingSettings,
} from '@/hooks/marketing/useProspectingSettings';
import { useCreateProspect } from '@/hooks/marketing/useProspects';
import { useMultiEntryPanel } from '@/hooks/useMultiEntryPanel';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { inputClass, isValidEmail } from '@/lib/utils';
import type { CreateProspectPayload, ProspectingSetting } from '@/types/marketing';

interface FormValues {
  companyName: string;
  businessType: string;
  sourceType: string;
  contactName: string;
  roleJobTitle: string;
  phone: string;
  email: string;
  interactionType: string;
  dateContacted: string;
  productIds: string[];
  pipelineStageId: string;
  location: CompanyLocationFields;
  /** Empty means the person creating the prospect. */
  assignedUserId: string;
}

type FormErrors = Partial<
  Record<
    'companyName' | 'businessType' | 'contactName' | 'email' | 'products' | 'stage' | 'location',
    string
  >
>;

const EMPTY: FormValues = {
  companyName: '',
  businessType: '',
  sourceType: '',
  contactName: '',
  roleJobTitle: '',
  phone: '',
  email: '',
  interactionType: '',
  dateContacted: '',
  productIds: [],
  pipelineStageId: '',
  location: { location: '' },
  assignedUserId: '',
};

function toOptions(items: ProspectingSetting[]) {
  return items.map((item) => ({ value: item.id, label: item.name }));
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-1">{children}</p>
  );
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AddProspectPanel({ isOpen, onClose }: Props) {
  const toast = useToast();
  const createProspect = useCreateProspect();

  const [values, setValues] = useState<FormValues>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  // Expected revenue, commission and close date per selected product, keyed by product id.
  const [productDetails, setProductDetails] = useState<Record<string, ClientProductDetail>>({});
  const [productsExpanded, setProductsExpanded] = useState(true);

  const { data: businessTypes = [] } = useProspectingSettings('business-types');
  const { data: sourceTypes = [] } = useProspectingSettings('source-types');
  const { data: interactionMedia = [] } = useProspectingSettings('interaction-media');
  const { data: decisionMakers = [] } = useProspectingSettings('decision-makers');
  const { data: products = [] } = useProspectingSettings('products');
  const { data: pipelineStages = [], isLoading: pipelineStagesLoading } = usePipelineStages();

  const businessTypeOptions = useMemo(() => toOptions(businessTypes), [businessTypes]);
  const sourceTypeOptions = useMemo(() => toOptions(sourceTypes), [sourceTypes]);
  const interactionTypeOptions = useMemo(() => toOptions(interactionMedia), [interactionMedia]);
  const roleOptions = useMemo(() => toOptions(decisionMakers), [decisionMakers]);
  const productOptions = useMemo(() => toOptions(products), [products]);
  const stageOptions = useMemo(
    () => pipelineStages.map((stage) => ({ value: stage.id, label: stage.name })),
    [pipelineStages],
  );

  const createBusinessType = useCreateProspectingSetting('business-types');
  const createSourceType = useCreateProspectingSetting('source-types');
  const createInteractionMedium = useCreateProspectingSetting('interaction-media');
  const createDecisionMaker = useCreateProspectingSetting('decision-makers');

  function set<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setValues(EMPTY);
    setErrors({});
    setProductDetails({});
    setProductsExpanded(true);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  // Multi-entry: with the lock on, saving keeps the panel open and asks Continue / Stop;
  // Continue clears the form for the next prospect.
  const entry = useMultiEntryPanel({ isOpen, onStop: handleClose, onContinue: resetForm });

  function detailFor(productId: string) {
    return productDetails[productId] ?? EMPTY_PRODUCT_DETAIL;
  }

  function validate(): boolean {
    const next: FormErrors = {};
    if (!values.companyName.trim()) next.companyName = 'Company name is required.';
    if (!values.businessType) next.businessType = 'Type of business is required.';
    if (!values.contactName.trim()) next.contactName = 'Contact name is required.';
    if (values.email.trim() && !isValidEmail(values.email))
      next.email = 'Enter a valid email address.';
    const hasRevenue = values.productIds.some((id) =>
      Number.isFinite(parseFloat(detailFor(id).expectedRevenue)),
    );
    if (!hasRevenue) next.products = 'Add at least one product/service with an expected revenue.';
    if (!values.pipelineStageId) next.stage = 'Pipeline stage is required.';
    if (values.location.lat == null || values.location.lng == null)
      next.location = 'Select a location on the map or from search.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function buildPayload(): CreateProspectPayload {
    return {
      companyName: values.companyName.trim(),
      ...(values.assignedUserId ? { assignedUserId: values.assignedUserId } : {}),
      ...(values.businessType ? { businessTypeId: values.businessType } : {}),
      ...(values.sourceType ? { sourceTypeId: values.sourceType } : {}),
      pipelineStageId: values.pipelineStageId,
      primaryContact: {
        name: values.contactName.trim(),
        ...(values.phone.trim() ? { phone: values.phone.trim() } : {}),
        ...(values.email.trim() ? { email: values.email.trim() } : {}),
        ...(values.roleJobTitle ? { decisionMakerTypeId: values.roleJobTitle } : {}),
      },
      // Products without an expected revenue are left out, as in the old wizard.
      products: values.productIds.flatMap((productId) => {
        const detail = detailFor(productId);
        const expected = parseFloat(detail.expectedRevenue);
        if (!Number.isFinite(expected)) return [];
        const rate = parseFloat(detail.commissionRate);
        return [
          {
            productId,
            expectedValue: expected,
            ...(Number.isFinite(rate) ? { commissionRate: rate } : {}),
            ...(detail.expectedCloseDate ? { expectedCloseDate: detail.expectedCloseDate } : {}),
          },
        ];
      }),
      location: {
        label: values.location.location,
        latitude: values.location.lat as number,
        longitude: values.location.lng as number,
      },
      ...(values.dateContacted
        ? {
            initialInteraction: {
              occurredAt: values.dateContacted,
              ...(values.interactionType ? { interactionMediumId: values.interactionType } : {}),
              decisionMakerInvolved: values.contactName.trim() !== '',
            },
          }
        : {}),
    };
  }

  function handleSubmit() {
    if (!validate()) return;
    createProspect.mutate(buildPayload(), {
      onSuccess: () => {
        toast.success('Prospect created');
        entry.finishSave(
          { title: 'Prospect Added!', message: `${values.companyName.trim()} has been added.` },
          handleClose,
        );
      },
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to create prospect')),
    });
  }

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      {...entry.panelProps}
      title="New Prospect"
      description="Add a business you are pursuing."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={createProspect.isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} isLoading={createProspect.isPending} loadingText="Saving…">
            Create Prospect
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
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

        <div className="grid grid-cols-2 gap-4">
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
        </div>

        <SectionTitle>Contact Person</SectionTitle>

        <div className="grid grid-cols-[3fr_2fr] gap-4">
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
            label="Decision Maker Role"
            placeholder="Select or type to add new"
            options={roleOptions}
            value={values.roleJobTitle}
            onChange={(v) => set('roleJobTitle', v)}
            emptyState={buildCreateOptionEmptyState(
              'decision maker',
              createDecisionMaker,
              (id) => set('roleJobTitle', id),
              toast,
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <PhoneInput label="Phone" value={values.phone} onChange={(v) => set('phone', v)} />
          <EmailField
            label="Email"
            value={values.email}
            onChange={(v) => set('email', v)}
            error={errors.email}
          />
        </div>

        <SectionTitle>First Contact</SectionTitle>

        <div className="grid grid-cols-2 gap-4">
          <SearchSelect
            label="Interaction Type"
            placeholder="Select or type to add new"
            options={interactionTypeOptions}
            value={values.interactionType}
            onChange={(v) => set('interactionType', v)}
            emptyState={buildCreateOptionEmptyState(
              'interaction type',
              createInteractionMedium,
              (id) => set('interactionType', id),
              toast,
            )}
          />
          <DatePicker
            label="Date Contacted"
            value={values.dateContacted}
            onChange={(v) => set('dateContacted', v)}
          />
        </div>

        <SectionTitle>Products/Services</SectionTitle>

        <div className="grid grid-cols-[3fr_2fr] gap-4">
          <MultiSelect
            label="Products/Services"
            placeholder="Select products/services"
            options={productOptions}
            value={values.productIds}
            onChange={(v) => set('productIds', v)}
          />
          <AssignedToSelect
            record="prospect"
            value={values.assignedUserId}
            onChange={(id) => set('assignedUserId', id)}
          />
        </div>

        {(productsExpanded || values.productIds.length < 2) &&
          values.productIds.map((id) => (
            <ClientProductDetails
              key={id}
              name={productOptions.find((o) => o.value === id)?.label ?? 'Product/Service'}
              value={detailFor(id)}
              onChange={(detail) => setProductDetails((prev) => ({ ...prev, [id]: detail }))}
            />
          ))}

        {values.productIds.length > 1 && (
          <ClientProductTotals
            details={values.productIds.map(detailFor)}
            inline
            expanded={productsExpanded}
            onToggle={() => setProductsExpanded((v) => !v)}
          />
        )}
        {errors.products && <p className="text-xs text-red-500">{errors.products}</p>}

        <SectionTitle>Sale Stage</SectionTitle>

        <SearchSelect
          label="Pipeline Stage"
          placeholder={pipelineStagesLoading ? 'Loading stages...' : 'Select stage'}
          options={stageOptions}
          value={values.pipelineStageId}
          onChange={(v) => set('pipelineStageId', v)}
          error={errors.stage}
          disabled={pipelineStagesLoading}
        />

        <SectionTitle>Location</SectionTitle>

        <CompanyLocationForm
          values={values.location}
          onChange={(v) => set('location', v)}
          collapsibleMap
          compact
        />
        {errors.location && <p className="text-xs text-red-500">{errors.location}</p>}
      </div>
    </SidePanel>
  );
}
