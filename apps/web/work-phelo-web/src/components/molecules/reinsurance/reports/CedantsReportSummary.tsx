'use client';

import { Landmark, BanknoteArrowDown, AlertCircle } from 'lucide-react';
import { MetricCard } from '@/components/molecules/shared/MetricCard';
import { CedantsReportSummary as CedantsReportSummaryData } from '@/hooks/reinsurance/useCedantsReport';

function fmtAmount(value: number, symbol: string): string {
  const abs = Math.abs(value);
  let formatted: string;
  if (abs >= 1_000_000_000) formatted = `${(value / 1_000_000_000).toFixed(2)}B`;
  else if (abs >= 1_000_000) formatted = `${(value / 1_000_000).toFixed(2)}M`;
  else if (abs >= 1_000) formatted = `${(value / 1_000).toFixed(2)}K`;
  else formatted = value.toFixed(2);
  return symbol ? `${symbol} ${formatted}` : formatted;
}

interface CedantsReportSummaryProps {
  summary: CedantsReportSummaryData;
  isLoading: boolean;
}

export function CedantsReportSummary({ summary, isLoading }: CedantsReportSummaryProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
      <MetricCard
        label="Active Cedants"
        value={isLoading ? '—' : summary.activeCedants}
        icon={Landmark}
      />
      <MetricCard
        label="Total Premium"
        value={isLoading ? '—' : fmtAmount(summary.totalPremium, summary.currencySymbol)}
        icon={BanknoteArrowDown}
      />
      <MetricCard
        label="Outstanding Premium"
        value={isLoading ? '—' : fmtAmount(summary.outstanding, summary.currencySymbol)}
        icon={AlertCircle}
        variant="warning"
      />
    </div>
  );
}
