'use client';

import { Period } from '@/components/atoms/PeriodToggle';
import { CurrencyAmountListCard } from '@/components/molecules/reinsurance/stats/CurrencyAmountListCard';
import { QuickActionsCard } from '@/components/molecules/reinsurance/QuickActionsCard';
import { useReinsuranceFinancialsByCurrency, useCurrencies } from '@/hooks';

interface FinancialStatsRowProps {
  period: Period;
}

export function FinancialStatsRow({ period }: FinancialStatsRowProps) {
  const { data, isLoading } = useReinsuranceFinancialsByCurrency({ period });
  const { data: currencies = [] } = useCurrencies();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      <CurrencyAmountListCard
        title="Sum Insured"
        columnLabel="Sum Insured"
        amountsByCode={data.sumInsured}
        currencies={currencies}
        isLoading={isLoading}
      />
      <CurrencyAmountListCard
        title="Total Premium"
        columnLabel="Total Premium"
        amountsByCode={data.premium}
        currencies={currencies}
        isLoading={isLoading}
      />
      <CurrencyAmountListCard
        title="Total Brokerage"
        columnLabel="Total Brokerage"
        amountsByCode={data.brokerage}
        currencies={currencies}
        isLoading={isLoading}
      />
      <CurrencyAmountListCard
        title="Total Claim Incurred"
        columnLabel="Total Claims"
        amountsByCode={data.claimsIncurred}
        currencies={currencies}
        isLoading={isLoading}
      />
      <QuickActionsCard />
    </div>
  );
}
