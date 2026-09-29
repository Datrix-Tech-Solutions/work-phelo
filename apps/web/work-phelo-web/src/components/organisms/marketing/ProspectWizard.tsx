'use client';

import { useMemo, useState } from 'react';
import { ProspectFormLayout } from '@/components/organisms/marketing/ProspectFormLayout';
import {
  CompanyInformationForm,
  CompanyInformationFields,
  CompanyInformationErrors,
} from '@/components/molecules/marketing/CompanyInformationForm';
import {
  ProductServiceForm,
  ProductServiceRow,
} from '@/components/molecules/marketing/ProductServiceForm';
import {
  CompanyLocationForm,
  CompanyLocationFields,
} from '@/components/molecules/marketing/CompanyLocationForm';
import { SaleStageForm, SaleStageFields } from '@/components/molecules/marketing/SaleStageForm';
import { ProspectPreview } from '@/components/molecules/marketing/ProspectPreview';
import { buildCreateOptionEmptyState } from '@/components/molecules/marketing/CreateOptionEmptyState';
import { usePipelineStages } from '@/hooks/marketing/usePipelineStages';
import {
  useCreateProspectingSetting,
  useProspectingSettings,
} from '@/hooks/marketing/useProspectingSettings';
import { useToast } from '@/hooks/useToast';
import { isValidEmail } from '@/lib/utils';
import { ProspectingSetting } from '@/types/marketing';

const STEPS = [
  'Company Information',
  'Product / Service Info.',
  'Company Location',
  'Sale Stage',
  'Preview',
];

const EMPTY_COMPANY: CompanyInformationFields = {
  companyName: '',
  businessType: '',
  contactName: '',
  phone: '',
  email: '',
  interactionType: '',
  roleJobTitle: '',
  sourceType: '',
  dateContacted: '',
};

function emptyProductRow(): ProductServiceRow {
  return {
    id: crypto.randomUUID(),
    productType: '',
    expectedRevenue: '',
    achievedRevenue: '',
    expectedCloseDate: '',
  };
}

const EMPTY_SALE_STAGE: SaleStageFields = { pipelineStageId: '' };

export interface ProspectWizardValues {
  company: CompanyInformationFields;
  productRows: ProductServiceRow[];
  location: CompanyLocationFields;
  saleStage: SaleStageFields;
}

interface ProspectWizardProps {
  tenantSlug: string;
  /** Shown as the last breadcrumb segment. */
  title: string;
  /** Prefills the steps when editing an existing prospect. */
  initialValues?: ProspectWizardValues;
  /** Editing hides the interaction fields — updates don't touch interaction history. */
  isEdit?: boolean;
  isSubmitting: boolean;
  onSubmit: (values: ProspectWizardValues) => void;
  onCancel: () => void;
}

function toOptions(items: ProspectingSetting[]) {
  return items.map((item) => ({ value: item.id, label: item.name }));
}

/** A row counts once it has a product picked and an expected revenue entered. */
export function isCompleteRow(row: ProductServiceRow): boolean {
  return !!row.productType && row.expectedRevenue.trim() !== '';
}

