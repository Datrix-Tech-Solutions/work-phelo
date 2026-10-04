'use client';

import { Banknote, CalendarDays, Package, Percent, Target } from 'lucide-react';
import { TypeChip, type TypeChipColor } from '@/components/atoms/TypeChip';
import { DataCard, type DataCardDetail } from '@/components/organisms/shared/DataCard';
import { formatMoney } from '@/lib/formatMoney';
import { frostedAvatarStyle } from '@/lib/utils';
import type { ClientDetailProduct, ClientProductStatus } from '@/types/marketing';

const STATUS: Record<ClientProductStatus, { label: string; color: TypeChipColor }> = {
  PENDING: { label: 'Pending', color: 'amber' },
  PURCHASED: { label: 'Purchased', color: 'green' },
  UNINTERESTED: { label: 'Uninterested', color: 'gray' },
};

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function detail(
  Icon: typeof Package,
  label: string,
  value: string,
  iconColor: string,
): DataCardDetail {
  return {
    label: (
      <>
        <Icon className={`w-3 h-3 ${iconColor}`} /> {label}
      </>
    ),
    value: <span className="text-xs font-semibold text-gray-700">{value}</span>,
  };
}

export function ClientProductCard({
  product,
  achievedRevenue,
}: {
  product: ClientDetailProduct;
  /** What Accounting has received for this product's transactions. Null/undefined shows a dash. */
  achievedRevenue?: string | null;
}) {
  const status = STATUS[product.status];

  const details: DataCardDetail[] = [
    detail(Target, 'Expected Revenue', formatMoney(product.expectedValue), 'text-blue-500'),
    detail(Banknote, 'Achieved Revenue', formatMoney(achievedRevenue), 'text-emerald-500'),
    ...(product.commissionRate != null
      ? [
          detail(
            Percent,
            'Commission Rate',
            `${Number(product.commissionRate)}%`,
            'text-violet-500',
          ),
        ]
      : []),
    ...(product.commissionAmount != null
      ? [detail(Banknote, 'Commission', formatMoney(product.commissionAmount), 'text-amber-500')]
      : []),
    detail(CalendarDays, 'Added', formatDate(product.createdAt), 'text-rose-500'),
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
      badge={<TypeChip label={status.label} color={status.color} />}
      details={details}
      surface="card"
    />
  );
}
