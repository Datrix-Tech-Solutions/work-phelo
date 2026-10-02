'use client';

import { useEffect, useRef } from 'react';
import { Controller, useWatch, UseFormReturn } from 'react-hook-form';
import { FormSection } from '@/components/atoms/FormSection';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { FormField } from '@/components/molecules/shared/FormField';
import { JournalEntryFormValues } from '@/types/accounting';
import { useFiscalPeriods, useJournals } from '@/hooks';
import { canReverse } from '@/lib/accounting/journalStatus';
import { formatJournalNumber } from '@/lib/formatters';
import { formatSourceEventDescription } from '@/config/reinsurance-event-catalog';
import { cardClass, cn } from '@/lib/utils';

function fmtAmount(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface ReversingEntryFormProps {
  form: UseFormReturn<JournalEntryFormValues>;
}

/**
 * Reverses a posted journal. The reversal is an exact copy with every debit and credit swapped,
 * posted as a second, linked journal; the original is left untouched. The lines are shown here
 * for review but are not editable — to change anything, reverse and post a correcting journal.
 */
export function ReversingEntryForm({ form }: ReversingEntryFormProps) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = form;

  const { data: journals = [] } = useJournals({ status: 'POSTED' });
  const { data: allPeriods = [] } = useFiscalPeriods();
  const originalJournalId = useWatch({ control, name: 'originalJournalId' });
  const reversalDate = useWatch({ control, name: 'reversalDate' });

  const reversible = journals.filter(canReverse);
  const original = reversible.find((j) => j.id === originalJournalId);

  // Default the reversal date to the first day of the next fiscal month, once.
  const appliedDefault = useRef(false);
  useEffect(() => {
    if (appliedDefault.current) return;
    const now = Date.now();
    const next = allPeriods
      .filter((p) => new Date(p.startDate).getTime() > now)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];
    if (!next) return;
    setValue('reversalDate', next.startDate.slice(0, 10), { shouldValidate: true });
    appliedDefault.current = true;
  }, [allPeriods, setValue]);

  const period = reversalDate
    ? allPeriods.find(
        (p) =>
          p.status === 'OPEN' &&
          new Date(reversalDate).getTime() >= new Date(p.startDate).getTime() &&
          new Date(reversalDate).getTime() <= new Date(p.endDate).getTime(),
      )
    : undefined;
  const beforeOriginal =
    !!original && !!reversalDate && reversalDate < original.transactionDate.slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      <FormSection title="Reversal Details">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Controller
            name="originalJournalId"
            control={control}
            rules={{ required: 'Select the journal to reverse' }}
            render={({ field }) => (
              <SearchSelect
                label="Original Journal"
                placeholder="Select posted journal…"
                options={reversible.map((j) => ({
                  value: j.id,
                  label: formatJournalNumber(j.journalNumber),
                  sublabel: formatSourceEventDescription(j.description),
                }))}
                value={field.value}
                onChange={field.onChange}
                error={errors.originalJournalId?.message}
              />
            )}
          />

          <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
            <Controller
              name="reversalDate"
              control={control}
              rules={{ required: 'Reversal date is required' }}
              render={({ field }) => (
                <DatePicker
                  label="Reversal Date"
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.reversalDate?.message}
                />
              )}
            />
            {reversalDate && (
              <p
                className={cn(
                  'text-xs',
                  period && !beforeOriginal ? 'text-gray-400' : 'text-red-500',
                )}
              >
                {beforeOriginal
                  ? 'The reversal cannot be dated before the original journal'
                  : period
                    ? `Fiscal Period: ${period.name}`
                    : 'No open fiscal period covers this date'}
              </p>
            )}
          </div>
        </div>

        <FormField
          label="Reason"
          type="textarea"
          rows={3}
          registration={register('reversalReason', { required: 'A reason is required' })}
          error={errors.reversalReason}
          placeholder="e.g. Entered with debit and credit the wrong way round"
        />
      </FormSection>

      {original && (
        <div className={cardClass('overflow-hidden')}>
          <div className="px-6 py-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
              Lines that will be posted (debit and credit swapped)
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500">
              <tr>
                <th className="px-6 py-2 text-left font-medium">Account</th>
                <th className="px-3 py-2 text-left font-medium">Description</th>
                <th className="px-3 py-2 text-right font-medium">Debit</th>
                <th className="px-6 py-2 text-right font-medium">Credit</th>
              </tr>
            </thead>
            <tbody>
              {original.lines.map((line) => (
                <tr key={line.id} className="border-t border-gray-100">
                  <td className="px-6 py-2 text-gray-900">
                    {line.glAccount.code} – {line.glAccount.name}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{line.description ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-gray-900">
                    {Number(line.transactionCredit) > 0
                      ? fmtAmount(Number(line.transactionCredit), original.transactionCurrency)
                      : '—'}
                  </td>
                  <td className="px-6 py-2 text-right text-gray-900">
                    {Number(line.transactionDebit) > 0
                      ? fmtAmount(Number(line.transactionDebit), original.transactionCurrency)
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
