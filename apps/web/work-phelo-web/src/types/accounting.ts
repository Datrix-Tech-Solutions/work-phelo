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
  accountGroupId: string | null;
  accountGroup: { id: string; code: string; name: string } | null;
  parentAccountId: string | null;
  parentAccount: { id: string; code: string; name: string } | null;
  allowPosting: boolean;
  description: string | null;
  status: GLAccountStatus;
}

export interface CreateGLAccountPayload {
  code: string;
  name: string;
  category?: GLAccountCategory;
  normalBalance?: NormalBalance;
  accountGroupId?: string;
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
  fiscalPeriodId: string;
  currency: string;
  exchangeRate: number | '';
  reference: string;
  description: string;
  lines: JournalLine[];
}

export const JOURNAL_ENTRY_DEFAULTS: JournalEntryFormValues = {
  transactionDate: '',
  fiscalPeriodId: '',
  currency: '',
  exchangeRate: '',
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

export type JournalRecordStatus = 'DRAFT' | 'POSTED' | 'REVERSED';

export interface JournalLineRecord {
  id: string;
  glAccountId: string;
  subledgerAccountId: string | null;
  costCentreId: string | null;
  description: string | null;
  transactionDebit: number;
  transactionCredit: number;
  baseDebit: number;
  baseCredit: number;
  glAccount: { id: string; code: string; name: string };
  subledgerAccount: { id: string; code: string; name: string } | null;
  costCentre: { id: string; code: string; name: string } | null;
}

export interface JournalEntryRecord {
  id: string;
  journalNumber: string;
  status: JournalRecordStatus;
  transactionDate: string;
  postingDate: string | null;
  fiscalPeriodId: string;
  transactionCurrency: string;
  baseCurrency: string;
  exchangeRate: string;
  reference: string | null;
  description: string;
  reversalOfJournalId: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  postedAt: string | null;
  reversedAt: string | null;
  lines: JournalLineRecord[];
}

export interface CreateJournalLinePayload {
  glAccountId: string;
  subledgerAccountId?: string;
  costCentreId?: string;
  description?: string;
  debit?: number;
  credit?: number;
}

export interface CreateJournalPayload {
  transactionDate: string;
  fiscalPeriodId: string;
  transactionCurrency: string;
  exchangeRate?: number;
  reference?: string;
  description: string;
  sourceModule?: string;
  sourceRecordType?: string;
  sourceRecordId?: string;
  lines: CreateJournalLinePayload[];
}

export type UpdateDraftJournalPayload = Partial<Omit<CreateJournalPayload, 'lines'>> & {
  lines?: CreateJournalLinePayload[];
};

export interface ReverseJournalPayload {
  reversalDate: string;
  reason: string;
}

export interface QueryJournalsParams {
  status?: JournalRecordStatus;
  from?: string;
  to?: string;
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

export interface AccountingSubledgerBalance {
  baseDebit: number;
  baseCredit: number;
  baseBalance: number;
  transactionDebit: number;
  transactionCredit: number;
  transactionBalance: number;
  transactionCurrencies: string[];
}

export interface AccountingSubledgerRef {
  id: string;
  code: string;
  name: string;
  status: string;
}

export type AccountingCashAccountKind = 'BANK' | 'CASH' | 'MOBILE_MONEY' | 'OTHER';

export interface AccountingCashAccount {
  id: string;
  name: string;
  accountKind: AccountingCashAccountKind;
  currency: string;
  glAccountId: string;
  bankName: string | null;
  accountNumber: string | null;
  branch: string | null;
  description: string | null;
  isActive: boolean;
  createdByUserId: string;
  updatedByUserId: string;
  createdAt: string;
  updatedAt: string;
  glAccount: {
    id: string;
    code: string;
    name: string;
    category: GLAccountCategory;
  };
}

export interface QueryCashAccountsParams {
  accountKind?: AccountingCashAccountKind;
  currency?: string;
  isActive?: boolean;
}

export interface QueryAccountingPartiesParams {
  search?: string;
  isActive?: boolean;
  currency?: string;
  sourceModule?: string;
  externalRef?: string;
  page?: number;
  limit?: number;
  sortBy?: 'code' | 'legalName' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AccountingVendor {
  id: string;
  code: string;
  legalName: string;
  tradingName: string | null;
  primaryContactName: string | null;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  countryCode: string | null;
  currency: string;
  paymentTermsDays: number;
  taxNumber: string | null;
  externalRef: string | null;
  sourceModule: string | null;
  defaultExpenseAccountId: string | null;
  notes: string | null;
  isActive: boolean;
  subledgerAccountId: string;
  subledgerAccount: AccountingSubledgerRef;
  balance: AccountingSubledgerBalance;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountingVendorPayload {
  code: string;
  legalName: string;
  tradingName?: string;
  primaryContactName?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  countryCode?: string;
  currency: string;
  paymentTermsDays?: number;
  taxNumber?: string;
  externalRef?: string;
  sourceModule?: string;
  defaultExpenseAccountId?: string;
  notes?: string;
}

export type UpdateAccountingVendorPayload = Partial<CreateAccountingVendorPayload> & {
  isActive?: boolean;
};

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

export interface AccountClassification {
  id: string;
  code: string;
  name: string;
  category: GLAccountCategory;
  displayOrder: number;
  isSystemTemplate: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountClassificationPayload {
  code: string;
  name: string;
  category: GLAccountCategory;
  displayOrder?: number;
  isSystemTemplate?: boolean;
}

export type UpdateAccountClassificationPayload = Partial<CreateAccountClassificationPayload> & {
  isActive?: boolean;
};

export interface QueryAccountHierarchyParams {
  category?: GLAccountCategory;
  isActive?: boolean;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: 'code' | 'name' | 'displayOrder' | 'createdAt' | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
}

export interface AccountGroup {
  id: string;
  code: string;
  name: string;
  classificationId: string;
  classification: {
    id: string;
    code: string;
    name: string;
    category: GLAccountCategory;
  };
  displayOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountGroupPayload {
  classificationId: string;
  code: string;
  name: string;
  displayOrder?: number;
}

export type UpdateAccountGroupPayload = Partial<CreateAccountGroupPayload> & {
  isActive?: boolean;
};

export interface QueryAccountGroupsParams extends QueryAccountHierarchyParams {
  classificationId?: string;
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

export interface AccountingCustomer {
  id: string;
  code: string;
  legalName: string;
  tradingName: string | null;
  primaryContactName: string | null;
  email: string | null;
  phone: string | null;
  billingAddress: string | null;
  countryCode: string | null;
  currency: string;
  paymentTermsDays: number;
  creditLimit: number | null;
  taxNumber: string | null;
  externalRef: string | null;
  sourceModule: string | null;
  notes: string | null;
  isActive: boolean;
  subledgerAccountId: string;
  subledgerAccount: AccountingSubledgerRef;
  balance: AccountingSubledgerBalance;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAccountingCustomerPayload {
  code: string;
  legalName: string;
  tradingName?: string;
  primaryContactName?: string;
  email?: string;
  phone?: string;
  billingAddress?: string;
  countryCode?: string;
  currency: string;
  paymentTermsDays?: number;
  creditLimit?: number;
  taxNumber?: string;
  externalRef?: string;
  sourceModule?: string;
  notes?: string;
}

export type UpdateAccountingCustomerPayload = Partial<CreateAccountingCustomerPayload> & {
  isActive?: boolean;
};
