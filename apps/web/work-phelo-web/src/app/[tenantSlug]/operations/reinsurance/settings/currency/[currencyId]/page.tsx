'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { Icons } from '@/components/atoms/icons';
import { pageBreadcrumb, pageContent } from '@/lib/layout';
import { useCurrencies } from '@/hooks';
import { EditCurrencyPanel } from '@/components/organisms/reinsurance/panels/EditCurrencyPanel';
import { CurrencyRateTrendChart } from '@/components/molecules/reinsurance/CurrencyRateTrendChart';
import { Button } from '@/components/atoms/Button';

export default function CurrencyDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; currencyId: string }>;
}) {
  const { tenantSlug, currencyId } = use(params);
  const { data: currencies = [], isLoading } = useCurrencies();
  const currency = currencies.find((c) => c.id === currencyId) ?? null;

  const [editOpen, setEditOpen] = useState(false);

  const settingsBase = `/${tenantSlug}/operations/reinsurance/settings/currency`;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Breadcrumb */}
      <div className={`${pageBreadcrumb} shrink-0`}>
        <nav className="flex items-center gap-2 text-sm text-gray-400">
          <Link href={settingsBase} className="hover:text-gray-700 transition-colors">
            Currency
          </Link>
          <Icons.ChevronRight className="w-5 h-5" />
          <span className="text-gray-700 font-medium">{currency?.isoCode ?? '—'}</span>
        </nav>
      </div>

      {/* Content */}
      <div className={`${pageContent} flex-1 overflow-y-auto`}>
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
                    {currency.isoCode}
                  </span>
                  {currency.isBaseCurrency && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-orange-50 text-xs font-semibold text-orange-600">
                      Base Currency
                    </span>
                  )}
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
                      {currency.isBaseCurrency
                        ? 'Base'
                        : currency.exchangeRateToBase
                          ? parseFloat(currency.exchangeRateToBase).toFixed(4)
                          : '—'}
                    </dd>
                  </div>
                </dl>
              </div>
              <Button onClick={() => setEditOpen(true)}>Update Rate</Button>
            </div>

            {/* Trend chart card */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Exchange Rate Trend</h3>
              <CurrencyRateTrendChart isoCode={currency.isoCode} data={[]} />
            </div>
          </div>
        )}
      </div>

      <EditCurrencyPanel currency={editOpen ? currency : null} onClose={() => setEditOpen(false)} />
    </div>
  );
}
