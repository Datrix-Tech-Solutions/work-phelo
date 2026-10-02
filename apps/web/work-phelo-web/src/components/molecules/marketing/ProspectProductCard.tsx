'use client';

import { Banknote, CalendarDays, Package, Percent, Target } from 'lucide-react';
import { DataCard, DataCardDetail } from '@/components/organisms/shared/DataCard';
import { frostedAvatarStyle } from '@/lib/utils';
import type { ProspectDetailProduct } from '@/types/marketing';

function formatMoney(value: string | null): string {
  if (value == null) return '—';
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function detail(Icon: typeof Package, label: string, value: string): DataCardDetail {
  return {
    label: (
      <>
        <Icon className="w-3 h-3" /> {label}
      </>
    ),
    value: <span className="text-xs font-semibold text-gray-700">{value}</span>,
  };
}

export function ProspectProductCard({ product }: { product: ProspectDetailProduct }) {
  const details: DataCardDetail[] = [
    detail(Target, 'Expected Revenue', formatMoney(product.expectedValue)),
    detail(Banknote, 'Achieved Revenue', formatMoney(product.achievedValue)),
    detail(CalendarDays, 'Expected Close', formatDate(product.expectedCloseDate)),
    ...(product.commissionRate != null
      ? [detail(Percent, 'Commission Rate', `${Number(product.commissionRate)}%`)]
      : []),
    ...(product.commissionAmount != null
      ? [detail(Banknote, 'Commission', formatMoney(product.commissionAmount))]
      : []),
  ];

  return (
    <DataCard
      icon={
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/30 text-white"
          style={frostedAvatarStyle('#8b5cf6')}
        >
          <Package className="h-5 w-5" />
        </div>
      }
      title={product.product.name}
      details={details}
      surface="card"
    />
  );
}
