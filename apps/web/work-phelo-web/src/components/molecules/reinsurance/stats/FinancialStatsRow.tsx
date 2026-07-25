'use client';

import { Period } from '@/components/atoms/PeriodToggle';
import { CurrencyAmountListCard } from '@/components/molecules/reinsurance/stats/CurrencyAmountListCard';
import { useReinsuranceFinancialsByCurrency, useCurrencies } from '@/hooks';

interface FinancialStatsRowProps {
  period: Period;
}

export function FinancialStatsRow({ period }: FinancialStatsRowProps) {
  const { data, isLoading } = useReinsuranceFinancialsByCurrency({ period });
  const { data: currencies = [] } = useCurrencies();

  return (
    <div className="flex flex-wrap">
      <div className="w-50">
        <CurrencyAmountListCard
          title="Sum Insured"
          columnLabel="Sum Insured"
          amountsByCode={data.sumInsured}
          currencies={currencies}
          isLoading={isLoading}
        />
      </div>
      <div className="w-50">
        <CurrencyAmountListCard
          title="Total Premium"
          columnLabel="Total Premium"
          amountsByCode={data.premium}
          currencies={currencies}
          isLoading={isLoading}
        />
      </div>
      <div className="w-50">
        <CurrencyAmountListCard
          title="Total Brokerage"
          columnLabel="Total Brokerage"
          amountsByCode={data.brokerage}
          currencies={currencies}
          isLoading={isLoading}
        />
      </div>
      <div className="w-50">
        <CurrencyAmountListCard
          title="Total Claim Incurred"
          columnLabel="Total Claims"
          amountsByCode={data.claimsIncurred}
          currencies={currencies}
          isLoading={isLoading}
        />
      </div>
      <div className="w-50">
        <CurrencyAmountListCard
          title="Total Recoveries"
          columnLabel="Recoveries"
          amountsByCode={data.recoveries}
          currencies={currencies}
          isLoading={isLoading}
        />
      </div>
      <div className="w-50">
        <CurrencyAmountListCard
          title="Outstanding Premiums"
          columnLabel="Outstanding"
          amountsByCode={data.outstandingPremium}
          currencies={currencies}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
