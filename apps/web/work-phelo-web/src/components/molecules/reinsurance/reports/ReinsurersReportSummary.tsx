'use client';

import { Handshake, BanknoteArrowUp, AlertCircle } from 'lucide-react';
import { MetricCard } from '@/components/molecules/shared/MetricCard';
import { ReinsurersReportSummary as ReinsurersReportSummaryData } from '@/hooks/reinsurance/useReinsurersReport';

function fmtAmount(value: number, symbol: string): string {
  const abs = Math.abs(value);
  let formatted: string;
  if (abs >= 1_000_000_000) formatted = `${(value / 1_000_000_000).toFixed(2)}B`;
  else if (abs >= 1_000_000) formatted = `${(value / 1_000_000).toFixed(2)}M`;
  else if (abs >= 1_000) formatted = `${(value / 1_000).toFixed(2)}K`;
  else formatted = value.toFixed(2);
  return symbol ? `${symbol} ${formatted}` : formatted;
}

interface ReinsurersReportSummaryProps {
  summary: ReinsurersReportSummaryData;
  isLoading: boolean;
}

export function ReinsurersReportSummary({ summary, isLoading }: ReinsurersReportSummaryProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
      <MetricCard
        label="Active Reinsurers"
        value={isLoading ? '—' : summary.activeReinsurers}
        icon={Handshake}
      />
      <MetricCard
        label="Ceded Premium"
        value={isLoading ? '—' : fmtAmount(summary.cededPremium, summary.currencySymbol)}
        icon={BanknoteArrowUp}
      />
      <MetricCard
        label="Outstanding Disbursement"
        value={isLoading ? '—' : fmtAmount(summary.outstanding, summary.currencySymbol)}
        icon={AlertCircle}
        variant="warning"
      />
    </div>
  );
}
