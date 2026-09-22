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
import { useFiscalYears, useIncomeStatementReport, useTrialBalanceReport } from '@/hooks';
import { useGLAccounts } from '@/hooks/accounting/useGLAccounts';
import { buildClosingLines, buildOpeningLines } from '@/lib/accounting/yearEndLines';

interface JournalEntryDetailsSectionProps {
  form: UseFormReturn<JournalEntryFormValues>;
  entryType: JournalEntryType;
}

export function JournalEntryDetailsSection({ form, entryType }: JournalEntryDetailsSectionProps) {
  const {
    register,
    control,
    setValue,
    getValues,
    formState: { errors },
  } = form;

  const { options: currencyOptions } = useAccountingCurrencyOptions();
  const { data: config } = useAccountingConfig();
  const { data: openPeriods = [] } = useFiscalPeriods({ status: 'OPEN' });
  const { data: glAccounts = [] } = useGLAccounts();
  const { data: fiscalYears = [] } = useFiscalYears();

  const transactionDate = useWatch({ control, name: 'transactionDate' });
  const currency = useWatch({ control, name: 'currency' });

  const matchedPeriod = transactionDate
    ? openPeriods.find((p) => {
        const date = new Date(transactionDate).getTime();
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

  const fiscalYearId = useWatch({ control, name: 'fiscalYearId' });
  const retainedEarningsAccountId = useWatch({ control, name: 'retainedEarningsAccountId' });
  const balancingAccountId = useWatch({ control, name: 'balancingAccountId' });
  const selectedYear = fiscalYears.find((y) => y.id === fiscalYearId);
  const yearAccountId = isClosing ? retainedEarningsAccountId : balancingAccountId;

  // Opening balances carry over what the books held the day before the year started.
  const dayBeforeStart = selectedYear
    ? new Date(new Date(selectedYear.startDate).getTime() - 86_400_000).toISOString().slice(0, 10)
    : undefined;
  const { data: incomeReport, isLoading: isLoadingIncome } = useIncomeStatementReport(
    {
      fromDate: selectedYear?.startDate.slice(0, 10),
      toDate: selectedYear?.endDate.slice(0, 10),
    },
    isClosing && !!selectedYear,
  );
  const { data: trialReport, isLoading: isLoadingTrial } = useTrialBalanceReport(
    { asOfDate: dayBeforeStart },
    isOpening && !!selectedYear,
  );
  const isGeneratingLines = isClosing ? isLoadingIncome : isOpening ? isLoadingTrial : false;

  // Generates the lines once the year, its report and the offsetting account are all known.
  // Regenerates only when one of those changes, so hand edits survive a background refetch.
  const generatedFor = useRef('');
  useEffect(() => {
    if (!needsFiscalYear) {
      generatedFor.current = '';
      return;
    }
    const report = isClosing ? incomeReport : trialReport;
    if (!selectedYear || !yearAccountId || !report) return;
    const key = `${entryType}:${selectedYear.id}:${yearAccountId}`;
    if (generatedFor.current === key) return;
    generatedFor.current = key;

    const lines = isClosing
      ? buildClosingLines(incomeReport!, yearAccountId)
      : buildOpeningLines(trialReport!, yearAccountId);
    if (lines.length > 0) setValue('lines', lines);
    if (config?.baseCurrency) {
      setValue('currency', config.baseCurrency, { shouldValidate: true });
      setValue('exchangeRate', '');
    }
    if (!getValues('description')) {
      setValue(
        'description',
        `${isClosing ? 'Closing entry' : 'Opening balances'} – ${selectedYear.name}`,
      );
    }
  }, [
    needsFiscalYear,
    isClosing,
    entryType,
    selectedYear,
    yearAccountId,
    incomeReport,
    trialReport,
    config?.baseCurrency,
    setValue,
    getValues,
  ]);

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

  const needsExchangeRate =
    !!currency && !!config?.baseCurrency && currency !== config.baseCurrency;

  return (
    <FormSection title="Entry Details">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="flex flex-col gap-(--field-label-gap,0.125rem)">
          <Controller
            name="transactionDate"
            control={control}
            rules={{ required: 'Transaction date is required' }}
            render={({ field }) => (
              <DatePicker
                label="Transaction Date"
                value={field.value}
                onChange={field.onChange}
                error={errors.transactionDate?.message}
              />
            )}
          />
          {transactionDate && (
            <p className={cn('text-xs', matchedPeriod ? 'text-gray-400' : 'text-red-500')}>
              {matchedPeriod
                ? `Fiscal Period: ${matchedPeriod.name}`
                : 'No open fiscal period covers this date'}
            </p>
          )}
        </div>

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
          {selectedYear && yearAccountId && (
            <p className="text-xs text-gray-400 sm:col-span-3">
              {isGeneratingLines
                ? 'Generating lines…'
                : isClosing
                  ? `Lines are generated from ${selectedYear.name}'s revenue and expenses. Edit them or post as they are.`
                  : `Lines are generated from the balances at the end of the previous year. Edit them or post as they are.`}
            </p>
          )}
        </div>
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
