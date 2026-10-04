'use client';

import { ToggleRow } from '@/components/molecules/shared/ToggleRow';
import {
  ClientBillingErrors,
  ClientBillingFields,
  ClientBillingValues,
} from '@/components/molecules/marketing/ClientBillingFields';
import { useBillingOptions } from '@/hooks/marketing/useClients';

interface Props {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  values: ClientBillingValues;
  onValuesChange: (values: ClientBillingValues) => void;
  errors?: ClientBillingErrors;
  /** The client's products the transaction can be tagged to. */
  productOptions?: { value: string; label: string }[];
  /** Set when the client already has an entity in Accounting. */
  lockedEntityTypeId?: string | null;
}

/**
 * The Billable switch together with the first-transaction form it opens. The switch can't be used
 * until Accounting is set up for billing clients, and says why.
 */
export function BillingSection({
  enabled,
  onEnabledChange,
  values,
  onValuesChange,
  errors,
  productOptions,
  lockedEntityTypeId,
}: Props) {
  const { data: options, isLoading, isError } = useBillingOptions();

  const blockedReason = isLoading
    ? 'Checking Accounting…'
    : isError || !options
      ? 'Accounting is currently unavailable'
      : !options.canBill
        ? "You don't have permission to bill clients"
        : !options.ready
          ? (options.message ?? 'Accounting not set up')
          : null;
  const usable = !blockedReason && !!options;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <ToggleRow
          label="Billable"
          description={
            lockedEntityTypeId
              ? 'Raise a new transaction in Accounting for this client.'
              : "Raise this client's first transaction in Accounting."
          }
          enabled={enabled && usable}
          onChange={onEnabledChange}
          disabled={!usable}
        />
        {blockedReason && <p className="text-xs font-medium text-amber-600">{blockedReason}</p>}
      </div>

      {enabled && usable && (
        <ClientBillingFields
          options={options}
          values={values}
          onChange={onValuesChange}
          errors={errors}
          lockedEntityTypeId={lockedEntityTypeId}
          productOptions={productOptions}
        />
      )}
    </div>
  );
}
