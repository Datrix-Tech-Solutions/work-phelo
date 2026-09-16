'use client';

import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { CurrencyInput } from '@/components/atoms/CurrencyInput';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { AccountingTradeDocument, TransactionTypeDefinition } from '@/types/accounting';
import {
  useAccountingCurrencyOptions,
  useCreatePayableBill,
  useCreateReceivableInvoice,
  useEntityTypes,
  usePostPayableBill,
  usePostReceivableInvoice,
  useSubledgers,
  useTransactionTypeRules,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

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
  entryDate: string;
  dueDate: string;
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
  entryDate: '',
  dueDate: '',
};

export function NewTransactionPanel({
  transactionType,
  onClose,
  onPostedForPayment,
}: {
  transactionType: TransactionTypeDefinition | null | undefined;
  onClose: () => void;
  /** Fired after a successful "Post and Make Payment" so the caller can open the
   *  payment popup for the freshly-posted document. */
  onPostedForPayment?: (document: AccountingTradeDocument) => void;
}) {
  const isOpen = transactionType !== null && transactionType !== undefined;
  const isReceivable = transactionType?.category === 'RECEIVABLE';
  const isPayable = transactionType?.category === 'PAYABLE';
  const isSupported = isReceivable || isPayable;
  const hasRule = (transactionType?.rulesCount ?? 0) > 0;
  const canUse = isSupported && hasRule;
  const toast = useToast();
  const [pendingAction, setPendingAction] = useState<'draft' | 'post' | 'postAndPay' | null>(null);

  const createInvoice = useCreateReceivableInvoice();
  const createBill = useCreatePayableBill();
  const postInvoice = usePostReceivableInvoice();
  const postBill = usePostPayableBill();
  const createDocument = isPayable ? createBill : createInvoice;
  const postDocument = isPayable ? postBill : postInvoice;
  const isSaving = createDocument.isPending || postDocument.isPending;

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
  const [selectedTaxTypeIds, setSelectedTaxTypeIds] = useState<string[]>([]);

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

  useEffect(() => {
    if (!isOpen) return;

    const configuredRoles = transactionType?.businessRoles ?? [];
    reset({
      ...DEFAULTS,
      businessRole: configuredRoles.length === 1 ? configuredRoles[0] : '',
      entryDate: today(),
    });
    setSelectedTaxTypeIds([]);
  }, [isOpen, transactionType, reset]);

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

  const submit = (action: 'draft' | 'post' | 'postAndPay') => async (values: FormValues) => {
    const entity = entities.find((e) => e.id === values.businessEntity);
    if (!entity) {
      toast.error('Select a business entity');
      return;
    }
    if (!transactionType) return;

    const payload = {
      partyId: values.businessEntity,
      documentDate: values.entryDate || today(),
      dueDate: values.dueDate || undefined,
      currency: values.currency,
      amount: Number(values.amount),
      transactionTypeId: transactionType.id,
      selectedTaxTypeIds: selectedTaxTypeIds.length ? selectedTaxTypeIds : undefined,
      description: values.description || undefined,
      // No externalReference here — the system generates the transaction/document
      // number itself (e.g. INV-2026-0001) once the document is created.
    };

    setPendingAction(action);
    try {
      const document = await createDocument.mutateAsync(payload);
      if (action === 'draft') {
        toast.success('Transaction saved as draft.');
        close();
        return;
      }

      try {
        const posted = await postDocument.mutateAsync(document.id);
        if (action === 'postAndPay') {
          toast.success('Transaction posted.');
          close();
          onPostedForPayment?.(posted);
          return;
        }
        toast.success('Transaction posted.');
      } catch (error) {
        toast.error(extractError(error, 'Saved as draft, but posting failed'));
        close();
        return;
      }
      close();
    } catch (error) {
      toast.error(extractError(error, 'Failed to save transaction'));
    } finally {
      setPendingAction(null);
    }
  };

  return (
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
            <>
              <Button
                variant="secondary"
                isLoading={isSaving && pendingAction === 'draft'}
                loadingText="Saving…"
                disabled={isSaving}
                onClick={handleSubmit(submit('draft'))}
              >
                Save Draft
              </Button>
              <Button
                variant="secondary"
                isLoading={isSaving && pendingAction === 'post'}
                loadingText="Posting…"
                disabled={isSaving}
                onClick={handleSubmit(submit('post'))}
              >
                Post
              </Button>
              <Button
                isLoading={isSaving && pendingAction === 'postAndPay'}
                loadingText="Posting…"
                disabled={isSaving}
                onClick={handleSubmit(submit('postAndPay'))}
              >
                Post and Make Payment
              </Button>
            </>
          )}
        </div>
      }
    >
      {!isSupported ? (
        <p className="text-sm text-gray-500">
          Forms for {transactionType?.category.toLowerCase() ?? 'this'} transaction types are coming
          soon.
        </p>
      ) : !hasRule ? (
        <p className="text-sm text-gray-500">
          {transactionType?.name} has no rule configured yet. Add one under Settings → Transaction
          Types before creating transactions of this type.
        </p>
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
                onChange={field.onChange}
                error={errors.businessEntity?.message}
              />
            )}
          />

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
                <CurrencyInput
                  label="Amount"
                  value={field.value}
                  currency={currency}
                  onValueChange={field.onChange}
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
  );
}
