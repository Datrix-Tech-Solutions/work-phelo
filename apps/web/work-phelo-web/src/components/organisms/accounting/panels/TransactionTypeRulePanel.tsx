'use client';

import { useEffect, useMemo } from 'react';
import {
  Control,
  Controller,
  FieldErrors,
  useFieldArray,
  useForm,
  useWatch,
} from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { CATEGORIES } from '@/components/organisms/accounting/ChartOfAccountsTree';
import {
  useAccountClassifications,
  useCashAccountOptions,
  useCreateTransactionTypeRule,
  useGLAccountOptions,
  useGLAccounts,
  useTaxTypes,
  useTransactionTypes,
  useUpdateTransactionTypeRule,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type {
  GLAccount,
  GLAccountCategory,
  PostingLineDirection,
  TransactionTypeCategory,
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
  /** Main line only (see isMainLine): where the user may pick the account from. The deepest
   *  one chosen is what's saved — an account, else a classification, else the category. */
  scopeCategory: GLAccountCategory | '';
  scopeClassificationId: string;
  /** Only used when kind is DEDUCTION. */
  taxTypeId: string;
  description: string;
};

type FormValues = {
  transactionTypeId: string;
  description: string;
  defaultCashAccountId: string;
  lines: LineFormValues[];
};

const EMPTY_LINE: LineFormValues = {
  kind: 'DEBIT',
  deductionDirection: '',
  accountId: '',
  scopeCategory: '',
  scopeClassificationId: '',
  taxTypeId: '',
  description: '',
};

const DEFAULTS: FormValues = {
  transactionTypeId: '',
  description: '',
  defaultCashAccountId: '',
  lines: [
    { ...EMPTY_LINE, kind: 'DEBIT' },
    { ...EMPTY_LINE, kind: 'CREDIT' },
  ],
};

/** A type flagged postsToCashbook (RCPT/PMNT by default, or any Receivable/Payable
 *  type opted into it) posts straight to Cashbook rather than through Invoice/Bill
 *  creation — its rule is a single offset-account line (credited for Receivable types,
 *  debited for Payable) plus an optional default cash/bank account, not the usual
 *  two-sided rule. */
function cashbookDirectionFor(
  type: { postsToCashbook: boolean; category: TransactionTypeCategory } | undefined,
): PostingLineDirection | null {
  if (!type?.postsToCashbook) return null;
  return type.category === 'RECEIVABLE' ? 'CR' : 'DR';
}

function directionOf(line: LineFormValues): PostingLineDirection | '' {
  if (line.kind === 'DEBIT') return 'DR';
  if (line.kind === 'CREDIT') return 'CR';
  if (line.kind === 'DEDUCTION') return line.deductionDirection;
  return '';
}

/** What a main line saves: the deepest level picked. */
function scopeInput(
  line: LineFormValues,
): Pick<TransactionTypeRuleLineInput, 'accountId' | 'scopeCategory' | 'scopeClassificationId'> {
  if (line.accountId) return { accountId: line.accountId };
  if (line.scopeClassificationId) return { scopeClassificationId: line.scopeClassificationId };
  return { scopeCategory: (line.scopeCategory || undefined) as GLAccountCategory | undefined };
}

function lineToFormValues(line: TransactionTypeRule['lines'][number]): LineFormValues {
  if (line.taxType) {
    return {
      kind: 'DEDUCTION',
      deductionDirection: line.direction,
      accountId: line.account?.id ?? '',
      scopeCategory: '',
      scopeClassificationId: '',
      taxTypeId: line.taxType.id,
      description: line.description ?? '',
    };
  }
  return {
    kind: line.direction === 'DR' ? 'DEBIT' : 'CREDIT',
    deductionDirection: '',
    accountId: line.account?.id ?? '',
    // A fixed account still opens the main line's category / classification pickers filled in.
    scopeCategory:
      line.account?.category ?? line.scopeCategory ?? line.scopeClassification?.category ?? '',
    scopeClassificationId: line.account?.classificationId ?? line.scopeClassification?.id ?? '',
    taxTypeId: '',
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
  const { options: cashAccountOptions, isLoading: isLoadingCashAccounts } = useCashAccountOptions();

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  // Reactive so a freshly picked Transaction Type (when no defaultTransactionTypeId is
  // given) immediately switches the form between the Receivable/Payable line editor and
  // the single-line Cashbook editor, not just on the next open.
  const watchedTransactionTypeId = useWatch({ control, name: 'transactionTypeId' });
  const activeTransactionTypeId =
    rule?.transactionTypeId ?? watchedTransactionTypeId ?? defaultTransactionTypeId;
  const selectedType = useMemo(
    () => transactionTypes.find((t) => t.id === activeTransactionTypeId),
    [transactionTypes, activeTransactionTypeId],
  );
  const taxTypeOptions: SearchSelectOption[] = taxTypes.map((t) => ({
    value: t.id,
    label: `${t.name} (${t.rate}%)`,
  }));

  const cashbookDirection = cashbookDirectionFor(selectedType);
  const isCashbookType = cashbookDirection !== null;

  // A deduction always posts opposite the auto-balancing line for Receivable/Payable
  // types (Credit for Receivable — output tax is a liability; Debit for Payable —
  // input tax is a recoverable asset) — the only direction the backend can actually
  // resolve correctly, so it's fixed rather than asked. Neutral/None types have no
  // auto-balancing side to be opposite of, so those still ask.
  // A linked type (credit / debit note) is written in its own direction, so its control line
  // and therefore its deductions are on the opposite side to a plain invoice/bill.
  const isLinkedType = selectedType?.isLinked ?? false;
  const fixedDeductionDirection: PostingLineDirection | null =
    selectedType?.category === 'RECEIVABLE'
      ? isLinkedType
        ? 'DR'
        : 'CR'
      : selectedType?.category === 'PAYABLE'
        ? isLinkedType
          ? 'CR'
          : 'DR'
        : null;

  // The main line of a Receivable/Payable rule — not the control line, not a deduction — is
  // where a scope applies. Its side is the opposite of the control line's (see the
  // deduction direction above). Cashbook and source-linked types keep a fixed account.
  const mainLineDirection: PostingLineDirection | null =
    fixedDeductionDirection === 'CR' ? 'DR' : fixedDeductionDirection === 'DR' ? 'CR' : null;
  const allowsScope = !isCashbookType && !selectedType?.sourceTypeId && mainLineDirection !== null;
  const watchedLines = useWatch({ control, name: 'lines' });
  const mainLineIndex = allowsScope
    ? (watchedLines ?? []).findIndex(
        (l) => (l.kind === 'DEBIT' || l.kind === 'CREDIT') && directionOf(l) === mainLineDirection,
      )
    : -1;

  useEffect(() => {
    if (!isOpen) return;
    if (rule)
      reset({
        transactionTypeId: rule.transactionTypeId,
        description: rule.description ?? '',
        defaultCashAccountId: rule.defaultCashAccountId ?? '',
        lines: rule.lines.map(lineToFormValues),
      });
    else reset({ ...DEFAULTS, transactionTypeId: defaultTransactionTypeId ?? '' });
  }, [isOpen, rule, defaultTransactionTypeId, reset]);

  // Once a Cashbook type (RCPT/PMNT) is selected, collapse to its single required line
  // rather than the two-line Debit+Credit starting point.
  useEffect(() => {
    if (!isCashbookType || rule) return;
    setValue('lines', [{ ...EMPTY_LINE, kind: cashbookDirection === 'CR' ? 'CREDIT' : 'DEBIT' }]);
  }, [isCashbookType, cashbookDirection, rule, setValue]);

  const transactionTypeLabel = useMemo(() => {
    if (!selectedType) return '';
    return `${selectedType.name} (${selectedType.code})`;
  }, [selectedType]);

  const close = () => {
    reset(DEFAULTS);
    onClose();
  };

  const submit = async (values: FormValues) => {
    if (isCashbookType) {
      const [line] = values.lines;
      if (!line?.accountId) {
        toast.error('Select the offset account.');
        return;
      }
      const lines: TransactionTypeRuleLineInput[] = [
        {
          direction: cashbookDirection!,
          accountId: line.accountId,
          description: line.description || undefined,
        },
      ];
      try {
        if (rule) {
          await update({
            id: rule.id,
            description: values.description || undefined,
            defaultCashAccountId: values.defaultCashAccountId || undefined,
            lines,
          });
        } else {
          await create({
            transactionTypeId: values.transactionTypeId,
            description: values.description || undefined,
            defaultCashAccountId: values.defaultCashAccountId || undefined,
            lines,
          });
        }
        toast.success(isEditing ? 'Rule updated successfully' : 'Rule created successfully');
        close();
      } catch (error) {
        toast.error(extractError(error, `Unable to ${isEditing ? 'update' : 'create'} rule`));
      }
      return;
    }

    for (const line of values.lines) {
      if (line.kind === 'DEDUCTION' && !line.deductionDirection) {
        toast.error('Every deduction line needs a Debit/Credit side.');
        return;
      }
    }

    const lines: TransactionTypeRuleLineInput[] = values.lines.map((line, index) => ({
      direction: directionOf(line) as PostingLineDirection,
      ...(index === mainLineIndex ? scopeInput(line) : { accountId: line.accountId }),
      taxTypeId: line.kind === 'DEDUCTION' ? line.taxTypeId || undefined : undefined,
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
      description={
        isCashbookType
          ? `Map how this type posts — the single offset account it ${cashbookDirection === 'CR' ? 'credits' : 'debits'} against a cash/bank account.`
          : 'Map how this transaction type posts — a debit line, a credit line, and any deductions (tax) it needs.'
      }
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
                  .filter(
                    (t) =>
                      t.rulesCount === 0 &&
                      (t.category === 'RECEIVABLE' || t.category === 'PAYABLE'),
                  )
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

        {isCashbookType ? (
          <>
            <Controller
              name="defaultCashAccountId"
              control={control}
              render={({ field }) => (
                <SearchSelect
                  label="Default Cash/Bank Account (optional)"
                  placeholder={isLoadingCashAccounts ? 'Loading…' : 'None — chosen per transaction'}
                  options={cashAccountOptions}
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />

            <Controller
              name="lines.0.accountId"
              control={control}
              rules={{
                required: `${cashbookDirection === 'CR' ? 'Credit' : 'Debit'} account is required`,
              }}
              render={({ field }) => (
                <SearchSelect
                  label={cashbookDirection === 'CR' ? 'Account to Credit' : 'Account to Debit'}
                  placeholder={isLoadingAccounts ? 'Loading…' : 'Select account…'}
                  options={accountOptions}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.lines?.[0]?.accountId?.message}
                />
              )}
            />

            <FormField
              label="Line Description"
              registration={register('lines.0.description')}
              placeholder="Optional description"
            />
          </>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-900">Lines</span>
              <Button type="button" variant="outline" onClick={() => append({ ...EMPTY_LINE })}>
                Add Line
              </Button>
            </div>
            {isLinkedType && (
              <p className="text-xs text-gray-500">
                This is a linked type, so write the rule from the{' '}
                {selectedType?.category === 'RECEIVABLE' ? 'credit note' : 'debit note'}&apos;s
                point of view:{' '}
                {selectedType?.category === 'RECEIVABLE'
                  ? 'credit the Receivable account and debit the revenue account'
                  : 'debit the Payable account and credit the expense account'}
                .
              </p>
            )}

            {fields.map((field, index) => (
              <RuleLineEditor
                key={field.id}
                control={control}
                register={register}
                setValue={setValue}
                errors={errors}
                index={index}
                canRemove={fields.length > 2}
                onRemove={() => remove(index)}
                accountOptions={accountOptions}
                isLoadingAccounts={isLoadingAccounts}
                taxTypeOptions={taxTypeOptions}
                fixedDeductionDirection={fixedDeductionDirection}
                isMainLine={index === mainLineIndex}
              />
            ))}
          </div>
        )}
      </div>
    </SidePanel>
  );
}

function RuleLineEditor({
  control,
  register,
  setValue,
  errors,
  index,
  canRemove,
  onRemove,
  accountOptions,
  isLoadingAccounts,
  taxTypeOptions,
  fixedDeductionDirection,
  isMainLine,
}: {
  control: Control<FormValues>;
  register: ReturnType<typeof useForm<FormValues>>['register'];
  setValue: ReturnType<typeof useForm<FormValues>>['setValue'];
  errors: FieldErrors<FormValues>;
  index: number;
  canRemove: boolean;
  onRemove: () => void;
  accountOptions: SearchSelectOption[];
  isLoadingAccounts: boolean;
  taxTypeOptions: SearchSelectOption[];
  fixedDeductionDirection: PostingLineDirection | null;
  isMainLine: boolean;
}) {
  const kind = useWatch({ control, name: `lines.${index}.kind` });
  const scopeCategory = useWatch({ control, name: `lines.${index}.scopeCategory` });
  const scopeClassificationId = useWatch({ control, name: `lines.${index}.scopeClassificationId` });
  const { data: allAccounts = [] } = useGLAccounts();
  // Every level works on its own, like the journal entry lines: a level that's set narrows the
  // ones below it, and picking a lower level fills in the ones above.
  const { data: classificationsData } = useAccountClassifications({ isActive: true });
  const classifications = classificationsData?.items ?? [];
  const classificationOptions: SearchSelectOption[] = classifications
    .filter((c) => !scopeCategory || c.category === scopeCategory)
    .map((c) => ({ value: c.id, label: c.name }));
  const scopedAccountOptions: SearchSelectOption[] = allAccounts
    .filter(
      (a: GLAccount) =>
        a.status === 'ACTIVE' &&
        a.allowPosting &&
        (!scopeCategory || a.category === scopeCategory) &&
        (!scopeClassificationId || a.classificationId === scopeClassificationId),
    )
    .map((a) => ({ value: a.id, label: `${a.code} – ${a.name}` }));
  const accountId = useWatch({ control, name: `lines.${index}.accountId` });

  const pickCategory = (category: GLAccountCategory) => {
    setValue(`lines.${index}.scopeCategory`, category);
    // Keep a lower level only while it still sits under the new category.
    const classification = classifications.find((c) => c.id === scopeClassificationId);
    if (classification && classification.category !== category) {
      setValue(`lines.${index}.scopeClassificationId`, '');
    }
    const account = allAccounts.find((a) => a.id === accountId);
    if (account && account.category !== category) setValue(`lines.${index}.accountId`, '');
  };
  const pickClassification = (id: string) => {
    setValue(`lines.${index}.scopeClassificationId`, id);
    const classification = classifications.find((c) => c.id === id);
    if (classification) setValue(`lines.${index}.scopeCategory`, classification.category);
    const account = allAccounts.find((a) => a.id === accountId);
    if (id && account && account.classificationId !== id) setValue(`lines.${index}.accountId`, '');
  };
  const pickAccount = (id: string) => {
    setValue(`lines.${index}.accountId`, id);
    const account = allAccounts.find((a) => a.id === id);
    if (account) {
      setValue(`lines.${index}.scopeCategory`, account.category);
      setValue(`lines.${index}.scopeClassificationId`, account.classificationId ?? '');
    }
  };

  useEffect(() => {
    if (kind === 'DEDUCTION' && fixedDeductionDirection) {
      setValue(`lines.${index}.deductionDirection`, fixedDeductionDirection);
    }
  }, [kind, fixedDeductionDirection, index, setValue]);

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
          {fixedDeductionDirection ? (
            <Input
              label="Posts As"
              readOnly
              value={fixedDeductionDirection === 'DR' ? 'Debit (DR)' : 'Credit (CR)'}
            />
          ) : (
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
          )}
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

      {isMainLine ? (
        <>
          <p className="text-xs text-gray-500">
            Choose how far to narrow where this line posts. Stop at a category or classification and
            the user picks the account when making the transaction; pick an account and it is fixed.
          </p>
          <Controller
            name={`lines.${index}.scopeCategory`}
            control={control}
            rules={{ required: 'Choose a category, classification or account' }}
            render={({ field: f }) => (
              <SearchSelect
                label="Category"
                placeholder="Select a category…"
                options={CATEGORIES.map((c) => ({ value: c.value, label: c.label }))}
                value={f.value}
                onChange={(value) => pickCategory(value as GLAccountCategory)}
                error={errors.lines?.[index]?.scopeCategory?.message}
              />
            )}
          />
          <Controller
            name={`lines.${index}.scopeClassificationId`}
            control={control}
            render={({ field: f }) => (
              <SearchSelect
                label="Classification (optional)"
                placeholder="Any classification"
                options={classificationOptions}
                value={f.value}
                onChange={pickClassification}
              />
            )}
          />
          <Controller
            name={`lines.${index}.accountId`}
            control={control}
            render={({ field: f }) => (
              <SearchSelect
                label="Account (optional)"
                placeholder="Any account — chosen on the transaction"
                options={scopedAccountOptions}
                value={f.value}
                onChange={pickAccount}
              />
            )}
          />
        </>
      ) : (
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
      )}

      <FormField
        label="Description"
        registration={register(`lines.${index}.description`)}
        placeholder="Optional description"
      />
    </div>
  );
}
