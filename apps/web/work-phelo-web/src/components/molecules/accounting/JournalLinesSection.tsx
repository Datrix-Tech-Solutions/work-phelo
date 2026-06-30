'use client';

import { useFieldArray, useWatch, Controller, UseFormReturn } from 'react-hook-form';
import { SearchSelect, SearchSelectOption } from '@/components/atoms/SearchSelect';
import { inputClass } from '@/lib/utils';
import { InlineTable, InlineTableColumn } from '@/components/organisms/shared/InlineTable';
import { JournalEntryFormValues, JournalLine } from '@/types/accounting';

// TODO: populate from chart of accounts API
const ACCOUNT_OPTIONS: SearchSelectOption[] = [];

const EMPTY_LINE: JournalLine = { targetAccount: '', description: '', debit: '', credit: '' };

function fmtAmount(value: number, currency: string) {
  const n = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${currency} ${n}` : n;
}

interface JournalLinesSectionProps {
  form: UseFormReturn<JournalEntryFormValues>;
}

export function JournalLinesSection({ form }: JournalLinesSectionProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  const lines = useWatch({ control, name: 'lines' });
  const currency = useWatch({ control, name: 'currency' });

  const debitTotal = (lines ?? []).reduce((sum, l) => sum + (Number(l?.debit) || 0), 0);
  const creditTotal = (lines ?? []).reduce((sum, l) => sum + (Number(l?.credit) || 0), 0);

  const columns: InlineTableColumn[] = [
    {
      key: 'targetAccount',
      label: 'Target Account',
      width: '2fr',
      renderField: (index) => {
        const err = errors.lines?.[index]?.targetAccount;
        return (
          <Controller
            name={`lines.${index}.targetAccount`}
            control={control}
            rules={{ required: true }}
            render={({ field }) => (
              <SearchSelect
                placeholder="Select account…"
                options={ACCOUNT_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={err ? '' : undefined}
                size="sm"
              />
            )}
          />
        );
      },
    },
    {
      key: 'description',
      label: 'Description',
      width: '2fr',
      renderField: (index) => (
        <input
          {...register(`lines.${index}.description`)}
          placeholder="Line description…"
          className={inputClass(undefined, 'py-2 text-sm')}
        />
      ),
    },
    {
      key: 'debit',
      label: 'Debit',
      width: '140px',
      align: 'right',
      renderField: (index) => {
        const err = errors.lines?.[index]?.debit;
        return (
          <input
            {...register(`lines.${index}.debit`, { valueAsNumber: true })}
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            className={inputClass(err ? 'error' : undefined, 'py-2 text-sm text-right')}
          />
        );
      },
      renderFooter: () => fmtAmount(debitTotal, currency),
    },
    {
      key: 'credit',
      label: 'Credit',
      width: '140px',
      align: 'right',
      renderField: (index) => {
        const err = errors.lines?.[index]?.credit;
        return (
          <input
            {...register(`lines.${index}.credit`, { valueAsNumber: true })}
            type="number"
            min={0}
            step="0.01"
            placeholder="0.00"
            className={inputClass(err ? 'error' : undefined, 'py-2 text-sm text-right')}
          />
        );
      },
      renderFooter: () => fmtAmount(creditTotal, currency),
    },
  ];

  return (
    <InlineTable
      title="Journal Lines"
      addLabel="Add Line"
      columns={columns}
      fieldIds={fields.map((f) => f.id)}
      onAddRow={() => append({ ...EMPTY_LINE })}
      onRemoveRow={(index) => remove(index)}
    />
  );
}
