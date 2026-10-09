import { useMemo } from 'react';
import type { Period } from '@/components/atoms/PeriodToggle';
import { dashboardRanges, percentChange } from '@/lib/dashboardPeriod';
import { useAccountingConfig } from './useAccountingConfig';
import { useCashAndBankStats } from './useCashbook';
import {
  useBalanceSheetReport,
  useCashFlowStatementReport,
  useIncomeStatementReport,
} from './useFinancialReports';
import { useAccountsPayableSummary, useAccountsReceivableSummary } from './useTradeSummaries';
import type { AccountingCurrencyTotal } from '@/types/accounting';

const num = (value: string | undefined) => (value === undefined ? undefined : Number(value));

const toTotals = (rows: AccountingCurrencyTotal[] | undefined): Record<string, number> =>
  Object.fromEntries((rows ?? []).map((row) => [row.currency, Number(row.amount)]));

/**
 * Everything the accounting dashboard's KPI cards show. Cash, receivables and payables are
 * per-currency balances. Profit, revenue, expenses, net cash change and net worth come from the
 * financial statements, so they are in the base currency and ignore the currency filter.
 * Trends compare with the previous period (see `dashboardRanges`).
 */
export function useAccountingDashboardStats(period: Period, year: number) {
  const ranges = useMemo(() => dashboardRanges(period, year), [period, year]);
  const { fromDate, toDate, prevFromDate, prevToDate } = ranges;

  const { data: config } = useAccountingConfig();
  const cash = useCashAndBankStats();
  const receivables = useAccountsReceivableSummary();
  const payables = useAccountsPayableSummary();

  const income = useIncomeStatementReport({ fromDate, toDate }, true);
  const prevIncome = useIncomeStatementReport({ fromDate: prevFromDate, toDate: prevToDate }, true);
  const cashFlow = useCashFlowStatementReport({ fromDate, toDate }, true);
  const prevCashFlow = useCashFlowStatementReport(
    { fromDate: prevFromDate, toDate: prevToDate },
    true,
  );
  const balance = useBalanceSheetReport({ asOfDate: toDate }, true);
  const prevBalance = useBalanceSheetReport({ asOfDate: prevToDate }, true);

  const profit = num(income.data?.netProfitOrLoss);
  const prevProfit = num(prevIncome.data?.netProfitOrLoss);
  const revenue = num(income.data?.totalRevenue);
  const prevRevenue = num(prevIncome.data?.totalRevenue);
  const expenses = num(income.data?.totalExpenses);

  const netCashChange = num(cashFlow.data?.netChangeInCash);
  const prevNetCashChange = num(prevCashFlow.data?.netChangeInCash);

  // Assets minus liabilities rather than the equity total: profit not yet closed into
  // retained earnings is missing from equity but is still part of what the business is worth.
  const assets = num(balance.data?.totalAssets);
  const liabilities = num(balance.data?.totalLiabilities);
  const netWorth =
    assets !== undefined && liabilities !== undefined ? assets - liabilities : undefined;
  const prevAssets = num(prevBalance.data?.totalAssets);
  const prevLiabilities = num(prevBalance.data?.totalLiabilities);
  const prevNetWorth =
    prevAssets !== undefined && prevLiabilities !== undefined
      ? prevAssets - prevLiabilities
      : undefined;

  const trend = (current?: number, previous?: number) =>
    current !== undefined && previous !== undefined ? percentChange(current, previous) : undefined;

  return {
    baseCurrency: config?.baseCurrency ?? '',
    cashPosition: { totals: cash.data?.netCashPosition, isLoading: cash.isLoading },
    receivables: {
      totals: toTotals(receivables.data?.outstandingByCurrency),
      isLoading: receivables.isLoading,
    },
    payables: {
      totals: toTotals(payables.data?.outstandingByCurrency),
      isLoading: payables.isLoading,
    },
    netProfit: {
      value: profit,
      trend: trend(profit, prevProfit),
      isLoading: income.isLoading || prevIncome.isLoading,
    },
    revenueAndExpenses: {
      revenue,
      expenses,
      revenueTrend: trend(revenue, prevRevenue),
      isLoading: income.isLoading || prevIncome.isLoading,
    },
    netCash: {
      change: netCashChange,
      operating: num(cashFlow.data?.operatingActivities.total),
      investing: num(cashFlow.data?.investingActivities.total),
      financing: num(cashFlow.data?.financingActivities.total),
      trend: trend(netCashChange, prevNetCashChange),
      isLoading: cashFlow.isLoading || prevCashFlow.isLoading,
    },
    netWorth: {
      value: netWorth,
      assets,
      liabilities,
      trend: trend(netWorth, prevNetWorth),
      isLoading: balance.isLoading || prevBalance.isLoading,
    },
  };
}