export function ProspectWizard({
  tenantSlug,
  title,
  initialValues,
  isEdit = false,
  isSubmitting,
  onSubmit,
  onCancel,
}: ProspectWizardProps) {
  const toast = useToast();

  const [currentStep, setCurrentStep] = useState(0);

  const [companyForm, setCompanyForm] = useState<CompanyInformationFields>(
    initialValues?.company ?? EMPTY_COMPANY,
  );
  const [companyErrors, setCompanyErrors] = useState<CompanyInformationErrors>({});

  const [productRows, setProductRows] = useState<ProductServiceRow[]>(
    initialValues?.productRows ?? [emptyProductRow()],
  );
  const [productsError, setProductsError] = useState<string | undefined>();

  const [locationForm, setLocationForm] = useState<CompanyLocationFields>(
    initialValues?.location ?? { location: '' },
  );
  const [locationError, setLocationError] = useState<string | undefined>();

  const [saleStageForm, setSaleStageForm] = useState<SaleStageFields>(
    initialValues?.saleStage ?? EMPTY_SALE_STAGE,
  );
  const [saleStageError, setSaleStageError] = useState<string | undefined>();

  // CRM Settings — these back the dropdowns and the preview step below.
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
  const productTypeOptions = useMemo(() => toOptions(products), [products]);

  const createBusinessType = useCreateProspectingSetting('business-types');
  const createSourceType = useCreateProspectingSetting('source-types');
  const createInteractionMedium = useCreateProspectingSetting('interaction-media');
  const createDecisionMaker = useCreateProspectingSetting('decision-makers');

  const pipelineStageOptions = useMemo(
    () => pipelineStages.map((stage) => ({ value: stage.id, label: stage.name })),
    [pipelineStages],
  );

  function validateStep(): boolean {
    if (currentStep === 0) {
      const next: CompanyInformationErrors = {};
      if (!companyForm.companyName.trim()) next.companyName = 'Company name is required.';
      if (!companyForm.contactName.trim()) next.contactName = 'Contact name is required.';
      if (!companyForm.email.trim()) next.email = 'Email is required.';
      else if (!isValidEmail(companyForm.email)) next.email = 'Enter a valid email address.';
      setCompanyErrors(next);
      return Object.keys(next).length === 0;
    }
    if (currentStep === 1) {
      const hasCompleteRow = productRows.some(isCompleteRow);
      setProductsError(
        hasCompleteRow ? undefined : 'Add at least one product with an expected revenue.',
      );
      return hasCompleteRow;
    }
    if (currentStep === 2) {
      const hasLocation = locationForm.lat != null && locationForm.lng != null;
      setLocationError(hasLocation ? undefined : 'Select a location on the map or from search.');
      return hasLocation;
    }
    if (currentStep === 3) {
      const hasStage = !!saleStageForm.pipelineStageId;
      setSaleStageError(hasStage ? undefined : 'Pipeline stage is required.');
      return hasStage;
    }
    return true;
  }

  function handleSubmit() {
    onSubmit({
      company: companyForm,
      productRows: productRows.filter(isCompleteRow),
      location: locationForm,
      saleStage: saleStageForm,
    });
  }

  function handleNext() {
    if (!validateStep()) return;
    if (currentStep === STEPS.length - 1) {
      handleSubmit();
      return;
    }
    setCurrentStep((s) => s + 1);
  }

  function handleBack() {
    setCompanyErrors({});
    setProductsError(undefined);
    setLocationError(undefined);
    setSaleStageError(undefined);
    setCurrentStep((s) => s - 1);
  }

  return (
    <ProspectFormLayout
      steps={STEPS}
      currentStep={currentStep}
      tenantSlug={tenantSlug}
      prospectName={title}
      onNext={handleNext}
      onBack={handleBack}
      onCancel={onCancel}
      nextLabel={currentStep === STEPS.length - 1 ? (isEdit ? 'Save Changes' : 'Submit') : 'Next'}
      isLoading={isSubmitting}
    >
      {currentStep === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-8">
          <CompanyInformationForm
            values={companyForm}
            onChange={setCompanyForm}
            errors={companyErrors}
            businessTypeOptions={businessTypeOptions}
            interactionTypeOptions={interactionTypeOptions}
            roleOptions={roleOptions}
            sourceTypeOptions={sourceTypeOptions}
            hideInteraction={isEdit}
            businessTypeEmptyState={buildCreateOptionEmptyState(
              'business type',
              createBusinessType,
              (id) => setCompanyForm((f) => ({ ...f, businessType: id })),
              toast,
            )}
            interactionTypeEmptyState={buildCreateOptionEmptyState(
              'interaction type',
              createInteractionMedium,
              (id) => setCompanyForm((f) => ({ ...f, interactionType: id })),
              toast,
            )}
            roleEmptyState={buildCreateOptionEmptyState(
              'decision maker',
              createDecisionMaker,
              (id) => setCompanyForm((f) => ({ ...f, roleJobTitle: id })),
              toast,
            )}
            sourceTypeEmptyState={buildCreateOptionEmptyState(
              'source type',
              createSourceType,
              (id) => setCompanyForm((f) => ({ ...f, sourceType: id })),
              toast,
            )}
          />
        </div>
      )}
      {currentStep === 1 && (
        <div className="flex flex-col gap-2">
          <ProductServiceForm
            rows={productRows}
            onChange={setProductRows}
            productTypeOptions={productTypeOptions}
          />
          {productsError && <p className="text-xs text-red-500">{productsError}</p>}
        </div>
      )}
      {currentStep === 2 && (
        <div className="flex flex-col gap-2">
          <CompanyLocationForm values={locationForm} onChange={setLocationForm} />
          {locationError && <p className="text-xs text-red-500">{locationError}</p>}
        </div>
      )}
      {currentStep === 3 && (
        <SaleStageForm
          values={saleStageForm}
          onChange={setSaleStageForm}
          error={saleStageError}
          pipelineStageOptions={pipelineStageOptions}
          isLoading={pipelineStagesLoading}
        />
      )}
      {currentStep === 4 && (
        <ProspectPreview
          company={companyForm}
          productRows={productRows.filter(isCompleteRow)}
          location={locationForm}
          saleStage={saleStageForm}
          businessTypeOptions={businessTypeOptions}
          interactionTypeOptions={interactionTypeOptions}
          roleOptions={roleOptions}
          sourceTypeOptions={sourceTypeOptions}
          productTypeOptions={productTypeOptions}
          pipelineStageOptions={pipelineStageOptions}
          hideInteraction={isEdit}
        />
      )}
    </ProspectFormLayout>
  );
}
