'use client';

import { ReportCurrencySummaryCards } from '@/components/molecules/reinsurance/reports/ReportCurrencySummaryCards';
import { ReportCurrencyTotals } from '@/hooks/reinsurance/useReportCurrencyTotals';

interface FacultativeReportSummaryProps {
  currencyTotals: ReportCurrencyTotals;
  isLoading: boolean;
}

export function FacultativeReportSummary({
  currencyTotals,
  isLoading,
}: FacultativeReportSummaryProps) {
  return <ReportCurrencySummaryCards totals={currencyTotals} isLoading={isLoading} />;
}
