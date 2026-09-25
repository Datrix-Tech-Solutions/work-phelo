'use client';

import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { NumberField } from '@/components/atoms/NumberField';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { SuccessModal } from '@/components/organisms/shared/SuccessModal';
import { AccountingCashbookSettlementMethod, TransactionTypeDefinition } from '@/types/accounting';
import {
  useAccountingCurrencyOptions,
  useCashAccountOptions,
  useCostCentres,
  useCreateCashbookPayment,
  useCreateCashbookReceipt,
  useCreatePayableBill,
  useCreateReceivableInvoice,
  useEntityTypes,
  useGLAccountOptions,
  useGLAccounts,
  useSubledgers,
  useTransactionTypeRules,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { SETTLEMENT_METHOD_OPTIONS } from '@/lib/accounting/settlementMethod';

function fmtAmount(value: number, currency: string) {
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${formatted}` : formatted;
}

type FormValues = {
  businessRole: string;
  businessEntity: string;
  description: string;
  amount: string;
  currency: string;
  costCentreId: string;
  entryDate: string;
  dueDate: string;
  cashAccountId: string;
  offsetGlAccountId: string;
  settlementMethod: AccountingCashbookSettlementMethod | '';
  reference: string;
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULTS: FormValues = {
  businessRole: '',
  businessEntity: '',
  description: '',
  amount: '',
  currency: '',
  costCentreId: '',
  entryDate: '',
  dueDate: '',
  cashAccountId: '',
  offsetGlAccountId: '',
  settlementMethod: '',
  reference: '',
};

export function NewTransactionPanel({
  transactionType,
  onClose,
}: {
  transactionType: TransactionTypeDefinition | null | undefined;
  onClose: () => void;
}) {
  const isOpen = transactionType !== null && transactionType !== undefined;
  const isReceivable = transactionType?.category === 'RECEIVABLE';
  const isPayable = transactionType?.category === 'PAYABLE';
  const isSupported = isReceivable || isPayable;
  const hasRule = (transactionType?.rulesCount ?? 0) > 0;
  // A type flagged postsToCashbook (RCPT/PMNT by default, or any Receivable/Payable type
  // opted into it) posts straight to Cashbook — no bill/invoice, no rule required (the
  // offset account can always be picked by hand in the form if no rule set one as default).
  const isCashbookType = transactionType?.postsToCashbook ?? false;
  const isCashbookReceipt = isCashbookType && isReceivable;
  const canUse = isCashbookType ? isSupported : isSupported && hasRule;
  const toast = useToast();

  const createInvoice = useCreateReceivableInvoice();
  const createBill = useCreatePayableBill();
  const createDocument = isPayable ? createBill : createInvoice;
  const createCashbookReceipt = useCreateCashbookReceipt();
  const createCashbookPayment = useCreateCashbookPayment();
  const createCashbookEntry = isCashbookReceipt ? createCashbookReceipt : createCashbookPayment;
  const isSaving = isCashbookType ? createCashbookEntry.isPending : createDocument.isPending;

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues: DEFAULTS });

  const { options: currencyOptions } = useAccountingCurrencyOptions();
  const { data: entityTypesData = [] } = useEntityTypes();
  const { data: rules = [] } = useTransactionTypeRules();
  const rule = useMemo(
    () => rules.find((r) => r.transactionTypeId === transactionType?.id),
    [rules, transactionType],
  );
  // The rule's Deduction lines — each backed by a TaxType and shown as its own
  // checkbox, since a single invoice can apply more than one at once.
  const taxLines = useMemo(
    () =>
      (rule?.lines ?? [])
        .filter((line) => line.taxType)
        .map((line) => ({
          taxTypeId: line.taxType!.id,
          name: line.taxType!.name,
          rate: line.taxType!.rate,
        })),
    [rule],
  );
  const { data: costCentres = [] } = useCostCentres();
  const { data: glAccounts = [] } = useGLAccounts();
  const { options: glAccountOptions, isLoading: isLoadingGlAccounts } = useGLAccountOptions();
  const { options: cashAccountOptions, isLoading: isLoadingCashAccounts } = useCashAccountOptions();
  const costCentreOptions = useMemo<SearchSelectOption[]>(
    () =>
      costCentres
        .filter((c) => c.status === 'ACTIVE')
        .map((c) => ({ value: c.id, label: `${c.code} – ${c.name}` }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [costCentres],
  );
  // The department tag lands on the rule's main (non-tax, non-control) line — hide the field
  // when that account is a balance-sheet one (e.g. an asset purchase), since there is no
  // P&L cost to attribute. While accounts are still loading, err on the side of showing it.
  const showCostCentre = useMemo(() => {
    const controlDirection = isReceivable ? 'DR' : 'CR';
    const mainLine = (rule?.lines ?? []).find(
      (l) => !l.taxType && l.direction !== controlDirection,
    );
    const category = glAccounts.find((a) => a.id === mainLine?.account.id)?.category;
    return !category || category === 'EXPENSE' || category === 'REVENUE';
  }, [rule, glAccounts, isReceivable]);
  const [selectedTaxTypeIds, setSelectedTaxTypeIds] = useState<string[]>([]);
  const [successTransactionType, setSuccessTransactionType] = useState<string | null>(null);

  // Only the roles actually configured on this transaction type — not the tenant's full
  // Entity Types list — and any of them works now, not just the old fixed enum names.
  const businessRoleOptions = useMemo<SearchSelectOption[]>(() => {
    const configured = transactionType?.businessRoles ?? [];
    return configured.map((role) => ({
      value: role,
      label: entityTypesData.find((t) => t.name.trim().toUpperCase() === role)?.name ?? role,
    }));
  }, [transactionType, entityTypesData]);

  const businessRole = useWatch({ control, name: 'businessRole' });
  const amount = useWatch({ control, name: 'amount' });
  const currency = useWatch({ control, name: 'currency' });

  const subtotal = Number(amount) || 0;
  const taxBreakdown = taxLines
    .filter((line) => selectedTaxTypeIds.includes(line.taxTypeId))
    .map((line) => ({ ...line, amount: (subtotal * line.rate) / 100 }));
  const taxAmount = taxBreakdown.reduce((sum, line) => sum + line.amount, 0);
  const total = subtotal + taxAmount;

  // Reset the form whenever a fresh "open" happens (rather than in an effect, to avoid
  // an extra commit — see https://react.dev/learn/you-might-not-need-an-effect).
  const openKey = isOpen ? (transactionType?.id ?? 'unknown') : null;
  const [lastOpenKey, setLastOpenKey] = useState<string | null>(null);
  if (openKey !== null && openKey !== lastOpenKey) {
    setLastOpenKey(openKey);
    const configuredRoles = transactionType?.businessRoles ?? [];
    reset({
      ...DEFAULTS,
      businessRole: configuredRoles.length === 1 ? configuredRoles[0] : '',
      entryDate: today(),
      cashAccountId: rule?.defaultCashAccountId ?? '',
      offsetGlAccountId: rule?.lines?.[0]?.account.id ?? '',
    });
    setSelectedTaxTypeIds([]);
  }

  const { data: entities = [], isLoading: isLoadingEntities } = useSubledgers(
    businessRole ? { type: businessRole, status: 'ACTIVE' } : { status: 'ACTIVE' },
  );
  const entityOptions = useMemo<SearchSelectOption[]>(
    () => entities.map((e) => ({ value: e.id, label: `${e.code} — ${e.name}` })),
    [entities],
  );

  const close = () => {
    reset(DEFAULTS);
    setSelectedTaxTypeIds([]);
    onClose();
  };

  const toggleTaxType = (taxTypeId: string) => {
    setSelectedTaxTypeIds((prev) =>
      prev.includes(taxTypeId) ? prev.filter((id) => id !== taxTypeId) : [...prev, taxTypeId],
    );
  };

  const submit = async (values: FormValues) => {
    if (!transactionType) return;

    if (isCashbookType) {
      if (!values.cashAccountId) {
        toast.error('Select a cash/bank account');
        return;
      }
      if (!values.offsetGlAccountId) {
        toast.error(`Select the account to ${isCashbookReceipt ? 'credit' : 'debit'}`);
        return;
      }
      if (!values.settlementMethod) {
        toast.error('Select a settlement method');
        return;
      }
      try {
        await createCashbookEntry.mutateAsync({
          cashAccountId: values.cashAccountId,
          offsetGlAccountId: values.offsetGlAccountId,
          amount: Number(values.amount),
          currency: values.currency,
          transactionDate: values.entryDate || today(),
          settlementMethod: values.settlementMethod as AccountingCashbookSettlementMethod,
          reference: values.reference || undefined,
          description: values.description || transactionType.name,
        });
        close();
        setSuccessTransactionType(transactionType.name);
      } catch (error) {
        toast.error(extractError(error, 'Failed to save transaction'));
      }
      return;
    }

    const entity = entities.find((e) => e.id === values.businessEntity);
    if (!entity) {
      toast.error('Select a business entity');
      return;
    }

    const payload = {
      partyId: values.businessEntity,
      documentDate: values.entryDate || today(),
      dueDate: values.dueDate || undefined,
      currency: values.currency,
      amount: Number(values.amount),
      transactionTypeId: transactionType.id,
      selectedTaxTypeIds: selectedTaxTypeIds.length ? selectedTaxTypeIds : undefined,
      costCentreId: showCostCentre && values.costCentreId ? values.costCentreId : undefined,
      description: values.description || undefined,
      // No externalReference here — the system generates the transaction/document
      // number itself (e.g. INV-2026-0001) once the document is created.
    };

    try {
      await createDocument.mutateAsync(payload);
      close();
      setSuccessTransactionType(transactionType.name);
    } catch (error) {
      toast.error(extractError(error, 'Failed to save transaction'));
    }
  };

  return (
    <>
      <SidePanel
        isOpen={isOpen}
        onClose={close}
        title="New Transaction"
        description={
          transactionType ? `Recording a ${transactionType.name.toLowerCase()}.` : undefined
        }
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={close} disabled={isSaving}>
              Cancel
            </Button>
            {canUse && (
              <Button
                variant="secondary"
                isLoading={isSaving}
                loadingText="Submitting…"
                disabled={isSaving}
                onClick={handleSubmit(submit)}
              >
                Submit for Review
              </Button>
            )}
          </div>
        }
      >
        {!isSupported ? (
          <p className="text-sm text-gray-500">
            Forms for {transactionType?.category.toLowerCase() ?? 'this'} transaction types are
            coming soon.
          </p>
        ) : !isCashbookType && !hasRule ? (
          <p className="text-sm text-gray-500">
            {transactionType?.name} has no rule configured yet. Add one under Settings → Transaction
            Types before creating transactions of this type.
          </p>
        ) : isCashbookType ? (
          <div className="flex flex-col gap-4">
            <Input
              label="Transaction Type"
              readOnly
              value={transactionType ? `${transactionType.name} (${transactionType.code})` : ''}
            />

            {!hasRule && (
              <p className="text-xs text-gray-500">
                No rule configured for this type yet — pick the accounts below directly, or add a
                default rule under Settings → Transaction Types.
              </p>
            )}

            <Controller
              name="cashAccountId"
              control={control}
              rules={{ required: 'Cash/bank account is required' }}
              render={({ field }) => (
                <SearchSelect
                  label="Cash/Bank Account"
                  placeholder={isLoadingCashAccounts ? 'Loading…' : 'Select cash/bank account…'}
                  options={cashAccountOptions}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.cashAccountId?.message}
                />
              )}
            />

            <Controller
              name="offsetGlAccountId"
              control={control}
              rules={{ required: 'Account is required' }}
              render={({ field }) => (
                <SearchSelect
                  label={isCashbookReceipt ? 'Account to Credit' : 'Account to Debit'}
                  placeholder={isLoadingGlAccounts ? 'Loading…' : 'Select account…'}
                  options={glAccountOptions}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.offsetGlAccountId?.message}
                />
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <Controller
                name="amount"
                control={control}
                rules={{
                  required: 'Amount is required',
                  min: { value: 0.01, message: 'Amount must be greater than 0' },
                }}
                render={({ field }) => (
                  <NumberField
                    label="Amount"
                    value={Number(field.value) || 0}
                    onChange={(value) => field.onChange(String(value))}
                    error={errors.amount?.message}
                  />
                )}
              />
              <Controller
                name="currency"
                control={control}
                rules={{ required: 'Currency is required' }}
                render={({ field }) => (
                  <SearchSelect
                    label="Currency"
                    placeholder="Select currency…"
                    options={currencyOptions}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.currency?.message}
                  />
                )}
              />
            </div>

            <Controller
              name="entryDate"
              control={control}
              rules={{ required: 'Date is required' }}
              render={({ field }) => (
                <DatePicker
                  label={`${transactionType?.name ?? 'Transaction'} Date`}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.entryDate?.message}
                />
              )}
            />

            <Controller
              name="settlementMethod"
              control={control}
              rules={{ required: 'Settlement method is required' }}
              render={({ field }) => (
                <SearchSelect
                  label="Settlement Method"
                  placeholder="Select settlement method…"
                  options={SETTLEMENT_METHOD_OPTIONS}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.settlementMethod?.message}
                />
              )}
            />

            <FormField
              label="Reference"
              registration={register('reference')}
              placeholder="Optional bank/cheque reference"
            />

            <FormField
              label="Description"
              type="textarea"
              rows={3}
              registration={register('description')}
              placeholder={`What is this ${transactionType?.name.toLowerCase() ?? 'transaction'} for?`}
            />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <Input
              label="Transaction Type"
              readOnly
              value={transactionType ? `${transactionType.name} (${transactionType.code})` : ''}
            />

            <Controller
              name="businessRole"
              control={control}
              rules={{ required: 'Business role is required' }}
              render={({ field }) => (
                <SearchSelect
                  label="Business Role"
                  placeholder="Select a business role…"
                  options={businessRoleOptions}
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    setValue('businessEntity', '');
                  }}
                  error={errors.businessRole?.message}
                />
              )}
            />

            <Controller
              name="businessEntity"
              control={control}
              rules={{ required: 'Business entity is required' }}
              render={({ field }) => (
                <SearchSelect
                  label="Business Entity"
                  placeholder={
                    !businessRole
                      ? 'Select a business role first…'
                      : isLoadingEntities
                        ? 'Loading…'
                        : 'Select an entity…'
                  }
                  options={entityOptions}
                  value={field.value}
                  onChange={(value) => {
                    field.onChange(value);
                    const entity = entities.find((e) => e.id === value);
                    if (entity?.currency) setValue('currency', entity.currency);
                  }}
                  error={errors.businessEntity?.message}
                />
              )}
            />

            {showCostCentre && (
              <Controller
                name="costCentreId"
                control={control}
                render={({ field }) => (
                  <SearchSelect
                    label="Cost Centre"
                    placeholder="Optional — select a cost centre"
                    options={costCentreOptions}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            )}

            <FormField
              label="Description"
              type="textarea"
              rows={3}
              registration={register('description')}
              error={errors.description}
              placeholder="Optional description"
            />

            <div className="grid grid-cols-2 gap-4">
              <Controller
                name="amount"
                control={control}
                rules={{
                  required: 'Amount is required',
                  min: { value: 0.01, message: 'Amount must be greater than 0' },
                }}
                render={({ field }) => (
                  <NumberField
                    label="Amount"
                    value={Number(field.value) || 0}
                    onChange={(value) => field.onChange(String(value))}
                    error={errors.amount?.message}
                  />
                )}
              />
              <Controller
                name="currency"
                control={control}
                rules={{ required: 'Currency is required' }}
                render={({ field }) => (
                  <SearchSelect
                    label="Currency"
                    placeholder="Select currency…"
                    options={currencyOptions}
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.currency?.message}
                  />
                )}
              />
            </div>

            {taxLines.length > 0 && (
              <div className="flex flex-col gap-2 rounded-xl border border-gray-200 p-3">
                <span className="text-sm font-bold text-gray-900">Tax / Deductions</span>
                {taxLines.map((line) => (
                  <label key={line.taxTypeId} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedTaxTypeIds.includes(line.taxTypeId)}
                      onChange={() => toggleTaxType(line.taxTypeId)}
                      className="h-4 w-4 rounded border-gray-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm text-gray-700">
                      {line.name} ({line.rate}%)
                    </span>
                  </label>
                ))}

                {taxBreakdown.length > 0 && (
                  <div className="mt-1 flex flex-col gap-1.5 border-t border-gray-100 pt-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="text-gray-900">{fmtAmount(subtotal, currency)}</span>
                    </div>
                    {taxBreakdown.map((line) => (
                      <div key={line.taxTypeId} className="flex justify-between text-sm">
                        <span className="text-gray-600">
                          {line.name} ({line.rate}%)
                        </span>
                        <span className="text-gray-900">{fmtAmount(line.amount, currency)}</span>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-gray-100 pt-1.5 text-sm font-semibold">
                      <span className="text-gray-900">Total</span>
                      <span className="text-gray-900">{fmtAmount(total, currency)}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Controller
                name="entryDate"
                control={control}
                rules={{ required: 'Entry date is required' }}
                render={({ field }) => (
                  <DatePicker
                    label="Entry Date"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.entryDate?.message}
                  />
                )}
              />
              <Controller
                name="dueDate"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    label="Due Date"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.dueDate?.message}
                  />
                )}
              />
            </div>
          </div>
        )}
      </SidePanel>
      <SuccessModal
        isOpen={!!successTransactionType}
        onClose={() => setSuccessTransactionType(null)}
        title="Transaction Submitted!"
        message={`Your ${successTransactionType ?? ''} has been submitted for review.`}
      />
    </>
  );
}
