'use client';

import { useEffect, useRef, useState } from 'react';
import { Controller, useWatch, UseFormReturn } from 'react-hook-form';
import { FormSection } from '@/components/atoms/FormSection';
import { DatePicker } from '@/components/atoms/DatePicker';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Icons } from '@/components/atoms/icons';
import { AddLeafAccountPanel } from '@/components/organisms/accounting/panels/AddLeafAccountPanel';
import { FormField } from '@/components/molecules/shared/FormField';
import {
  ADJUSTMENT_CATEGORY_OPTIONS,
  JournalEntryFormValues,
  JournalEntryType,
} from '@/types/accounting';
import { useAccountingConfig, useAccountingCurrencyOptions, useFiscalPeriods } from '@/hooks';
import { cn } from '@/lib/utils';
import { useFiscalYears, useJournals } from '@/hooks';
import { useGLAccounts } from '@/hooks/accounting/useGLAccounts';
import { formatJournalNumber } from '@/lib/formatters';
import { formatSourceEventDescription } from '@/config/reinsurance-event-catalog';

interface JournalEntryDetailsSectionProps {
  form: UseFormReturn<JournalEntryFormValues>;
  entryType: JournalEntryType;
}

export function JournalEntryDetailsSection({ form, entryType }: JournalEntryDetailsSectionProps) {
  const {
    register,
    control,
    setValue,
    formState: { errors },
  } = form;

  const { options: currencyOptions } = useAccountingCurrencyOptions();
  const { data: config } = useAccountingConfig();
  const { data: openPeriods = [] } = useFiscalPeriods({ status: 'OPEN' });
  const { data: allPeriods = [] } = useFiscalPeriods();
  const { data: postedJournals = [] } = useJournals({ status: 'POSTED' });
  const { data: glAccounts = [] } = useGLAccounts();
  const { data: fiscalYears = [] } = useFiscalYears();

  const transactionDate = useWatch({ control, name: 'transactionDate' });
  const currency = useWatch({ control, name: 'currency' });
  const reversalDate = useWatch({ control, name: 'reversalDate' });
  const isReversing = entryType === 'reversing';
  // A reversal posts on its reversal date; its transaction date is only the original's date.
  const postingDate = isReversing ? reversalDate : transactionDate;

  const matchedPeriod = postingDate
    ? openPeriods.find((p) => {
        const date = new Date(postingDate).getTime();
        return date >= new Date(p.startDate).getTime() && date <= new Date(p.endDate).getTime();
      })
    : undefined;

  useEffect(() => {
    setValue('fiscalPeriodId', matchedPeriod?.id ?? '');
  }, [matchedPeriod, setValue]);

  const isAdjusting = entryType === 'adjusting';
  const isClosing = entryType === 'closing';
  const isOpening = entryType === 'opening';
  const needsFiscalYear = isClosing || isOpening;

  const equityAccountOptions = glAccounts
    .filter((a) => a.status === 'ACTIVE' && a.allowPosting && a.category === 'EQUITY')
    .map((a) => ({ value: a.id, label: `${a.code} – ${a.name}` }));

  // Which equity-account field opened the "create account" panel, and what was typed in it.
  const [createAccountFor, setCreateAccountFor] = useState<
    'retainedEarningsAccountId' | 'balancingAccountId' | null
  >(null);
  const [createAccountQuery, setCreateAccountQuery] = useState('');

  const renderCreateAccount = (
    field: 'retainedEarningsAccountId' | 'balancingAccountId',
    { query, close }: { query: string; close: () => void },
  ) => (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        setCreateAccountQuery(query);
        setCreateAccountFor(field);
        close();
      }}
      className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left text-brand hover:bg-gray-300 transition-colors"
    >
      <Icons.Plus className="w-4 h-4 shrink-0" />
      <span>
        No account found — <span className="font-semibold">Create account</span>
      </span>
    </button>
  );

  useEffect(() => {
    if (needsFiscalYear) return;
    setValue('fiscalYearId', '');
    setValue('retainedEarningsAccountId', '');
    setValue('balancingAccountId', '');
  }, [needsFiscalYear, setValue]);

  // Closing entries post on the year's last day, opening balances on its first day.
  const handleFiscalYearChange = (yearId: string) => {
    setValue('fiscalYearId', yearId, { shouldValidate: true });
    const year = fiscalYears.find((y) => y.id === yearId);
    if (!year) return;
    const date = isClosing ? year.endDate : year.startDate;
    setValue('transactionDate', date.slice(0, 10), { shouldValidate: true });
  };

  // Adjusting entries default to the last day of the current fiscal month. Applied once per
  // switch to "adjusting" (not on every refetch) so a date the user changes is kept.
  const appliedAdjustingDefault = useRef(false);
  useEffect(() => {
    if (!isAdjusting) {
      appliedAdjustingDefault.current = false;
      setValue('adjustmentCategory', '');
      return;
    }
    if (appliedAdjustingDefault.current) return;
    const now = Date.now();
    const current = openPeriods.find(
      (p) => now >= new Date(p.startDate).getTime() && now <= new Date(p.endDate).getTime(),
    );
    if (!current) return;
    setValue('transactionDate', current.endDate.slice(0, 10), { shouldValidate: true });
    appliedAdjustingDefault.current = true;
  }, [isAdjusting, openPeriods, setValue]);

  // Reversals default to the first day of the next fiscal month; applied once per switch.
  const appliedReversalDefault = useRef(false);
  useEffect(() => {
    if (!isReversing) {
      appliedReversalDefault.current = false;
      setValue('originalJournalId', '');
      setValue('reversalDate', '');
      return;
    }
    if (appliedReversalDefault.current) return;
    const now = Date.now();
    const next = allPeriods
      .filter((p) => new Date(p.startDate).getTime() > now)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())[0];
    if (!next) return;
    setValue('reversalDate', next.startDate.slice(0, 10), { shouldValidate: true });
    appliedReversalDefault.current = true;
  }, [isReversing, allPeriods, setValue]);

  // Picking the journal to reverse copies its date, currency and lines, with debit/credit swapped.
  const handleOriginalJournalChange = (journalId: string) => {
    setValue('originalJournalId', journalId, { shouldValidate: true });
    const journal = postedJournals.find((j) => j.id === journalId);
    if (!journal) return;
    const categoryById = new Map(glAccounts.map((a) => [a.id, a.category]));
    setValue('transactionDate', journal.transactionDate.slice(0, 10), { shouldValidate: true });
    setValue('currency', journal.transactionCurrency, { shouldValidate: true });
    setValue('exchangeRate', Number(journal.exchangeRate) || '');
    setValue(
      'lines',
      journal.lines.map((l) => ({
        accountClass: categoryById.get(l.glAccountId) ?? '',
        targetAccount: l.glAccountId,
        description: l.description ?? '',
        debit: Number(l.transactionCredit) || '',
        credit: Number(l.transactionDebit) || '',
      })),
    );
  };

  const needsExchangeRate =
    !!currency && !!config?.baseCurrency && currency !== config.baseCurrency;

  return (
    <FormSection title="Entry Details">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {isReversing && (
          <Controller
            name="originalJournalId"
            control={control}
            rules={{ required: 'Select the journal to reverse' }}
            render={({ field }) => (
              <SearchSelect
                label="Original Journal"
                placeholder="Select posted journal…"
                options={postedJournals.map((j) => ({
                  value: j.id,
                  label: formatJournalNumber(j.journalNumber),
                  sublabel: formatSourceEventDescription(j.description),
                }))}
                value={field.value}
                onChange={handleOriginalJournalChange}
                error={errors.originalJournalId?.message}
              />
            )}
          />
        )}

        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <Controller
            name="transactionDate"
            control={control}
            rules={{ required: 'Transaction date is required' }}
            render={({ field }) => (
              <DatePicker
                label={isReversing ? 'Original Date' : 'Transaction Date'}
                value={field.value}
                onChange={field.onChange}
                error={errors.transactionDate?.message}
              />
            )}
          />
          {postingDate && !isReversing && (
            <p className={cn('text-xs', matchedPeriod ? 'text-gray-400' : 'text-red-500')}>
              {matchedPeriod
                ? `Fiscal Period: ${matchedPeriod.name}`
                : 'No open fiscal period covers this date'}
            </p>
          )}
        </div>

        {isReversing && (
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
              <p className={cn('text-xs', matchedPeriod ? 'text-gray-400' : 'text-red-500')}>
                {matchedPeriod
                  ? `Fiscal Period: ${matchedPeriod.name}`
                  : 'No open fiscal period covers this date'}
              </p>
            )}
          </div>
        )}

        <Controller
          name="currency"
          control={control}
          rules={{ required: 'Currency is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Currency"
              placeholder="Select currency…"
              options={currencyOptions}
              value={field.value}
              onChange={field.onChange}
              error={errors.currency?.message}
            />
          )}
        />

        <FormField
          label="Reference Number"
          registration={register('reference', { required: 'Reference is required' })}
          error={errors.reference}
          placeholder="e.g. JE-2025-001"
        />
      </div>

      {needsFiscalYear && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Controller
            name="fiscalYearId"
            control={control}
            rules={{ required: 'Fiscal year is required' }}
            render={({ field }) => (
              <SearchSelect
                label="Fiscal Year"
                placeholder="Select fiscal year…"
                options={fiscalYears.map((y) => ({ value: y.id, label: y.name }))}
                value={field.value}
                onChange={handleFiscalYearChange}
                error={errors.fiscalYearId?.message}
              />
            )}
          />
          {isClosing ? (
            <Controller
              name="retainedEarningsAccountId"
              control={control}
              rules={{ required: 'Retained earnings account is required' }}
              render={({ field }) => (
                <SearchSelect
                  label="Retained Earnings Account"
                  placeholder="Select equity account…"
                  options={equityAccountOptions}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.retainedEarningsAccountId?.message}
                  emptyState={(ctx) => renderCreateAccount('retainedEarningsAccountId', ctx)}
                />
              )}
            />
          ) : (
            <Controller
              name="balancingAccountId"
              control={control}
              rules={{ required: 'Balancing account is required' }}
              render={({ field }) => (
                <SearchSelect
                  label="Balancing Account"
                  placeholder="Select equity account…"
                  options={equityAccountOptions}
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.balancingAccountId?.message}
                  emptyState={(ctx) => renderCreateAccount('balancingAccountId', ctx)}
                />
              )}
            />
          )}
        </div>
      )}

      {isAdjusting && (
        <Controller
          name="adjustmentCategory"
          control={control}
          rules={{ required: 'Adjustment category is required' }}
          render={({ field }) => (
            <SearchSelect
              label="Adjustment Category"
              placeholder="Select category…"
              options={ADJUSTMENT_CATEGORY_OPTIONS}
              value={field.value}
              onChange={field.onChange}
              error={errors.adjustmentCategory?.message}
            />
          )}
        />
      )}

      {needsExchangeRate && (
        <FormField
          label={`Exchange Rate to ${config?.baseCurrency}`}
          type="number"
          registration={register('exchangeRate', {
            valueAsNumber: true,
            required: 'Exchange rate is required',
            min: { value: 0.00000001, message: 'Rate must be greater than 0' },
          })}
          error={errors.exchangeRate}
          placeholder="e.g. 16.5"
        />
      )}

      <FormField
        label="Memo"
        type="textarea"
        rows={3}
        registration={register('description', { required: 'Description is required' })}
        error={errors.description}
        placeholder="Provide a brief description of this journal entry…"
      />

      <AddLeafAccountPanel
        isOpen={createAccountFor !== null}
        onClose={() => setCreateAccountFor(null)}
        initialName={createAccountQuery}
        initialAccountType="EQUITY"
        onCreated={(account) => {
          if (createAccountFor) setValue(createAccountFor, account.id, { shouldValidate: true });
        }}
      />
    </FormSection>
  );
}
