'use client';

import { useWatch, UseFormReturn } from 'react-hook-form';
import { Button } from '@/components/atoms/Button';
import { Icons } from '@/components/atoms/icons';
import { cn, cardClass } from '@/lib/utils';
import { JournalEntryFormValues } from '@/types/accounting';

function fmtAmount(value: number, currency: string) {
  const n = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${currency} ${n}` : n;
}

interface JournalTotalsSectionProps {
  form: UseFormReturn<JournalEntryFormValues>;
  onAddLine: () => void;
  onImport: () => void;
}

export function JournalTotalsSection({ form, onAddLine, onImport }: JournalTotalsSectionProps) {
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
      className={cardClass(
        'flex flex-wrap items-center justify-between gap-x-10 gap-y-2 px-6 py-2',
      )}
    >
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onAddLine}
          icon={<Icons.Plus className="w-4 h-4" />}
        >
          Add Line
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onImport}
          icon={<Icons.Upload className="w-4 h-4" />}
        >
          Import
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-x-10 gap-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-baseline gap-2">
            <span className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
              {item.label}
            </span>
            <span className={cn('text-sm font-semibold', item.tone)}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
