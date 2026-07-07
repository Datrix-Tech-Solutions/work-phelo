export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
export type AccountStatus = 'Active' | 'Inactive';

export interface ChartOfAccount {
  id: string;
  accountCode: string;
  accountName: string;
  type: AccountType;
  parentAccount: string | null;
  currency: string;
  status: AccountStatus;
  description: string | null;
}

export type GLAccountCategory = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type NormalBalance = 'DEBIT' | 'CREDIT';
export type GLAccountStatus = 'ACTIVE' | 'INACTIVE';

export interface GLAccount {
  id: string;
  code: string;
  name: string;
  category: GLAccountCategory;
  normalBalance: NormalBalance;
  parentAccountId: string | null;
  parentAccount: { id: string; code: string; name: string } | null;
  allowPosting: boolean;
  description: string | null;
  status: GLAccountStatus;
}

export interface CreateGLAccountPayload {
  code: string;
  name: string;
  category: GLAccountCategory;
  normalBalance: NormalBalance;
  parentAccountId?: string;
  allowPosting?: boolean;
  description?: string;
}

export type UpdateGLAccountPayload = Partial<CreateGLAccountPayload>;

export interface QueryGLAccountsParams {
  category?: GLAccountCategory;
  status?: GLAccountStatus;
}

export type FiscalPeriodStatus = 'OPEN' | 'CLOSED' | 'LOCKED';

export interface FiscalPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: FiscalPeriodStatus;
}

export interface CreateFiscalPeriodPayload {
  name: string;
  startDate: string;
  endDate: string;
}

export interface QueryFiscalPeriodsParams {
  status?: FiscalPeriodStatus;
}

export interface AccountTypeDefinition {
  id: string;
  name: string;
  description: string | null;
}

export type JournalEntryStatus = 'Draft' | 'Posted' | 'Reversed' | 'Void';

export interface JournalLine {
  targetAccount: string;
  description: string;
  debit: number | '';
  credit: number | '';
}

export interface JournalEntryFormValues {
  transactionDate: string;
  currency: string;
  reference: string;
  description: string;
  lines: JournalLine[];
}

export const JOURNAL_ENTRY_DEFAULTS: JournalEntryFormValues = {
  transactionDate: '',
  currency: '',
  reference: '',
  description: '',
  lines: [{ targetAccount: '', description: '', debit: '', credit: '' }],
};

export interface JournalEntry {
  id: string;
  refNo: string;
  date: string;
  currency: string;
  debitTotal: number;
  creditTotal: number;
  createdBy: string;
  status: JournalEntryStatus;
}

export type InvoiceStatus = 'Draft' | 'Pending Approval' | 'Approved' | 'Paid' | 'Overdue' | 'Void';

export interface InvoiceLine {
  description: string;
  glAccount: string;
  unitPrice: number | '';
  quantity: number | '';
  tax: number | '';
}

export interface InvoiceFormValues {
  vendor: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  description: string;
  lines: InvoiceLine[];
}

export const INVOICE_DEFAULTS: InvoiceFormValues = {
  vendor: '',
  invoiceNumber: '',
  invoiceDate: '',
  dueDate: '',
  currency: '',
  description: '',
  lines: [{ description: '', glAccount: '', unitPrice: '', quantity: '', tax: '' }],
};

export interface AccountsReceivableInvoice {
  id: string;
  invoiceNumber: string;
  customer: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
}

export interface AccountsPayableInvoice {
  id: string;
  invoiceNumber: string;
  vendor: string;
  invoiceDate: string;
  dueDate: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
}

export interface AccountingContact {
  id: string;
  fullName: string;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
}

export type VendorStatus = 'Active' | 'Inactive';

export interface Vendor {
  id: string;
  vendorCode: string;
  vendorName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  outstandingBalance: number;
  currency: string;
  status: VendorStatus;
  contacts: AccountingContact[];
}

export interface AccountingCurrency {
  id: string;
  code: string;
  name: string;
  symbol: string | null;
  decimalPlaces: number;
  isActive: boolean;
}

export interface CreateAccountingCurrencyPayload {
  code: string;
  name: string;
  symbol?: string;
  decimalPlaces?: number;
}

export interface UpdateAccountingCurrencyPayload {
  code?: string;
  name?: string;
  symbol?: string;
  decimalPlaces?: number;
  isActive?: boolean;
}

export interface AccountingTenantConfig {
  baseCurrency: string | null;
  fiscalYearStartMonth: number;
  decimalPlaces: number;
}

export interface UpdateAccountingTenantConfigPayload {
  baseCurrency?: string;
  fiscalYearStartMonth?: number;
  decimalPlaces?: number;
}

export interface ExchangeRate {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  effectiveAt: string;
  isActive: boolean;
}

export interface CreateExchangeRatePayload {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  effectiveAt: string;
}

export interface UpdateExchangeRatePayload {
  rate?: number;
  effectiveAt?: string;
  isActive?: boolean;
}

export type AccountTransactionType = 'Credit' | 'Debit';

export interface AccountTransaction {
  id: string;
  date: string;
  description: string;
  reference: string;
  type: AccountTransactionType;
  debit: number | null;
  credit: number | null;
  balance: number;
  currency: string;
}

export interface BankAccount {
  id: string;
  accountName: string;
  accountType: string;
  bankName: string;
  bankCode: string;
  bankBranch: string;
  accountNumber: string;
  status: 'Active' | 'Inactive';
}

export interface CashBankAccount {
  id: string;
  accountCode: string;
  accountName: string;
  bankName: string;
  currency: string;
  bookBalance: number;
  lastReconciled: string | null;
}

export interface BudgetForecast {
  id: string;
  budgetName: string;
  department: string;
  fiscalYear: string;
  version: string;
  amount: number;
  actualSpend: number;
  currency: string;
}

export type CustomerStatus = 'Active' | 'Inactive';

export interface Customer {
  id: string;
  customerCode: string;
  customerName: string;
  contactPerson: string | null;
  email: string | null;
  phone: string | null;
  outstandingBalance: number;
  currency: string;
  status: CustomerStatus;
  contacts: AccountingContact[];
}
