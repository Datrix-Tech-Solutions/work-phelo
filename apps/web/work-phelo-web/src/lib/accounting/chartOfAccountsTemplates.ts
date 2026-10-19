import type {
  BulkImportAccountsPayload,
  CashFlowCategory,
  GLAccountCategory,
} from '@/types/accounting';

interface TemplateAccount {
  code: string;
  name: string;
  cashFlowCategory: CashFlowCategory;
  description: string;
}

interface TemplateGroup {
  code: string;
  name: string;
  accounts: TemplateAccount[];
}

interface TemplateClassification {
  code: string;
  name: string;
  category: GLAccountCategory;
  /** Accounts placed straight under the classification, with no parent account. */
  accounts?: TemplateAccount[];
  groups?: TemplateGroup[];
}

export interface ChartOfAccountsTemplate {
  id: string;
  name: string;
  description: string;
  classifications: TemplateClassification[];
}

const account = (
  code: string,
  name: string,
  cashFlowCategory: CashFlowCategory,
  description: string,
): TemplateAccount => ({ code, name, cashFlowCategory, description });

/** IAS 7 (Statement of Cash Flows) template, following the IAS 7 chart of accounts file. Every
 *  account carries the cash-flow tag it reports under: cash and cash equivalents (including the
 *  overdraft) are CASH_EQUIVALENT, and non-cash items are EXCLUDED, which the cash flow report
 *  adds back or reverses in operating (showing the investing half for a disposal). Codes follow the
 *  type ranges and parent bands the accounting service enforces, and 1100 / 1110 line up with the
 *  codes the Cash and Bank screens look for. */
const IAS_7_TEMPLATE: ChartOfAccountsTemplate = {
  id: 'ias-7',
  name: 'IAS 7 — Statement of Cash Flows',
  description:
    'Accounts organised around the IAS 7 cash flow sections, each pre-tagged as operating, investing, financing or non-cash.',
  classifications: [
    {
      code: '1100',
      name: 'Current Assets',
      category: 'ASSET',
      groups: [
        {
          code: '1110',
          name: 'Cash & Cash Equivalents',
          accounts: [
            account('1111', 'Petty Cash', 'CASH_EQUIVALENT', 'Unrestricted physical cash on hand'),
            account(
              '1112',
              'Main Operating Bank Account',
              'CASH_EQUIVALENT',
              'Primary operational checking account',
            ),
            account(
              '1113',
              'Foreign Currency Bank Accounts',
              'CASH_EQUIVALENT',
              'Subject to unrealized exchange rate effects',
            ),
            account(
              '1114',
              'Short-Term Money Market Deposits',
              'CASH_EQUIVALENT',
              'Highly liquid, original maturity <= 3 months',
            ),
          ],
        },
        {
          code: '1120',
          name: 'Trade Receivables',
          accounts: [
            account(
              '1121',
              'Accounts Receivable (Trade)',
              'OPERATING',
              'Outflow when increasing, inflow when decreasing',
            ),
            account(
              '1122',
              'Allowance for Doubtful Accounts / ECL',
              'EXCLUDED',
              'Contra account for the bad debt provision; non-cash, so left out of the statement',
            ),
          ],
        },
        {
          code: '1130',
          name: 'Inventories',
          accounts: [
            account(
              '1131',
              'Inventory - Raw Materials & Finished Goods',
              'OPERATING',
              'Outflow when increasing, inflow when decreasing',
            ),
          ],
        },
        {
          code: '1140',
          name: 'Other Current Assets',
          accounts: [
            account(
              '1141',
              'Prepaid Expenses & Operating Deposits',
              'OPERATING',
              'Outflow when increasing, inflow when decreasing',
            ),
          ],
        },
      ],
    },
    {
      code: '1200',
      name: 'Non-Current Assets',
      category: 'ASSET',
      accounts: [
        account(
          '1201',
          'Property, Plant & Equipment (PPE)',
          'INVESTING',
          'Cash paid for capital purchases or received from sales',
        ),
        account(
          '1202',
          'Intangible Assets & Software',
          'INVESTING',
          'Capitalized software and intangible development',
        ),
        account(
          '1203',
          'Investment Property',
          'INVESTING',
          'Property held for capital appreciation or rental income',
        ),
        account(
          '1205',
          'Accumulated Depreciation & Amortization',
          'EXCLUDED',
          'Contra account for depreciation; non-cash, so left out of the statement',
        ),
        account(
          '1204',
          'Long-Term Loans Granted to Third Parties',
          'INVESTING',
          'Cash outflows from loans issued / inflows from collection',
        ),
      ],
    },
    {
      code: '2100',
      name: 'Current Liabilities',
      category: 'LIABILITY',
      accounts: [
        account(
          '2101',
          'Bank Overdrafts (Repayable on demand)',
          'CASH_EQUIVALENT',
          'Included in cash equivalents if integral to cash management',
        ),
      ],
      groups: [
        {
          code: '2110',
          name: 'Trade and Other Payables',
          accounts: [
            account(
              '2111',
              'Accounts Payable (Trade)',
              'OPERATING',
              'Inflow when increasing, outflow when decreasing',
            ),
            account(
              '2112',
              'Accrued Expenses & Operating Liabilities',
              'OPERATING',
              'Inflow when increasing, outflow when decreasing',
            ),
          ],
        },
        {
          code: '2120',
          name: 'Current Tax Liabilities',
          accounts: [
            account(
              '2121',
              'Current Income Tax Payable',
              'OPERATING',
              'Separately disclosed under operating activities',
            ),
          ],
        },
        {
          code: '2130',
          name: 'Borrowings',
          accounts: [
            account('2131', 'Short-Term Bank Loans', 'FINANCING', 'Short-term debt financing'),
          ],
        },
      ],
    },
    {
      code: '2200',
      name: 'Non-Current Liabilities',
      category: 'LIABILITY',
      accounts: [
        account(
          '2201',
          'Lease Liabilities (IFRS 16)',
          'FINANCING',
          'Principal portion of lease payments',
        ),
      ],
      groups: [
        {
          code: '2210',
          name: 'Long-Term Borrowings',
          accounts: [
            account(
              '2211',
              'Long-Term Corporate Debt / Bonds',
              'FINANCING',
              'Long-term debt issuances and principal repayments',
            ),
          ],
        },
      ],
    },
    {
      code: '3100',
      name: 'Equity',
      category: 'EQUITY',
      groups: [
        {
          code: '3110',
          name: 'Issued Capital',
          accounts: [
            account(
              '3111',
              'Share Capital / Ordinary Shares',
              'FINANCING',
              'Proceeds from issuing share capital',
            ),
            account(
              '3112',
              'Share Premium',
              'FINANCING',
              'Capital received above nominal share value',
            ),
          ],
        },
        {
          code: '3120',
          name: 'Retained Earnings',
          accounts: [
            account('3121', 'Dividends Paid', 'FINANCING', 'Cash paid to company shareholders'),
          ],
        },
      ],
    },
    {
      code: '4100',
      name: 'Other Income',
      category: 'REVENUE',
      groups: [
        {
          code: '4110',
          name: 'Other Gains & Losses',
          accounts: [
            account(
              '4111',
              'Gain on Disposal of Assets',
              'EXCLUDED',
              'Deduct gains / add back losses (investing item)',
            ),
          ],
        },
        {
          code: '4120',
          name: 'Finance Income',
          accounts: [
            account(
              '4121',
              'Interest Received',
              'INVESTING',
              'Operating or Investing depending on accounting policy',
            ),
            account(
              '4122',
              'Dividend Income Received',
              'INVESTING',
              'Inflows from equity investments',
            ),
          ],
        },
      ],
    },
    {
      code: '5100',
      name: 'Operating Expenses',
      category: 'EXPENSE',
      accounts: [
        account(
          '5101',
          'Depreciation & Amortization Expense',
          'EXCLUDED',
          'Added back to Profit Before Tax',
        ),
        account(
          '5102',
          'Provision for Bad Debts / ECL',
          'EXCLUDED',
          'Non-cash operating expense reversal',
        ),
      ],
    },
    {
      code: '5200',
      name: 'Other Expense',
      category: 'EXPENSE',
      groups: [
        {
          code: '5210',
          name: 'Other Gains & Losses',
          accounts: [
            account(
              '5211',
              'Loss on Disposal of Assets',
              'EXCLUDED',
              'Deduct gains / add back losses (investing item)',
            ),
          ],
        },
      ],
    },
    {
      code: '5300',
      name: 'Financing Costs',
      category: 'EXPENSE',
      accounts: [
        account(
          '5301',
          'Interest Expense Paid',
          'FINANCING',
          'Operating or Financing depending on accounting policy',
        ),
      ],
    },
  ],
};

