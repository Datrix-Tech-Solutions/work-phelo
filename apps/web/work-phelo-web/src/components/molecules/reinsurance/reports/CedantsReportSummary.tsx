'use client';

import { ReportCurrencySummaryCards } from '@/components/molecules/reinsurance/reports/ReportCurrencySummaryCards';
import { ReportCurrencyTotals } from '@/hooks/reinsurance/useReportCurrencyTotals';

interface CedantsReportSummaryProps {
  currencyTotals: ReportCurrencyTotals;
  isLoading: boolean;
}

export function CedantsReportSummary({ currencyTotals, isLoading }: CedantsReportSummaryProps) {
  return <ReportCurrencySummaryCards totals={currencyTotals} isLoading={isLoading} />;
}
