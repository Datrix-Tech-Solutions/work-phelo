'use client';

import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { CreatableSearchSelect, CreatableOption } from '@/components/atoms/CreatableSearchSelect';
import {
  PostingRuleDirection,
  PostingRuleLineInput,
  PostingRuleSubledgerType,
} from '@/types/accounting';
import { useCreatePostingRule, useGLAccountOptions } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { getPostingRulePathGuidance } from '@/config/reinsurance-posting-rule-guidance';

interface AddPostingRulePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type LineFormValues = {
  direction: PostingRuleDirection | '';
  glAccountId: string;
  subledgerType: PostingRuleSubledgerType | '';
  subledgerExternalRefSource: string;
  amountSource: string;
  currencySource: string;
  descriptionTemplate: string;
};

type FormValues = {
  name: string;
  sourceModule: string;
  sourceEventType: string;
  version: number | '';
  effectiveFrom: string;
  effectiveTo: string;
  lines: LineFormValues[];
};

const EMPTY_LINE: LineFormValues = {
  direction: '',
  glAccountId: '',
  subledgerType: '',
  subledgerExternalRefSource: '',
  amountSource: '',
  currencySource: '',
  descriptionTemplate: '',
};

const DEFAULTS: FormValues = {
  name: '',
  sourceModule: 'REINSURANCE',
  sourceEventType: '',
  version: 1,
  effectiveFrom: new Date().toISOString().slice(0, 10),
  effectiveTo: '',
  lines: [
    { ...EMPTY_LINE, direction: 'DR' },
    { ...EMPTY_LINE, direction: 'CR' },
  ],
};

// The active reinsurance event families a rule can be written against today —
// see ACTIVE_REINSURANCE_ACCOUNTING_EVENT_TYPES on the reinsurance-service side.
// Free-text entry still works via CreatableSearchSelect for anything not listed.
const SOURCE_EVENT_TYPE_OPTIONS: CreatableOption[] = [
  'DEBIT_NOTE_ISSUED',
  'CREDIT_NOTE_ISSUED',
  'ENDORSEMENT_DEBIT_NOTE_ISSUED',
  'ENDORSEMENT_CREDIT_NOTE_ISSUED',
  'PREMIUM_PAYMENT_RECEIVED',
  'PAYMENT_REVERSED',
  'REINSURER_DISBURSEMENT_RECORDED',
  'REINSURER_DISBURSEMENT_REVERSED',
  'CLAIM_PAYABLE_APPROVED',
  'CLAIM_CEDANT_SETTLEMENT_PAID',
  'CLAIM_CEDANT_SETTLEMENT_REVERSED',
  'CLAIM_RECOVERY_APPROVED',
  'CLAIM_RECOVERY_RECEIVED',
  'CLAIM_RECOVERY_RECEIPT_REVERSED',
].map((value) => ({ value, label: value.replaceAll('_', ' ') }));

const DIRECTION_OPTIONS: SearchSelectOption[] = [
  { value: 'DR', label: 'Debit (DR)' },
  { value: 'CR', label: 'Credit (CR)' },
];

const SUBLEDGER_TYPE_OPTIONS: SearchSelectOption[] = [
  { value: 'CEDANT', label: 'Cedant' },
  { value: 'REINSURER', label: 'Reinsurer' },
  { value: 'CUSTOMER', label: 'Customer' },
  { value: 'VENDOR', label: 'Vendor' },
  { value: 'EMPLOYEE', label: 'Employee' },
  { value: 'STATUTORY', label: 'Statutory' },
  { value: 'OTHER', label: 'Other' },
];

