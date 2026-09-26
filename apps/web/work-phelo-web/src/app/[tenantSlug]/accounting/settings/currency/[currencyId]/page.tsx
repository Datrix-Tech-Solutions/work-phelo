'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { Icons } from '@/components/atoms/icons';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { FormField } from '@/components/molecules/shared/FormField';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import {
  useAccountingConfig,
  useAccountingCurrencies,
  useCreateExchangeRate,
  useExchangeRatesForCurrency,
  useUpdateExchangeRate,
} from '@/hooks';
import { EditCurrencyPanel } from '@/components/organisms/accounting/panels/EditCurrencyPanel';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { fmtExchangeRateDate, toDateTimeLocal } from '@/lib/accounting/exchangeRateFormat';

interface RateFormValues {
  rate: number | '';
  effectiveAt: string;
}

const RATE_DEFAULTS: RateFormValues = { rate: '', effectiveAt: '' };

export default function CurrencyDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; currencyId: string }>;
}) {
  const { tenantSlug, currencyId } = use(params);
  const toast = useToast();
  const { data: currencies = [], isLoading } = useAccountingCurrencies();
  const { data: config } = useAccountingConfig();
  const currency = currencies.find((c) => c.id === currencyId) ?? null;
  const baseCurrency = config?.baseCurrency;
  const isCurrentBase = !!currency && currency.code === baseCurrency;

  const { rates, latestActive } = useExchangeRatesForCurrency(currency?.code, baseCurrency);
  const { mutateAsync: createExchangeRate, isPending: isCreatingRate } = useCreateExchangeRate();
  const { mutateAsync: updateExchangeRate, isPending: isUpdatingRate } = useUpdateExchangeRate();

  const [editOpen, setEditOpen] = useState(false);
  const [addingRate, setAddingRate] = useState(false);

  const {
    register: registerRate,
    handleSubmit: handleSubmitRate,
    reset: resetRate,
    formState: { errors: rateErrors },
  } = useForm<RateFormValues>({ defaultValues: RATE_DEFAULTS });

  const settingsBase = `/${tenantSlug}/accounting/settings/currency`;

  const openAddRate = () => {
    resetRate({ ...RATE_DEFAULTS, effectiveAt: toDateTimeLocal(new Date().toISOString()) });
    setAddingRate(true);
  };

  const onSubmitRate = async (data: RateFormValues) => {
    if (!currency || !baseCurrency) return;
    try {
      await createExchangeRate({
        fromCurrency: currency.code,
        toCurrency: baseCurrency,
        rate: Number(data.rate),
        effectiveAt: new Date(data.effectiveAt).toISOString(),
      });
      toast.success('Exchange rate added');
      setAddingRate(false);
    } catch (err) {
      toast.error(extractError(err, 'Failed to add exchange rate'));
    }
  };

  const deactivateRate = async () => {
    if (!latestActive) return;
    try {
      await updateExchangeRate({ id: latestActive.id, isActive: false });
      toast.success('Exchange rate deactivated');
    } catch (err) {
      toast.error(extractError(err, 'Failed to deactivate exchange rate'));
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Breadcrumb */}
      <div className={`${pageBreadcrumb} shrink-0`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={settingsBase} className="hover:text-gray-700 transition-colors">
            Currency
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">{currency?.code ?? '—'}</span>
        </nav>
      </div>

      {/* Content */}
      <div className={`${pageContent} flex-1 min-h-0 overflow-y-auto`}>
        {isLoading ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Loading…
          </div>
        ) : !currency ? (
          <div className="flex items-center justify-center h-40 text-sm text-gray-400">
            Currency not found.
          </div>
        ) : (
          <div className="flex flex-col gap-6 w-full">
            {/* Header card */}
            <div className="flex items-start justify-between rounded-2xl border border-gray-200 bg-white p-6">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-100 text-sm font-bold text-gray-700 tracking-wider">
                    {currency.code}
                  </span>
                  {isCurrentBase && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-50 text-xs font-semibold text-orange-600">
                      Base Currency
                    </span>
                  )}
                  <Badge
                    label={currency.isActive ? 'Active' : 'Inactive'}
                    variant={currency.isActive ? 'success' : 'neutral'}
                  />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">{currency.name}</h2>
                <dl className="flex gap-6 text-sm text-gray-500">
                  <div>
                    <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">
                      Symbol
                    </dt>
                    <dd className="text-gray-700 font-medium">{currency.symbol ?? '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">
                      Exchange Rate
                    </dt>
                    <dd className="text-gray-700 font-medium">
                      {isCurrentBase
                        ? 'Base'
                        : latestActive
                          ? Number(latestActive.rate).toFixed(4)
                          : '—'}
                    </dd>
                  </div>
                </dl>
              </div>
              <Button onClick={() => setEditOpen(true)}>Edit</Button>
            </div>

            {/* Exchange rate history card */}
            {!isCurrentBase && (
              <div className="rounded-2xl border border-gray-200 bg-white p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-gray-700">Exchange Rate History</h3>
                  {!addingRate && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={openAddRate}
                      icon={<Icons.Plus className="w-4 h-4" />}
                    >
                      Add Rate
                    </Button>
                  )}
                </div>

                {addingRate && (
                  <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 mb-4">
                    <FormField
                      label={`Rate (${currency.code} to ${baseCurrency})`}
                      type="number"
                      step="0.00000001"
                      registration={registerRate('rate', {
                        required: 'Rate is required',
                        valueAsNumber: true,
                        min: { value: 0.00000001, message: 'Rate must be greater than zero' },
                      })}
                      error={rateErrors.rate}
                      placeholder="e.g. 16.5"
                    />
                    <FormField
                      label="Effective At"
                      type="datetime-local"
                      registration={registerRate('effectiveAt', {
                        required: 'Effective date and time is required',
                      })}
                      error={rateErrors.effectiveAt}
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setAddingRate(false)}
                        disabled={isCreatingRate}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        isLoading={isCreatingRate}
                        loadingText="Saving…"
                        onClick={handleSubmitRate(onSubmitRate)}
                      >
                        Save Rate
                      </Button>
                    </div>
                  </div>
                )}

                {rates.length === 0 && !addingRate && (
                  <p className="text-sm text-gray-400">No exchange rates recorded yet.</p>
                )}

                {rates.length > 0 && (
                  <div className="flex flex-col divide-y divide-gray-100 rounded-lg border border-gray-100">
                    {rates.map((rate) => {
                      const isLatest = rate.id === latestActive?.id;
                      return (
                        <div key={rate.id} className="flex items-center justify-between px-4 py-3">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">
                              {Number(rate.rate).toFixed(8)}
                            </span>
                            <span className="text-xs text-gray-400">
                              {fmtExchangeRateDate(rate.effectiveAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge
                              label={rate.isActive ? 'Active' : 'Inactive'}
                              variant={rate.isActive ? 'success' : 'neutral'}
                            />
                            {isLatest && rate.isActive && (
                              <button
                                type="button"
                                onClick={deactivateRate}
                                disabled={isUpdatingRate}
                                className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
                              >
                                Deactivate
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <EditCurrencyPanel
        currency={editOpen ? currency : null}
        baseCurrency={baseCurrency}
        onClose={() => setEditOpen(false)}
      />
    </div>
  );
}
