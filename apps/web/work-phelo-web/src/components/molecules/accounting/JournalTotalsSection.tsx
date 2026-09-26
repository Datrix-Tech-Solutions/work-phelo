'use client';

import { useWatch, UseFormReturn } from 'react-hook-form';
import { cn, cardClass } from '@/lib/utils';
import { JournalEntryFormValues } from '@/types/accounting';

function fmtAmount(value: number, currency: string) {
  const n = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${currency} ${n}` : n;
}

interface JournalTotalsSectionProps {
  form: UseFormReturn<JournalEntryFormValues>;
}

export function JournalTotalsSection({ form }: JournalTotalsSectionProps) {
  const lines = useWatch({ control: form.control, name: 'lines' });
  const currency = useWatch({ control: form.control, name: 'currency' });

  const debitTotal = (lines ?? []).reduce((sum, l) => sum + (Number(l?.debit) || 0), 0);
  const creditTotal = (lines ?? []).reduce((sum, l) => sum + (Number(l?.credit) || 0), 0);
  const differenceCents = Math.round(debitTotal * 100) - Math.round(creditTotal * 100);
  const difference = differenceCents / 100;
  const isBalanced = differenceCents === 0;

  const items = [
    { label: 'Total Debit', value: fmtAmount(debitTotal, currency), tone: 'text-gray-900' },
    { label: 'Total Credit', value: fmtAmount(creditTotal, currency), tone: 'text-gray-900' },
    {
      label: 'Difference',
      value: fmtAmount(Math.abs(difference), currency),
      tone: isBalanced ? 'text-gray-900' : 'text-red-600',
    },
  ];

  return (
    <div
      className={cardClass('flex flex-wrap items-center justify-end gap-x-10 gap-y-2 px-6 py-3')}
    >
      {items.map((item) => (
        <div key={item.label} className="flex items-baseline gap-2">
          <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
            {item.label}
          </span>
          <span className={cn('text-sm font-semibold', item.tone)}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}