export function AddPostingRulePanel({ isOpen, onClose }: AddPostingRulePanelProps) {
  const toast = useToast();
  const { mutateAsync: createRule, isPending } = useCreatePostingRule();
  const { options: glAccountOptions, isLoading: isLoadingGLAccounts } = useGLAccountOptions();

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });
  const sourceModule = useWatch({ control, name: 'sourceModule' });
  const sourceEventType = useWatch({ control, name: 'sourceEventType' });
  const pathGuidance = getPostingRulePathGuidance(sourceModule, sourceEventType);
  const amountSourceOptions: CreatableOption[] = pathGuidance.amountSources.map((value) => ({
    value,
    label: value,
  }));
  const currencySourceOptions: CreatableOption[] = pathGuidance.currencySources.map((value) => ({
    value,
    label: value,
  }));
  const subledgerReferenceOptions: CreatableOption[] = pathGuidance.subledgerReferenceSources.map(
    (value) => ({ value, label: value }),
  );

  const handleClose = () => {
    reset(DEFAULTS);
    onClose();
  };

  const onSubmit = async (data: FormValues) => {
    const lines: PostingRuleLineInput[] = data.lines
      .filter((line) => line.direction && line.glAccountId && line.amountSource)
      .map((line, index) => ({
        sequence: index + 1,
        direction: line.direction as PostingRuleDirection,
        glAccountId: line.glAccountId,
        subledgerType: line.subledgerType || undefined,
        subledgerExternalRefSource: line.subledgerExternalRefSource || undefined,
        amountSource: line.amountSource,
        currencySource: line.currencySource || 'currency',
        descriptionTemplate: line.descriptionTemplate || `${data.name} — {{sourceRecordId}}`,
      }));

    if (lines.length < 2) {
      toast.error('A posting rule needs at least 2 lines.');
      return;
    }
    const debitCount = lines.filter((l) => l.direction === 'DR').length;
    const creditCount = lines.filter((l) => l.direction === 'CR').length;
    if (debitCount === 0 || creditCount === 0) {
      toast.error('A posting rule needs at least one debit line and one credit line.');
      return;
    }

    try {
      await createRule({
        name: data.name,
        sourceModule: data.sourceModule,
        sourceEventType: data.sourceEventType,
        version: Number(data.version),
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo || undefined,
        lines,
      });
      toast.success(
        'Posting rule created as inactive. Activate it once you’ve reviewed the lines.',
      );
      handleClose();
    } catch (err) {
      toast.error(extractError(err, 'Failed to create posting rule'));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={handleClose}
      title="New Posting Rule"
      description="Map a source business event to the balanced journal lines it should post. Created inactive — review before activating."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button isLoading={isPending} loadingText="Saving…" onClick={handleSubmit(onSubmit)}>
            Save Posting Rule
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <FormField
          label="Rule Name"
          registration={register('name', { required: 'Name is required' })}
          error={errors.name}
          placeholder="e.g. Premium debit note issued"
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Source Module"
            registration={register('sourceModule', {
              required: 'Source module is required',
              setValueAs: (v: string) => v.toUpperCase(),
            })}
            error={errors.sourceModule}
            placeholder="e.g. REINSURANCE"
          />
          <FormField
            label="Version"
            type="number"
            registration={register('version', {
              required: 'Version is required',
              min: { value: 1, message: 'Version must be at least 1' },
              valueAsNumber: true,
            })}
            error={errors.version}
          />
        </div>

        <Controller
          name="sourceEventType"
          control={control}
          rules={{ required: 'Source event type is required' }}
          render={({ field }) => (
            <CreatableSearchSelect
              label="Source Event Type"
              placeholder="Select or type an event type…"
              options={SOURCE_EVENT_TYPE_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.sourceEventType?.message}
            />
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            label="Effective From"
            type="date"
            registration={register('effectiveFrom', { required: 'Effective from is required' })}
            error={errors.effectiveFrom}
          />
          <FormField
            label="Effective To"
            type="date"
            registration={register('effectiveTo')}
            error={errors.effectiveTo}
            placeholder="Optional — open-ended if blank"
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900">Lines</span>
            <Button type="button" variant="outline" onClick={() => append({ ...EMPTY_LINE })}>
              Add Line
            </Button>
          </div>

          {fields.map((field, index) => (
            <div
              key={field.id}
              className="flex flex-col gap-3 rounded-xl border border-gray-200 p-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Line {index + 1}</span>
                {fields.length > 2 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="text-xs font-medium text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Controller
                  name={`lines.${index}.direction`}
                  control={control}
                  rules={{ required: 'Required' }}
                  render={({ field: f }) => (
                    <SearchSelect
                      label="Direction"
                      placeholder="Select…"
                      options={DIRECTION_OPTIONS}
                      value={f.value}
                      onChange={f.onChange}
                      error={errors.lines?.[index]?.direction?.message}
                    />
                  )}
                />
                <Controller
                  name={`lines.${index}.glAccountId`}
                  control={control}
                  rules={{ required: 'Required' }}
                  render={({ field: f }) => (
                    <SearchSelect
                      label="GL Account"
                      placeholder={isLoadingGLAccounts ? 'Loading…' : 'Select GL account…'}
                      options={glAccountOptions}
                      value={f.value}
                      onChange={f.onChange}
                      error={errors.lines?.[index]?.glAccountId?.message}
                    />
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Controller
                  name={`lines.${index}.subledgerType`}
                  control={control}
                  render={({ field: f }) => (
                    <SearchSelect
                      label="Subledger Type (optional)"
                      placeholder="None — control account only"
                      options={SUBLEDGER_TYPE_OPTIONS}
                      value={f.value}
                      onChange={f.onChange}
                    />
                  )}
                />
                <Controller
                  name={`lines.${index}.subledgerExternalRefSource`}
                  control={control}
                  render={({ field: f }) => (
                    <CreatableSearchSelect
                      label="Subledger Ref Source"
                      placeholder="e.g. counterparty.id"
                      options={subledgerReferenceOptions}
                      value={f.value}
                      onChange={f.onChange}
                    />
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Controller
                  name={`lines.${index}.amountSource`}
                  control={control}
                  rules={{ required: 'Required' }}
                  render={({ field: f }) => (
                    <CreatableSearchSelect
                      label="Amount Source"
                      placeholder="e.g. amounts.netPremium"
                      options={amountSourceOptions}
                      value={f.value}
                      onChange={f.onChange}
                      error={errors.lines?.[index]?.amountSource?.message}
                    />
                  )}
                />
                <Controller
                  name={`lines.${index}.currencySource`}
                  control={control}
                  render={({ field: f }) => (
                    <CreatableSearchSelect
                      label="Currency Source"
                      placeholder="Defaults to “currency”"
                      options={currencySourceOptions}
                      value={f.value}
                      onChange={f.onChange}
                    />
                  )}
                />
              </div>

              <FormField
                label="Description Template"
                registration={register(`lines.${index}.descriptionTemplate`)}
                placeholder="Defaults to the rule name + {{sourceRecordId}}"
              />
            </div>
          ))}
        </div>
      </div>
    </SidePanel>
  );
}
