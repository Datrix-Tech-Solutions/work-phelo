'use client';

import { Input } from '@/components/atoms/Input';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import type { BillingOptions, ClientBillingInput } from '@/types/marketing';

export interface ClientBillingValues {
  entityTypeId: string;
  transactionTypeId: string;
  /** Kept as typed text so half-entered numbers survive re-renders. */
  amount: string;
  description: string;
  productId: string;
}

export const EMPTY_BILLING: ClientBillingValues = {
  entityTypeId: '',
  transactionTypeId: '',
  amount: '',
  description: '',
  productId: '',
};

export type ClientBillingErrors = Partial<
  Record<'entityTypeId' | 'transactionTypeId' | 'amount', string>
>;

/**
 * The entity type in effect: the client's own once it has an entity in Accounting, otherwise the
 * one picked, otherwise the only one on offer.
 */
export function resolveEntityTypeId(
  values: ClientBillingValues,
  options: BillingOptions,
  lockedEntityTypeId?: string | null,
): string {
  if (lockedEntityTypeId) return lockedEntityTypeId;
  if (values.entityTypeId) return values.entityTypeId;
  return options.entityTypes.length === 1 ? options.entityTypes[0].id : '';
}

export function validateBilling(
  values: ClientBillingValues,
  options: BillingOptions,
  lockedEntityTypeId?: string | null,
): ClientBillingErrors {
  const errors: ClientBillingErrors = {};
  if (!resolveEntityTypeId(values, options, lockedEntityTypeId)) {
    errors.entityTypeId = 'Entity type is required.';
  }
  if (!values.transactionTypeId) errors.transactionTypeId = 'Transaction type is required.';

  const amount = values.amount.trim();
  if (!amount || !(Number(amount) > 0)) {
    errors.amount = 'Enter an amount greater than zero.';
  } else if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
    errors.amount = 'Use at most two decimal places.';
  }
  return errors;
}

export function toBillingInput(
  values: ClientBillingValues,
  options: BillingOptions,
  lockedEntityTypeId?: string | null,
): ClientBillingInput {
  return {
    entityTypeId: resolveEntityTypeId(values, options, lockedEntityTypeId),
    transactionTypeId: values.transactionTypeId,
    amount: Number(values.amount),
    ...(values.description.trim() ? { description: values.description.trim() } : {}),
    ...(values.productId ? { productId: values.productId } : {}),
  };
}

interface Props {
  options: BillingOptions;
  values: ClientBillingValues;
  onChange: (values: ClientBillingValues) => void;
  errors?: ClientBillingErrors;
  /** Set once the client has an entity — the type can't change and only matching transaction types show. */
  lockedEntityTypeId?: string | null;
  /** The client's products the transaction can be tagged to. Optional, and never sent to Accounting. */
  productOptions?: { value: string; label: string }[];
}

export function ClientBillingFields({
  options,
  values,
  onChange,
  errors,
  lockedEntityTypeId,
  productOptions = [],
}: Props) {
  const entityTypeId = resolveEntityTypeId(values, options, lockedEntityTypeId);
  const entityTypeOptions = options.entityTypes.map((t) => ({ value: t.id, label: t.name }));
  const transactionTypeOptions = options.transactionTypes
    .filter((t) => !entityTypeId || t.entityTypeIds.includes(entityTypeId))
    .map((t) => ({ value: t.id, label: t.name }));

  function setEntityType(id: string) {
    const stillValid = options.transactionTypes.some(
      (t) => t.id === values.transactionTypeId && (!id || t.entityTypeIds.includes(id)),
    );
    onChange({
      ...values,
      entityTypeId: id,
      transactionTypeId: stillValid ? values.transactionTypeId : '',
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <SearchSelect
        label="Entity Type"
        placeholder="Select entity type"
        options={entityTypeOptions}
        value={entityTypeId}
        onChange={setEntityType}
        error={errors?.entityTypeId}
        disabled={!!lockedEntityTypeId}
        clearable={!lockedEntityTypeId}
      />
      <SearchSelect
        label="Transaction Type"
        placeholder={entityTypeId ? 'Select transaction type' : 'Select an entity type first'}
        options={transactionTypeOptions}
        value={values.transactionTypeId}
        onChange={(id) => onChange({ ...values, transactionTypeId: id })}
        error={errors?.transactionTypeId}
        disabled={!entityTypeId}
      />
      <Input
        label={options.baseCurrency ? `Amount (${options.baseCurrency})` : 'Amount'}
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        placeholder="0.00"
        value={values.amount}
        onChange={(e) => onChange({ ...values, amount: e.target.value })}
        error={errors?.amount}
      />
      {productOptions.length > 0 && (
        <SearchSelect
          label="Product / Service (optional)"
          placeholder="Which product is this for?"
          options={productOptions}
          value={values.productId}
          onChange={(id) => onChange({ ...values, productId: id })}
        />
      )}
      <Input
        label="Description (optional)"
        placeholder="e.g. Annual policy premium"
        value={values.description}
        onChange={(e) => onChange({ ...values, description: e.target.value })}
        maxLength={500}
      />
    </div>
  );
}