export const CHART_OF_ACCOUNTS_TEMPLATES: ChartOfAccountsTemplate[] = [IAS_7_TEMPLATE];

export function templateCounts(template: ChartOfAccountsTemplate) {
  let groups = 0;
  let accounts = 0;
  for (const c of template.classifications) {
    accounts += c.accounts?.length ?? 0;
    for (const g of c.groups ?? []) {
      groups += 1;
      accounts += g.accounts.length;
    }
  }
  return { classifications: template.classifications.length, groups, accounts };
}

/** Flattens a template into the bulk-import payload, leaving out anything whose code the tenant
 *  already has so applying a template never collides with (or overwrites) existing records. */
export function buildTemplatePayload(
  template: ChartOfAccountsTemplate,
  existing: { classifications: string[]; groups: string[]; accounts: string[] },
): BulkImportAccountsPayload {
  const taken = {
    classifications: new Set(existing.classifications.map((c) => c.trim().toLowerCase())),
    groups: new Set(existing.groups.map((c) => c.trim().toLowerCase())),
    accounts: new Set(existing.accounts.map((c) => c.trim().toLowerCase())),
  };
  const payload: BulkImportAccountsPayload = { classifications: [], groups: [], accounts: [] };

  for (const c of template.classifications) {
    if (!taken.classifications.has(c.code)) {
      payload.classifications.push({ code: c.code, name: c.name, category: c.category });
    }
    const push = (a: TemplateAccount, parentAccountCode?: string) => {
      if (taken.accounts.has(a.code)) return;
      payload.accounts.push({
        code: a.code,
        name: a.name,
        category: c.category,
        classificationCode: c.code,
        parentAccountCode,
        description: a.description,
        cashFlowCategory: a.cashFlowCategory,
      });
    };
    c.accounts?.forEach((a) => push(a));
    for (const g of c.groups ?? []) {
      if (!taken.groups.has(g.code)) {
        payload.groups.push({ code: g.code, name: g.name, classificationCode: c.code });
      }
      g.accounts.forEach((a) => push(a, g.code));
    }
  }
  return payload;
}
