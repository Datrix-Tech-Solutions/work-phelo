'use client';

import { useState } from 'react';
import { useFieldArray, useWatch, Controller, UseFormReturn } from 'react-hook-form';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Icons } from '@/components/atoms/icons';
import { inputClass } from '@/lib/utils';
import { InlineTable, InlineTableColumn } from '@/components/organisms/shared/InlineTable';
import { AddLeafAccountPanel } from '@/components/organisms/accounting/panels/AddLeafAccountPanel';
import { CATEGORIES } from '@/components/organisms/accounting/ChartOfAccountsTree';
import { GLAccountCategory, JournalEntryFormValues, JournalLine } from '@/types/accounting';
import { useGLAccounts } from '@/hooks/accounting/useGLAccounts';

const EMPTY_LINE: JournalLine = {
  accountClass: '',
  targetAccount: '',
  description: '',
  debit: '',
  credit: '',
};

const CLASS_OPTIONS = CATEGORIES.map((c) => ({ value: c.value, label: c.label }));

interface JournalLinesSectionProps {
  form: UseFormReturn<JournalEntryFormValues>;
  /** Restricts the Account Class choices (e.g. opening balances are balance sheet only). */
  allowedClasses?: GLAccountCategory[];
}

export function JournalLinesSection({ form, allowedClasses }: JournalLinesSectionProps) {
  const {
    register,
    control,
    formState: { errors },
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: 'lines' });

  const [createAccountForIndex, setCreateAccountForIndex] = useState<number | null>(null);
  const [createAccountQuery, setCreateAccountQuery] = useState('');

  const lines = useWatch({ control, name: 'lines' });
  const { data: glAccounts = [], isLoading: isLoadingAccounts } = useGLAccounts({
    status: 'ACTIVE',
  });
  const postingAccounts = glAccounts.filter((a) => a.allowPosting);
  const optionsFor = (accountClass: string) =>
    postingAccounts
      .filter((a) => !accountClass || a.category === accountClass)
      .map((a) => ({ value: a.id, label: `${a.code} – ${a.name}` }));

  const columns: InlineTableColumn[] = [
    {
      key: 'accountClass',
      label: 'Account Class',
      width: '200px',
      renderField: (index) => (
        <Controller
          name={`lines.${index}.accountClass`}
          control={control}
          render={({ field }) => (
            <SearchSelect
              placeholder="Select class…"
              options={
                allowedClasses
                  ? CLASS_OPTIONS.filter((o) => allowedClasses.includes(o.value))
                  : CLASS_OPTIONS
              }
              value={field.value}
              onChange={(value) => {
                field.onChange(value);
                // The chosen account may not belong to the new class
                form.setValue(`lines.${index}.targetAccount`, '');
              }}
              size="sm"
            />
          )}
        />
      ),
    },
    {
      key: 'targetAccount',
      label: 'Account',
      width: 'minmax(100px,0.8fr)',
      renderField: (index) => {
        const err = errors.lines?.[index]?.targetAccount;
        return (
          <Controller
            name={`lines.${index}.targetAccount`}
            control={control}
            rules={{ required: 'Account is required' }}
            render={({ field }) => (
              <SearchSelect
                placeholder={isLoadingAccounts ? 'Loading…' : 'Select account…'}
                options={optionsFor(lines?.[index]?.accountClass ?? '')}
                value={field.value}
                onChange={(value) => {
                  field.onChange(value);
                  // Keep the class in sync when the account is picked directly
                  const picked = postingAccounts.find((a) => a.id === value);
                  if (picked) form.setValue(`lines.${index}.accountClass`, picked.category);
                }}
                error={err?.message}
                size="sm"
                emptyState={({ query, close }) => (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setCreateAccountQuery(query);
                      setCreateAccountForIndex(index);
                      close();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left text-brand hover:bg-gray-300 transition-colors"
                  >
                    <Icons.Plus className="w-4 h-4 shrink-0" />
                    <span>
                      No account found — <span className="font-semibold">Create account</span>
                    </span>
                  </button>
                )}
              />
            )}
          />
        );
      },
    },
    {
      key: 'description',
      label: 'Description',
      width: 'minmax(150px,1fr)',
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
      width: '100px',
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
    },
    {
      key: 'credit',
      label: 'Credit',
      width: '100px',
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
    },
  ];

  return (
    <>
      <InlineTable
        title="Journal Lines"
        compact
        addLabel="Add Line"
        columns={columns}
        fieldIds={fields.map((f) => f.id)}
        onAddRow={() => append({ ...EMPTY_LINE })}
        onRemoveRow={(index) => remove(index)}
      />

      <AddLeafAccountPanel
        isOpen={createAccountForIndex !== null}
        onClose={() => setCreateAccountForIndex(null)}
        initialName={createAccountQuery}
        onCreated={(account) => {
          if (createAccountForIndex === null) return;
          form.setValue(`lines.${createAccountForIndex}.accountClass`, account.category);
          form.setValue(`lines.${createAccountForIndex}.targetAccount`, account.id);
        }}
      />
    </>
  );
}
