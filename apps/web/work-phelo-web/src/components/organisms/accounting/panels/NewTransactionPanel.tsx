'use client';

import { useEffect, useMemo } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { FormField } from '@/components/molecules/shared/FormField';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Toggle } from '@/components/atoms/Toggle';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import {
  SUBLEDGER_TYPE_LABELS,
  SubledgerType,
  TransactionTypeDefinition,
} from '@/types/accounting';
import {
  useAccountingCurrencyOptions,
  useCreatePayableBill,
  useCreateReceivableInvoice,
  usePostPayableBill,
  usePostReceivableInvoice,
  useSubledgers,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

const BUSINESS_ROLE_OPTIONS: SearchSelectOption[] = (
  Object.entries(SUBLEDGER_TYPE_LABELS) as [SubledgerType, string][]
).map(([value, label]) => ({ value, label }));

interface TaxTypeOption extends SearchSelectOption {
  /** Percentage rate applied to the subtotal — drives the breakdown below the field. */
  rate: number;
}

// TODO: populate from a tax types API once one exists.
const TAX_TYPE_OPTIONS: TaxTypeOption[] = [];

function fmtAmount(value: number, currency: string) {
  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency ? `${currency} ${formatted}` : formatted;
}

type FormValues = {
  businessRole: SubledgerType | '';
  businessEntity: string;
  description: string;
  amount: string;
  currency: string;
  applyTax: boolean;
  taxType: string;
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
  applyTax: false,
  taxType: '',
  entryDate: '',
  dueDate: '',
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
  const toast = useToast();

  const { options: currencyOptions } = useAccountingCurrencyOptions();
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

  const businessRole = useWatch({ control, name: 'businessRole' });
  const applyTax = useWatch({ control, name: 'applyTax' });
  const taxType = useWatch({ control, name: 'taxType' });
  const amount = useWatch({ control, name: 'amount' });
  const currency = useWatch({ control, name: 'currency' });

  const selectedTaxType = TAX_TYPE_OPTIONS.find((t) => t.value === taxType);
  const subtotal = Number(amount) || 0;
  const taxRate = selectedTaxType?.rate ?? 0;
  const taxAmount = (subtotal * taxRate) / 100;
  const total = subtotal + taxAmount;

  useEffect(() => {
    if (!isOpen) return;

    const restrictedRoles = (transactionType?.businessRoles ?? []).filter(
      (r): r is SubledgerType => r in SUBLEDGER_TYPE_LABELS,
    );
    reset({
      ...DEFAULTS,
      businessRole: restrictedRoles.length === 1 ? restrictedRoles[0] : '',
      entryDate: today(),
    });
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
    onClose();
  };

  const submit = (action: 'draft' | 'post') => async (values: FormValues) => {
    const entity = entities.find((e) => e.id === values.businessEntity);
    if (!entity) {
      toast.error('Select a business entity');
      return;
    }
    const taxTypeOption = TAX_TYPE_OPTIONS.find((t) => t.value === values.taxType);
    const payload = {
      partyId: values.businessEntity,
      documentDate: values.entryDate || today(),
      dueDate: values.dueDate || undefined,
      currency: values.currency,
      amount: Number(values.amount),
      taxAmount:
        values.applyTax && taxTypeOption
          ? (Number(values.amount) * taxTypeOption.rate) / 100
          : undefined,
      offsetGlAccountId: entity.controlAccountId,
      description: values.description || undefined,
      // No externalReference here — the system generates the transaction/document
      // number itself (e.g. INV-2026-0001) once the document is created.
    };

    try {
      const document = await createDocument.mutateAsync(payload);
      if (action === 'post') {
        try {
          await postDocument.mutateAsync(document.id);
          toast.success('Transaction posted.');
        } catch (error) {
          toast.error(extractError(error, 'Saved as draft, but posting failed'));
          close();
          return;
        }
      } else {
        toast.success('Transaction saved as draft.');
      }
      close();
    } catch (error) {
      toast.error(extractError(error, 'Failed to save transaction'));
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
          {isSupported && (
            <>
              <Button
                variant="secondary"
                isLoading={createDocument.isPending && !postDocument.isPending}
                loadingText="Saving…"
                disabled={isSaving}
                onClick={handleSubmit(submit('draft'))}
              >
                Save Draft
              </Button>
              <Button
                isLoading={isSaving}
                loadingText="Saving…"
                onClick={handleSubmit(submit('post'))}
              >
                Post
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
                options={BUSINESS_ROLE_OPTIONS}
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
            <FormField
              label="Amount"
              type="number"
              step="0.01"
              registration={register('amount', {
                required: 'Amount is required',
                min: { value: 0.01, message: 'Amount must be greater than 0' },
              })}
              error={errors.amount}
              placeholder="0.00"
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

          <div className="flex items-center justify-between">
            <span className="text-sm font-bold text-gray-900">Apply Tax</span>
            <Controller
              name="applyTax"
              control={control}
              render={({ field }) => <Toggle enabled={field.value} onChange={field.onChange} />}
            />
          </div>

          {applyTax && (
            <>
              <Controller
                name="taxType"
                control={control}
                render={({ field }) => (
                  <SearchSelect
                    label="Tax Type"
                    placeholder="No tax types configured yet"
                    options={TAX_TYPE_OPTIONS}
                    value={field.value}
                    onChange={field.onChange}
                  />
                )}
              />

              {taxType && (
                <div className="flex flex-col gap-1.5 rounded-xl border border-gray-200 p-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Subtotal</span>
                    <span className="text-gray-900">{fmtAmount(subtotal, currency)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax{taxRate ? ` (${taxRate}%)` : ''}</span>
                    <span className="text-gray-900">{fmtAmount(taxAmount, currency)}</span>
                  </div>
                  <div className="flex justify-between border-t border-gray-100 pt-1.5 text-sm font-semibold">
                    <span className="text-gray-900">Total</span>
                    <span className="text-gray-900">{fmtAmount(total, currency)}</span>
                  </div>
                </div>
              )}
            </>
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
