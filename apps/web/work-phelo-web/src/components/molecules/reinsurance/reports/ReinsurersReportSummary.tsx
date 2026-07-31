'use client';

import { ReportCurrencySummaryCards } from '@/components/molecules/reinsurance/reports/ReportCurrencySummaryCards';
import { ReportCurrencyTotals } from '@/hooks/reinsurance/useReportCurrencyTotals';

interface ReinsurersReportSummaryProps {
  currencyTotals: ReportCurrencyTotals;
  isLoading: boolean;
}

export function ReinsurersReportSummary({
  currencyTotals,
  isLoading,
}: ReinsurersReportSummaryProps) {
  return <ReportCurrencySummaryCards totals={currencyTotals} isLoading={isLoading} />;
}
