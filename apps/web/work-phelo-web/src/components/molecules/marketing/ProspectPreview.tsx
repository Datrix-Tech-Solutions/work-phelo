'use client';

import { formatMoney } from '@/lib/formatMoney';
import { ProspectFormSection } from '@/components/molecules/marketing/ProspectFormSection';
import { CompanyInformationFields } from '@/components/molecules/marketing/CompanyInformationForm';
import { ProductServiceRow } from '@/components/molecules/marketing/ProductServiceForm';
import { CompanyLocationFields } from '@/components/molecules/marketing/CompanyLocationForm';
import { SaleStageFields } from '@/components/molecules/marketing/SaleStageForm';

type Option = { value: string; label: string };

interface Props {
  company: CompanyInformationFields;
  productRows: ProductServiceRow[];
  location: CompanyLocationFields;
  saleStage: SaleStageFields;
  businessTypeOptions: Option[];
  interactionTypeOptions: Option[];
  roleOptions: Option[];
  sourceTypeOptions: Option[];
  productTypeOptions: Option[];
  pipelineStageOptions: Option[];
  hideInteraction?: boolean;
}

function labelFor(options: Option[], value: string): string {
  if (!value) return '—';
  return options.find((o) => o.value === value)?.label ?? '—';
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-900">{value || '—'}</p>
    </div>
  );
}

export function ProspectPreview({
  company,
  productRows,
  location,
  saleStage,
  businessTypeOptions,
  interactionTypeOptions,
  roleOptions,
  sourceTypeOptions,
  productTypeOptions,
  pipelineStageOptions,
  hideInteraction = false,
}: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-8">
      <ProspectFormSection title="Company Data">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Company Name" value={company.companyName} />
          <Field
            label="Type of Business"
            value={labelFor(businessTypeOptions, company.businessType)}
          />
          {/* <Field label="Decision Maker" value={company.contactName} /> */}
          <Field label="Decision Maker Role" value={labelFor(roleOptions, company.roleJobTitle)} />
        </div>
      </ProspectFormSection>

      <ProspectFormSection title="Contact Person">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Name" value={company.contactPerson} />
          <Field label="Phone" value={company.phone} />
          <Field label="Email" value={company.email} />
          {!hideInteraction && (
            <Field
              label="Interaction Type"
              value={labelFor(interactionTypeOptions, company.interactionType)}
            />
          )}
          <Field label="Source Type" value={labelFor(sourceTypeOptions, company.sourceType)} />
          {!hideInteraction && <Field label="Date Contacted" value={company.dateContacted} />}
        </div>
      </ProspectFormSection>

      <ProspectFormSection title="Products / Services">
        <div className="flex flex-col gap-2">
          {productRows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-4 gap-4 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5"
            >
              <Field label="Product" value={labelFor(productTypeOptions, row.productType)} />
              <Field label="Expected Revenue" value={formatMoney(row.expectedRevenue)} />
              <Field label="Achieved Revenue" value={formatMoney(row.achievedRevenue)} />
              <Field label="Expected Close Date" value={row.expectedCloseDate} />
            </div>
          ))}
        </div>
      </ProspectFormSection>

      <ProspectFormSection title="Company Location">
        <Field label="Location" value={location.location} />
      </ProspectFormSection>

      <ProspectFormSection title="Sale Stage">
        <Field
          label="Pipeline Stage"
          value={labelFor(pipelineStageOptions, saleStage.pipelineStageId)}
        />
      </ProspectFormSection>
    </div>
  );
}
