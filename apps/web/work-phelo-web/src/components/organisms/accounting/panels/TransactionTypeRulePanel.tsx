'use client';

import { useEffect, useMemo } from 'react';
import { Control, Controller, FieldErrors, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import {
  useCreateTransactionTypeRule,
  useGLAccountOptions,
  useTaxTypes,
  useTransactionTypes,
  useUpdateTransactionTypeRule,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { SUBLEDGER_TYPE_LABELS } from '@/types/accounting';
import type {
  PostingLineDirection,
  SubledgerType,
  TransactionTypeRule,
  TransactionTypeRuleLineInput,
} from '@/types/accounting';

type LineKind = 'DEBIT' | 'CREDIT' | 'DEDUCTION' | '';

const KIND_OPTIONS: SearchSelectOption[] = [
  { label: 'Debit', value: 'DEBIT' },
  { label: 'Credit', value: 'CREDIT' },
  { label: 'Deduction', value: 'DEDUCTION' },
];

const DEDUCTION_DIRECTION_OPTIONS: SearchSelectOption[] = [
  { value: 'DR', label: 'Debit (DR)' },
  { value: 'CR', label: 'Credit (CR)' },
];

type LineFormValues = {
  kind: LineKind;
  /** Only used when kind is DEDUCTION — a deduction can land on either side
   *  (e.g. output VAT is a credit, input VAT is a debit). */
  deductionDirection: PostingLineDirection | '';
  accountId: string;
  /** Only used when kind is DEDUCTION. */
  taxTypeId: string;
  subledgerType: SubledgerType | '';
  description: string;
};

type FormValues = {
  transactionTypeId: string;
  description: string;
  lines: LineFormValues[];
};

const EMPTY_LINE: LineFormValues = {
  kind: 'DEBIT',
  deductionDirection: '',
  accountId: '',
  taxTypeId: '',
  subledgerType: '',
  description: '',
};

const DEFAULTS: FormValues = {
  transactionTypeId: '',
  description: '',
  lines: [
    { ...EMPTY_LINE, kind: 'DEBIT' },
    { ...EMPTY_LINE, kind: 'CREDIT' },
  ],
};

function directionOf(line: LineFormValues): PostingLineDirection | '' {
  if (line.kind === 'DEBIT') return 'DR';
  if (line.kind === 'CREDIT') return 'CR';
  if (line.kind === 'DEDUCTION') return line.deductionDirection;
  return '';
}

function lineToFormValues(line: TransactionTypeRule['lines'][number]): LineFormValues {
  if (line.taxType) {
    return {
      kind: 'DEDUCTION',
      deductionDirection: line.direction,
      accountId: line.account.id,
      taxTypeId: line.taxType.id,
      subledgerType: line.subledgerType ?? '',
      description: line.description ?? '',
    };
  }
  return {
    kind: line.direction === 'DR' ? 'DEBIT' : 'CREDIT',
    deductionDirection: '',
    accountId: line.account.id,
    taxTypeId: '',
    subledgerType: line.subledgerType ?? '',
    description: line.description ?? '',
  };
}

export function TransactionTypeRulePanel({
  isOpen,
  rule,
  defaultTransactionTypeId,
  onClose,
}: {
  isOpen: boolean;
  rule: TransactionTypeRule | null | undefined;
  /** Pre-fills the Transaction Type field when adding a rule from a type's quick action. */
  defaultTransactionTypeId?: string;
  onClose: () => void;
}) {
  const isEditing = !!rule;
  const toast = useToast();
  const { mutateAsync: create, isPending: isCreating } = useCreateTransactionTypeRule();
  const { mutateAsync: update, isPending: isUpdating } = useUpdateTransactionTypeRule();
  const { data: transactionTypes = [] } = useTransactionTypes();
  const { data: taxTypes = [] } = useTaxTypes();
  const { options: accountOptions, isLoading: isLoadingAccounts } = useGLAccountOptions();

  const selectedType = transactionTypes.find(
    (t) => t.id === (rule?.transactionTypeId ?? defaultTransactionTypeId),
  );
  const businessRoles = selectedType?.businessRoles ?? [];
  const subledgerTypeOptions: SearchSelectOption[] = businessRoles
    .filter((role): role is SubledgerType => role in SUBLEDGER_TYPE_LABELS)
    .map((role) => ({ value: role, label: SUBLEDGER_TYPE_LABELS[role] }));
  const taxTypeOptions: SearchSelectOption[] = taxTypes.map((t) => ({
    value: t.id,
    label: `${t.name} (${t.rate}%)`,
  }));

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  useEffect(() => {
    if (!isOpen) return;
    if (rule)
      reset({
        transactionTypeId: rule.transactionTypeId,
        description: rule.description ?? '',
        lines: rule.lines.map(lineToFormValues),
      });
    else reset({ ...DEFAULTS, transactionTypeId: defaultTransactionTypeId ?? '' });
  }, [isOpen, rule, defaultTransactionTypeId, reset]);

  const transactionTypeLabel = useMemo(() => {
    if (!selectedType) return '';
    return `${selectedType.name} (${selectedType.code})`;
  }, [selectedType]);

  const close = () => {
    reset(DEFAULTS);
    onClose();
  };

  const submit = async (values: FormValues) => {
    for (const line of values.lines) {
      if (line.kind === 'DEDUCTION' && !line.deductionDirection) {
        toast.error('Every deduction line needs a Debit/Credit side.');
        return;
      }
    }

    const lines: TransactionTypeRuleLineInput[] = values.lines.map((line) => ({
      direction: directionOf(line) as PostingLineDirection,
      accountId: line.accountId,
      taxTypeId: line.kind === 'DEDUCTION' ? line.taxTypeId || undefined : undefined,
      subledgerType: (line.subledgerType || undefined) as SubledgerType | undefined,
      description: line.description || undefined,
    }));

    if (lines.length < 2) {
      toast.error('A rule needs at least 2 lines.');
      return;
    }
    const debitCount = lines.filter((l) => l.direction === 'DR').length;
    const creditCount = lines.filter((l) => l.direction === 'CR').length;
    if (debitCount === 0 || creditCount === 0) {
      toast.error('A rule needs at least one debit line and one credit line.');
      return;
    }

    try {
      if (rule) {
        await update({ id: rule.id, description: values.description || undefined, lines });
      } else {
        await create({
          transactionTypeId: values.transactionTypeId,
          description: values.description || undefined,
          lines,
        });
      }
      toast.success(isEditing ? 'Rule updated successfully' : 'Rule created successfully');
      close();
    } catch (error) {
      toast.error(extractError(error, `Unable to ${isEditing ? 'update' : 'create'} rule`));
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={close}
      title={isEditing ? 'Update Rule' : 'Add Rule'}
      description="Map how this transaction type posts — a debit line, a credit line, and any deductions (tax) it needs."
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={close} disabled={isCreating || isUpdating}>
            Cancel
          </Button>
          <Button
            isLoading={isCreating || isUpdating}
            loadingText="Saving…"
            onClick={handleSubmit(submit)}
          >
            {isEditing ? 'Save Changes' : 'Add Rule'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {isEditing || defaultTransactionTypeId ? (
          <Input label="Transaction Type" readOnly value={transactionTypeLabel} />
        ) : (
          <Controller
            name="transactionTypeId"
            control={control}
            rules={{ required: 'Transaction type is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Transaction Type"
                placeholder="Select a transaction type…"
                options={transactionTypes
                  .filter((t) => t.rulesCount === 0)
                  .map((t) => ({ value: t.id, label: t.name, sublabel: t.code }))}
                value={field.value}
                onChange={field.onChange}
                error={errors.transactionTypeId?.message}
              />
            )}
          />
        )}

        <FormField
          label="Description"
          type="textarea"
          rows={2}
          registration={register('description')}
          placeholder="Optional description"
        />

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900">Lines</span>
            <Button type="button" variant="outline" onClick={() => append({ ...EMPTY_LINE })}>
              Add Line
            </Button>
          </div>

          {fields.map((field, index) => (
            <RuleLineEditor
              key={field.id}
              control={control}
              register={register}
              errors={errors}
              index={index}
              canRemove={fields.length > 2}
              onRemove={() => remove(index)}
              accountOptions={accountOptions}
              isLoadingAccounts={isLoadingAccounts}
              subledgerTypeOptions={subledgerTypeOptions}
              taxTypeOptions={taxTypeOptions}
            />
          ))}
        </div>
      </div>
    </SidePanel>
  );
}

function RuleLineEditor({
  control,
  register,
  errors,
  index,
  canRemove,
  onRemove,
  accountOptions,
  isLoadingAccounts,
  subledgerTypeOptions,
  taxTypeOptions,
}: {
  control: Control<FormValues>;
  register: ReturnType<typeof useForm<FormValues>>['register'];
  errors: FieldErrors<FormValues>;
  index: number;
  canRemove: boolean;
  onRemove: () => void;
  accountOptions: SearchSelectOption[];
  isLoadingAccounts: boolean;
  subledgerTypeOptions: SearchSelectOption[];
  taxTypeOptions: SearchSelectOption[];
}) {
  const kind = useWatch({ control, name: `lines.${index}.kind` });

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-500">Line {index + 1}</span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs font-medium text-red-600 hover:text-red-700"
          >
            Remove
          </button>
        )}
      </div>

      <Controller
        name={`lines.${index}.kind`}
        control={control}
        rules={{ required: 'Required' }}
        render={({ field: f }) => (
          <SearchSelect
            label="Line Type"
            placeholder="Debit, Credit, or Deduction…"
            options={KIND_OPTIONS}
            value={f.value}
            onChange={f.onChange}
            error={errors.lines?.[index]?.kind?.message}
          />
        )}
      />

      {kind === 'DEDUCTION' && (
        <div className="grid grid-cols-2 gap-3">
          <Controller
            name={`lines.${index}.deductionDirection`}
            control={control}
            rules={{ required: 'Required' }}
            render={({ field: f }) => (
              <SearchSelect
                label="Posts As"
                placeholder="Debit or credit…"
                options={DEDUCTION_DIRECTION_OPTIONS}
                value={f.value}
                onChange={f.onChange}
                error={errors.lines?.[index]?.deductionDirection?.message}
              />
            )}
          />
          <Controller
            name={`lines.${index}.taxTypeId`}
            control={control}
            rules={{ required: 'Select a tax type' }}
            render={({ field: f }) => (
              <SearchSelect
                label="Tax Type"
                placeholder="Select a tax type…"
                options={taxTypeOptions}
                value={f.value}
                onChange={f.onChange}
                error={errors.lines?.[index]?.taxTypeId?.message}
              />
            )}
          />
        </div>
      )}

      <Controller
        name={`lines.${index}.accountId`}
        control={control}
        rules={{ required: 'Required' }}
        render={({ field: f }) => (
          <SearchSelect
            label="Account"
            placeholder={isLoadingAccounts ? 'Loading…' : 'Select account…'}
            options={accountOptions}
            value={f.value}
            onChange={f.onChange}
            error={errors.lines?.[index]?.accountId?.message}
          />
        )}
      />

      {subledgerTypeOptions.length > 0 && (
        <Controller
          name={`lines.${index}.subledgerType`}
          control={control}
          render={({ field: f }) => (
            <SearchSelect
              label="Subledger Type (optional)"
              placeholder="None — this account alone"
              options={subledgerTypeOptions}
              value={f.value}
              onChange={f.onChange}
            />
          )}
        />
      )}

      <FormField
        label="Description"
        registration={register(`lines.${index}.description`)}
        placeholder="Optional description"
      />
    </div>
  );
}
