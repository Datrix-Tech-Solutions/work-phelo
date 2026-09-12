import { Budget, BudgetDetail } from '@/types/accounting';

// TODO: remove once the budgets API is wired in. Shared fixtures so the list, details
// page, and edit form all read the same demo budgets.
export const MOCK_BUDGET_DETAILS: BudgetDetail[] = [
  {
    id: 'demo-budget-1',
    name: 'Q1 2026 Operating Budget',
    period: 'QUARTERLY',
    scope: 'BOTH',
    startDate: '2026-01-01',
    endDate: '2026-03-31',
    currency: 'GHS',
    incomeBudgeted: 580000,
    expenseBudgeted: 340000,
    netAmount: 240000,
    status: 'ACTIVE',
    createdAt: '2025-12-18T09:12:00.000Z',
    updatedAt: '2026-01-04T14:30:00.000Z',
    lines: [
      {
        accountId: 'acc-4000',
        accountCode: '4000',
        accountName: 'Premium Income',
        category: 'REVENUE',
        budgeted: 500000,
        actual: 421500,
      },
      {
        accountId: 'acc-4100',
        accountCode: '4100',
        accountName: 'Commission Income',
        category: 'REVENUE',
        budgeted: 80000,
        actual: 90800,
      },
      {
        accountId: 'acc-6000',
        accountCode: '6000',
        accountName: 'Salaries & Wages',
        category: 'EXPENSE',
        budgeted: 220000,
        actual: 205400,
      },
      {
        accountId: 'acc-6100',
        accountCode: '6100',
        accountName: 'Office Rent',
        category: 'EXPENSE',
        budgeted: 60000,
        actual: 60000,
      },
      {
        accountId: 'acc-6200',
        accountCode: '6200',
        accountName: 'Marketing & Advertising',
        category: 'EXPENSE',
        budgeted: 45000,
        actual: 52300,
      },
      {
        accountId: 'acc-6300',
        accountCode: '6300',
        accountName: 'Utilities',
        category: 'EXPENSE',
        budgeted: 15000,
        actual: null,
      },
    ],
  },
];

export const MOCK_BUDGETS: Budget[] = MOCK_BUDGET_DETAILS.map((b): Budget => b);

export function findMockBudgetDetail(id: string): BudgetDetail | null {
  return MOCK_BUDGET_DETAILS.find((b) => b.id === id) ?? null;
}
