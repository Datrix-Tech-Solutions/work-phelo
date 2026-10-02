'use client';

import { useMemo } from 'react';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useAccountingConfig } from '@/hooks/accounting/useAccountingConfig';
import { useAccountingCurrencies } from '@/hooks/accounting/useCurrencies';

/** The tenant's base currency code — the currency every statement amount is summed in. */
export function useBaseCurrency() {
  const { data: config } = useAccountingConfig();
  return config?.baseCurrency ?? '';
}

/**
 * Currency picker locked to the base currency until conversion exists: its only option is the
 * base itself, and it can't be opened or changed.
 */
export function BaseCurrencyField({ currency }: { currency: string }) {
  const { data: currencies = [] } = useAccountingCurrencies();
  const options = useMemo(() => {
    if (!currency) return [];
    const match = currencies.find((entry) => entry.code === currency);
    return [{ value: currency, label: match ? `${currency} — ${match.name}` : currency }];
  }, [currency, currencies]);

  return (
    <div className="w-56">
      <SearchSelect
        label="Currency"
        placeholder="Base currency not set"
        options={options}
        value={currency}
        clearable={false}
        disabled
      />
    </div>
  );
}
