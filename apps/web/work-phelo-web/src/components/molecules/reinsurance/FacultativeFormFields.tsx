'use client';

import { Controller, UseFormReturn } from 'react-hook-form';
import { FormField } from '@/components/molecules/shared/FormField';
import { FormSection } from '@/components/atoms/FormSection';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { FileUpload } from '@/components/atoms/FileUpload';
import { MetricPreview } from '@/components/molecules/shared/MetricPreview';
import { inputClass } from '@/lib/utils';
import {
  FacultativeFormValues,
  TERRITORIAL_SCOPE_OPTIONS,
  CURRENCY_OPTIONS,
} from '@/types/reinsurance';

function ComputedField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-gray-900">{label}</label>
      <div className={inputClass(undefined, 'bg-gray-50 text-gray-500 cursor-default select-none')}>
        {value || <span className="text-gray-300">—</span>}
      </div>
    </div>
  );
}

/* Year options: 2000 → current year + 5 */
const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: currentYear - 2000 + 6 }, (_, i) => {
  const y = String(2000 + i);
  return { value: y, label: y };
});

function toNum(val: number | ''): number | null {
  if (val === '' || isNaN(val as number)) return null;
  return val as number;
}

function fmtAmount(val: number | null, currency: string): string {
  if (val === null) return '—';
  const prefix = currency ? `${currency} ` : '';
  return `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();
}

function fmtPct(val: number | null): string {
  if (val === null) return '—';
  return `${val.toFixed(2)}%`;
}

interface FacultativeFormFieldsProps {
  form: UseFormReturn<FacultativeFormValues>;
}

export default function FacultativeFormFields({ form }: FacultativeFormFieldsProps) {
  const {
    register,
    control,
    watch,
    formState: { errors },
  } = form;

  const startDate = watch('startDate');
  const sumAssured = watch('sumAssured');
  const grossPremium = watch('grossPremium');
  const commission = watch('commission');
  const brokerageFee = watch('brokerageFee');
  const facOffer = watch('facOffer');
  const currency = watch('currency');

  /* ── Derived values ── */
  const sumAssuredNum = toNum(sumAssured);
  const grossPremiumNum = toNum(grossPremium);
  const commissionNum = toNum(commission);
  const brokerageNum = toNum(brokerageFee);
  const facOfferNum = toNum(facOffer);

  const si =
    sumAssuredNum !== null && facOfferNum !== null ? sumAssuredNum * (facOfferNum / 100) : null;

  const offeredGross =
    grossPremiumNum !== null && facOfferNum !== null ? grossPremiumNum * (facOfferNum / 100) : null;

  const netPremium =
    offeredGross !== null && commissionNum !== null && brokerageNum !== null
      ? offeredGross * (1 - commissionNum / 100 - brokerageNum / 100)
      : null;

  const premiumOfferPct =
    offeredGross !== null && si !== null && si > 0 ? (offeredGross / si) * 100 : null;

  return (
    <div className="flex flex-col gap-7">
      {/* ── Risk & Policy Details ── */}
      <FormSection title="Risk & Policy Details">
        <div className="flex flex-col gap-5">
          <Controller
            name="riskClass"
            control={control}
            rules={{ required: 'Risk class is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Risk Class"
                placeholder="Type to search risk class…"
                value={field.value}
                onChange={field.onChange}
                error={errors.riskClass?.message}
                options={[]}
              />
            )}
          />

          <Controller
            name="riskType"
            control={control}
            rules={{ required: 'Risk type is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Risk Type"
                placeholder="Type to search risk type…"
                value={field.value}
                onChange={field.onChange}
                error={errors.riskType?.message}
                options={[]}
              />
            )}
          />

          <FormField
            label="Insured Name"
            registration={register('insuredName', { required: 'Insured name is required' })}
            error={errors.insuredName}
            placeholder="e.g. Accra Breweries Ltd"
          />

          <Controller
            name="cedant"
            control={control}
            rules={{ required: 'Cedant is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Cedant"
                placeholder="Type to search cedant…"
                value={field.value}
                onChange={field.onChange}
                error={errors.cedant?.message}
                options={[]}
              />
            )}
          />
        </div>
      </FormSection>

      {/* ── Broker & Terms ── */}
      <FormSection title="Broker & Terms">
        <div className="flex flex-col gap-5">
          <Controller
            name="brokerName"
            control={control}
            rules={{ required: 'Broker name is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Broker Name"
                placeholder="Type to search broker…"
                value={field.value}
                onChange={field.onChange}
                error={errors.brokerName?.message}
                options={[]}
              />
            )}
          />

          <FormField
            label="Brokerage Fee (%)"
            type="number"
            registration={register('brokerageFee', {
              required: 'Brokerage fee is required',
              min: { value: 0, message: 'Cannot be negative' },
              max: { value: 100, message: 'Cannot exceed 100%' },
              valueAsNumber: true,
            })}
            error={errors.brokerageFee}
            placeholder="e.g. 5"
          />

          <div className="grid grid-cols-2 gap-3">
            <Controller
              name="currency"
              control={control}
              rules={{ required: 'Currency is required' }}
              render={({ field }) => (
                <SearchSelect
                  label="Currency"
                  placeholder="Select currency…"
                  options={CURRENCY_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.currency?.message}
                />
              )}
            />

            <Controller
              name="accountingYear"
              control={control}
              rules={{ required: 'Accounting year is required' }}
              render={({ field }) => (
                <SearchSelect
                  label="Accounting Year"
                  placeholder="Select year…"
                  options={YEAR_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.accountingYear?.message}
                />
              )}
            />
          </div>
        </div>
      </FormSection>

      {/* ── Coverage Period ── */}
      <FormSection title="Coverage Period">
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3">
            <Controller
              name="startDate"
              control={control}
              rules={{ required: 'Start date is required' }}
              render={({ field }) => (
                <DatePicker
                  label="Start Date"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.startDate?.message}
                />
              )}
            />
            <Controller
              name="endDate"
              control={control}
              rules={{ required: 'End date is required' }}
              render={({ field }) => (
                <DatePicker
                  label="End Date"
                  value={field.value}
                  onChange={field.onChange}
                  minDate={startDate || undefined}
                  error={errors.endDate?.message}
                />
              )}
            />
          </div>

          <Controller
            name="territorialScope"
            control={control}
            rules={{ required: 'Territorial scope is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Territorial Scope"
                placeholder="Select territory…"
                options={TERRITORIAL_SCOPE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.territorialScope?.message}
              />
            )}
          />
        </div>
      </FormSection>

      {/* ── Financial Metrics ── */}
      <FormSection title="Financial Metrics">
        <div className="flex flex-col gap-5">
          <FormField
            label="100% Sum Assured"
            type="number"
            registration={register('sumAssured', {
              required: 'Sum assured is required',
              min: { value: 0, message: 'Cannot be negative' },
              valueAsNumber: true,
            })}
            error={errors.sumAssured}
            placeholder="e.g. 5000000"
          />

          <FormField
            label="100% Gross Premium"
            type="number"
            registration={register('grossPremium', {
              required: 'Gross premium is required',
              min: { value: 0, message: 'Cannot be negative' },
              valueAsNumber: true,
            })}
            error={errors.grossPremium}
            placeholder="e.g. 250000"
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              label="Commission (%)"
              type="number"
              registration={register('commission', {
                required: 'Commission is required',
                min: { value: 0, message: 'Cannot be negative' },
                max: { value: 100, message: 'Cannot exceed 100%' },
                valueAsNumber: true,
              })}
              error={errors.commission}
              placeholder="e.g. 15"
            />

            <FormField
              label="Fac Offer (%)"
              type="number"
              registration={register('facOffer', {
                required: 'Fac offer is required',
                min: { value: 0, message: 'Cannot be negative' },
                max: { value: 100, message: 'Cannot exceed 100%' },
                valueAsNumber: true,
              })}
              error={errors.facOffer}
              placeholder="e.g. 60"
            />
          </div>

          <ComputedField label="Premium Offer (%)" value={fmtPct(premiumOfferPct)} />

          <MetricPreview
            title="Offer Summary"
            metrics={[
              { label: 'SI', value: fmtAmount(si, currency) },
              { label: 'Offered Gross', value: fmtAmount(offeredGross, currency) },
              { label: 'Net Premium', value: fmtAmount(netPremium, currency), highlight: true },
            ]}
          />
        </div>
      </FormSection>

      {/* ── Documentation ── */}
      <FormSection title="Documentation">
        <Controller
          name="supportingDocument"
          control={control}
          render={({ field }) => (
            <FileUpload
              label="Supporting Document"
              accept=".pdf,.doc,.docx,.xls,.xlsx"
              value={field.value}
              onChange={field.onChange}
              hint="PDF, Word or Excel — optional"
              error={errors.supportingDocument?.message}
            />
          )}
        />
      </FormSection>
    </div>
  );
}
