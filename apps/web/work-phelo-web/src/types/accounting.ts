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

export interface GLAccountLedgerEntry {
  id: string;
  description: string | null;
  baseDebit: string;
  baseCredit: string;
  runningBalance: string;
  subledgerAccount: { id: string; code: string; name: string } | null;
  journalEntry: {
    journalNumber: string;
    transactionDate: string;
    reference: string | null;
    description: string;
    baseCurrency: string;
  };
}

export interface GLAccountLedger {
  entries: GLAccountLedgerEntry[];
  closingBalance: string;
}

export interface FinancialReportAccount {
  id: string;
  code: string;
  name: string;
  category: GLAccountCategory;
  normalBalance?: NormalBalance;
  classification: { id: string | null; code: string; name: string; category: GLAccountCategory };
  accountGroup: { id: string | null; code: string; name: string };
}

export interface GeneralLedgerReport {
  openingBalance: string;
  totalDebit: string;
  totalCredit: string;
  closingBalance: string;
  lines: Array<{
    id: string;
    journalDate: string;
    postingDate: string | null;
    journalNumber: string;
    journalStatus: JournalRecordStatus;
    description: string | null;
    account: FinancialReportAccount;
    debit: string;
    credit: string;
    runningBalance: string;
    transactionCurrency: string;
  }>;
}

export interface TrialBalanceReport {
  asOfDate: string;
  accounts: Record<
    GLAccountCategory,
    Array<{
      account: FinancialReportAccount;
      debitBalance: string;
      creditBalance: string;
    }>
  >;
  totalDebit: string;
  totalCredit: string;
  imbalanceAmount: string;
}

export interface IncomeStatementReport {
  fromDate: string;
  toDate: string;
  revenueAccounts: Array<{ account: FinancialReportAccount; amount: string }>;
  expenseAccounts: Array<{ account: FinancialReportAccount; amount: string }>;
  totalRevenue: string;
  totalExpenses: string;
  netProfitOrLoss: string;
}

export interface BalanceSheetReport {
  asOfDate: string;
  assets: Array<{ account: FinancialReportAccount; amount: string }>;
  liabilities: Array<{ account: FinancialReportAccount; amount: string }>;
  equity: Array<{ account: FinancialReportAccount; amount: string }>;
  totalAssets: string;
  totalLiabilities: string;
  totalEquity: string;
  imbalanceAmount: string;
}

export interface QueryGLAccountsParams {
  category?: GLAccountCategory;
  status?: GLAccountStatus;
}

export type CostCentreStatus = 'ACTIVE' | 'INACTIVE';

export interface CostCentre {
  id: string;
  code: string;
  name: string;
  description: string | null;
  externalRef: string | null;
  status: CostCentreStatus;
}

export interface CreateCostCentrePayload {
  code: string;
  name: string;
  description?: string;
  externalRef?: string;
}

export type UpdateCostCentrePayload = Partial<CreateCostCentrePayload>;

export type TransactionTypeCategory = 'NEUTRAL' | 'RECEIVABLE' | 'PAYABLE' | 'NONE';

export interface TransactionTypeDefinition {
  id: string;
  name: string;
  code: string;
  category: TransactionTypeCategory;
  businessRoles: string[];
  allowedDocument: string | null;
  source: string | null;
  description: string | null;
  rulesCount: number;
}

export interface CreateTransactionTypePayload {
  name: string;
  code: string;
  category: TransactionTypeCategory;
  businessRoles?: string[];
  allowedDocument?: string;
  source?: string;
  description?: string;
}

export type UpdateTransactionTypePayload = Partial<CreateTransactionTypePayload>;

export interface SourceTypeDefinition {
  id: string;
  name: string;
  description: string | null;
}

export interface CreateSourceTypePayload {
  name: string;
  description?: string;
}

export type UpdateSourceTypePayload = Partial<CreateSourceTypePayload>;

export interface TaxType {
  id: string;
  code: string;
  name: string;
  rate: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  isActive: boolean;
}

export interface CreateTaxTypePayload {
  code: string;
  name: string;
  rate: number;
  effectiveFrom: string;
  effectiveTo?: string;
}

export type UpdateTaxTypePayload = Partial<CreateTaxTypePayload> & { isActive?: boolean };

export type PostingLineDirection = 'DR' | 'CR';

export interface TransactionTypeRuleLine {
  id: string;
  sequence: number;
  direction: PostingLineDirection;
  account: { id: string; code: string; name: string };
  /** Set only on a tax line — which TaxType drives this line's computed amount. */
  taxType: { id: string; name: string; rate: number } | null;
  /** Set only when this line also posts to a party's subledger account under the
   *  (fixed) account above, rather than the account alone. */
  subledgerType: SubledgerType | null;
  description: string | null;
}

export interface TransactionTypeRule {
  id: string;
  transactionTypeId: string;
  description: string | null;
  lines: TransactionTypeRuleLine[];
}

export interface TransactionTypeRuleLineInput {
  direction: PostingLineDirection;
  accountId: string;
  taxTypeId?: string;
  subledgerType?: SubledgerType;
  description?: string;
}

export interface CreateTransactionTypeRulePayload {
  transactionTypeId: string;
  description?: string;
  lines: TransactionTypeRuleLineInput[];
}

export interface UpdateTransactionTypeRulePayload {
  description?: string;
  lines?: TransactionTypeRuleLineInput[];
}

export type FiscalPeriodStatus = 'OPEN' | 'SOFT_CLOSED' | 'CLOSED';

export interface FiscalPeriod {
  id: string;
  /** Human label for the monthly period, e.g. "January 2026". */
  name: string;
  /** Calendar year the period belongs to; groups the 12 monthly rows. */
  year: number;
  startDate: string;
  endDate: string;
  status: FiscalPeriodStatus;
}

export interface CreateFiscalPeriodPayload {
  name: string;
  startDate: string;
  endDate: string;
}

/**
 * Payload for the (not-yet-built) backend endpoint that generates the twelve
 * monthly periods for a fiscal year in one call.
 */
export interface GenerateFiscalYearPayload {
  year: number;
}

export interface QueryFiscalPeriodsParams {
  status?: FiscalPeriodStatus;
}

export interface AccountTypeDefinition {
  id: string;
  name: string;
  description: string | null;
}

export interface AccountCategoryDefinition {
  code: GLAccountCategory;
  name: string;
  normalBalance: NormalBalance;
  financialStatement: 'BALANCE_SHEET' | 'INCOME_STATEMENT';
  displayOrder: number;
}

export interface JournalLine {
  targetAccount: string;
  subledgerAccountId: string;
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
  lines: [
    { targetAccount: '', subledgerAccountId: '', description: '', debit: '', credit: '' },
    { targetAccount: '', subledgerAccountId: '', description: '', debit: '', credit: '' },
  ],
};

export type JournalRecordStatus = 'DRAFT' | 'POSTED' | 'REVERSED';

export type SourceEventStatus = 'RECEIVED' | 'PROCESSING' | 'POSTED' | 'FAILED' | 'IGNORED';

export interface SourceEventInboxItem {
  id: string;
  sourceModule: string;
  sourceEventType: string;
  sourceRecordId: string;
  sourceDocumentId: string | null;
  idempotencyKey: string;
  status: SourceEventStatus;
  failureReason: string | null;
  retryCount: number;
  createdAt: string;
  processedAt: string | null;
  postingRule: {
    id: string;
    name: string;
    sourceModule: string;
    sourceEventType: string;
    version: number;
  } | null;
  journalEntry: {
    id: string;
    journalNumber: string;
    status: JournalRecordStatus;
    transactionDate: string;
    transactionCurrency: string;
    baseCurrency: string;
    postedAt: string | null;
  } | null;
  cashbookTransaction: {
    id: string;
    status: JournalRecordStatus;
    transactionType: string;
    direction: string;
    amount: string;
    currency: string;
    cashAccountId: string;
    postedJournalEntryId: string | null;
  } | null;
}

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

export interface InvoiceLine {
  description: string;
  unitPrice: number | '';
  quantity: number | '';
}

export interface InvoiceFormValues {
  vendor: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  description: string;
  /** The Receivable/Payable Transaction Type driving this invoice/bill — its Rule
   *  resolves the offset account and any tax lines, replacing manual GL entry. */
  transactionTypeId: string;
  /** Which of the Rule's Deduction (tax) lines to apply, by TaxType id. */
  selectedTaxTypeIds: string[];
  lines: InvoiceLine[];
}

export const INVOICE_DEFAULTS: InvoiceFormValues = {
  vendor: '',
  invoiceNumber: '',
  invoiceDate: '',
  dueDate: '',
  currency: '',
  description: '',
  transactionTypeId: '',
  selectedTaxTypeIds: [],
  lines: [{ description: '', unitPrice: '', quantity: '' }],
};

export type AccountingTradeSide = 'RECEIVABLE' | 'PAYABLE';
export type AccountingTradeDocumentStatus = 'DRAFT' | 'POSTED' | 'REVERSED';
export type AccountingTradeDocumentKind = 'INVOICE' | 'CREDIT_NOTE' | 'BILL';
export type AccountingTradeDocumentPaymentState =
  'DRAFT' | 'REVERSED' | 'PAID' | 'PARTIALLY_PAID' | 'OPEN';

export interface AccountingTradePartyRef {
  id: string;
  code: string;
  name: string;
  currency: string;
}

interface AccountingTradeGLAccountRef {
  id: string;
  code: string;
  name: string;
}

interface AccountingTradeJournalRef {
  id: string;
  journalNumber: string;
  status: string;
  postedAt: string | null;
}

interface AccountingTradeOriginalDocumentRef {
  id: string;
  documentNumber: string;
  totalAmount: string;
  status: string;
}

export interface AccountingTradeDocument {
  id: string;
  side: AccountingTradeSide;
  documentType: AccountingTradeDocumentKind;
  documentNumber: string;
  documentDate: string;
  dueDate: string | null;
  currency: string;
  exchangeRate: string | null;
  subtotalAmount: string;
  taxAmount: string;
  totalAmount: string;
  description: string | null;
  externalReference: string | null;
  sourceModule: string | null;
  sourceRecordId: string | null;
  offsetGlAccountId: string;
  /** The Transaction Type that drove this document's rule-based posting, if any —
   *  a plain audit trail, null for credit notes and pre-existing documents. */
  transactionTypeId: string | null;
  originalDocumentId: string | null;
  status: AccountingTradeDocumentStatus;
  createdAt: string;
  updatedAt: string;
  postedAt: string | null;
  reversedAt: string | null;
  postedJournalEntryId: string | null;
  reversalJournalEntryId: string | null;
  reversalOfDocumentId: string | null;
  party: AccountingTradePartyRef;
  offsetGlAccount: AccountingTradeGLAccountRef;
  postedJournalEntry: AccountingTradeJournalRef | null;
  reversalJournalEntry: AccountingTradeJournalRef | null;
  originalDocument: AccountingTradeOriginalDocumentRef | null;
}

export interface QueryTradeDocumentsParams {
  partyId?: string;
  status?: AccountingTradeDocumentStatus;
  currency?: string;
  fromDate?: string;
  toDate?: string;
  dueFrom?: string;
  dueTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateTradeInvoicePayload {
  partyId: string;
  documentDate: string;
  dueDate?: string;
  currency: string;
  /** The subtotal, before any tax lines the rule adds on top. */
  amount: number;
  exchangeRate?: number;
  /** The Receivable/Payable-category Transaction Type driving this document — its
   *  Rule resolves the offset account and any tax lines. A Rule must exist for it. */
  transactionTypeId: string;
  /** Which of the Rule's Deduction (tax) lines to apply, by TaxType id. */
  selectedTaxTypeIds?: string[];
  description?: string;
  externalReference?: string;
}

export interface ReverseTradeDocumentPayload {
  reversalDate: string;
  reason: string;
}

export interface AccountingTradeDocumentBalance {
  currency: string;
  originalAmount: string;
  appliedSettlements: string;
  appliedCreditNotes: string;
  outstandingAmount: string;
  paymentState: AccountingTradeDocumentPaymentState;
}

export interface AccountingCurrencyTotal {
  currency: string;
  amount: string;
}

export interface AccountsReceivableSummary {
  outstandingByCurrency: AccountingCurrencyTotal[];
  overdueInvoices: number;
  dueThisWeek: number;
  collectedMtdByCurrency: AccountingCurrencyTotal[];
}

export interface AccountsPayableSummary {
  outstandingByCurrency: AccountingCurrencyTotal[];
  overdueInvoices: number;
  dueThisWeek: number;
  pendingApproval: number;
  paidMtdByCurrency: AccountingCurrencyTotal[];
}

export interface CreateTradeCreditNotePayload {
  partyId: string;
  documentDate: string;
  currency: string;
  amount: number;
  offsetGlAccountId: string;
  /** Posts to the AR (Receivable) or AP (Payable) account, whichever this side is —
   *  manually picked here since credit notes are not yet Rule-driven. */
  controlAccountId: string;
  originalDocumentId?: string;
  description?: string;
  externalReference?: string;
}

export interface AccountingTradeSettlement {
  id: string;
  side: AccountingTradeSide;
  settlementNumber: string;
  settlementDate: string;
  currency: string;
  amount: string;
  exchangeRate: string | null;
  reference: string | null;
  description: string | null;
  externalReference: string | null;
  sourceModule: string | null;
  sourceRecordId: string | null;
  status: AccountingTradeDocumentStatus;
  createdAt: string;
  updatedAt: string;
  postedAt: string | null;
  reversedAt: string | null;
  reversalOfSettlementId: string | null;
  party: AccountingTradePartyRef;
  cashbookTransaction: {
    id: string;
    status: string;
    reference: string | null;
    postedJournalEntryId: string | null;
    reversalJournalEntryId: string | null;
  };
}

export interface QueryTradeSettlementsParams {
  partyId?: string;
  cashAccountId?: string;
  status?: AccountingTradeDocumentStatus;
  currency?: string;
  fromDate?: string;
  toDate?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateTradeSettlementPayload {
  partyId: string;
  /** The posted invoice/bill this settlement is being recorded to pay. The settlement
   *  inherits that document's own resolved AR/AP account. */
  documentId: string;
  cashAccountId: string;
  amount: number;
  currency: string;
  settlementDate: string;
  settlementMethod: AccountingCashbookSettlementMethod;
  reference?: string;
  description?: string;
  exchangeRate?: number;
}

export type AccountingTradeAllocationSource = 'RECEIPT' | 'PAYMENT' | 'CREDIT_NOTE';

export interface AccountingTradeAllocation {
  id: string;
  amount: string;
  currency: string;
  allocatedAt: string;
  sourceType: AccountingTradeAllocationSource;
  reversedAt: string | null;
  reversalReason: string | null;
  document: { id: string; documentNumber: string; totalAmount: string };
}

export interface CreateTradeAllocationPayload {
  documentId: string;
  amount: number;
}

export interface ReverseTradeAllocationPayload {
  reason: string;
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

export interface CreateCashAccountPayload {
  name: string;
  accountKind: AccountingCashAccountKind;
  currency: string;
  glAccountId: string;
  bankName?: string;
  accountNumber?: string;
  branch?: string;
  description?: string;
}

export interface UpdateCashAccountPayload extends Partial<CreateCashAccountPayload> {
  isActive?: boolean;
}

export type CashbookTransactionType = 'RECEIPT' | 'PAYMENT' | 'TRANSFER' | 'CHARGE' | 'ADJUSTMENT';
export type CashbookDirection = 'INFLOW' | 'OUTFLOW' | 'TRANSFER';
export type CashbookTransactionStatus = 'DRAFT' | 'POSTED' | 'REVERSED';
export type AccountingCashbookSettlementMethod =
  'BANK_TRANSFER' | 'CHEQUE' | 'CASH' | 'MOBILE_MONEY' | 'INTERNAL_TRANSFER' | 'JOURNAL' | 'OTHER';

export interface CashbookAccountRef {
  id: string;
  name: string;
  accountKind: AccountingCashAccountKind;
  currency: string;
  glAccountId: string;
  glAccount: { id: string; code: string; name: string };
}

interface CashbookGLAccountRef {
  id: string;
  code: string;
  name: string;
}

interface CashbookJournalRef {
  id: string;
  journalNumber: string;
  status: string;
  postedAt: string | null;
}

interface CashbookTransactionRef {
  id: string;
  reference: string | null;
  status: string;
}

export interface CashbookTransaction {
  id: string;
  cashAccountId: string;
  destinationCashAccountId: string | null;
  transactionType: CashbookTransactionType;
  direction: CashbookDirection;
  amount: string;
  currency: string;
  transactionDate: string;
  settlementMethod: AccountingCashbookSettlementMethod;
  reference: string | null;
  counterpartyType: string | null;
  counterpartyId: string | null;
  externalReference: string | null;
  description: string;
  offsetGlAccountId: string | null;
  offsetSubledgerAccountId: string | null;
  sourceEventInboxId: string | null;
  sourceModule: string | null;
  sourceEventType: string | null;
  sourceRecordId: string | null;
  sourceReference: string | null;
  exchangeRate: string | null;
  status: CashbookTransactionStatus;
  createdByUserId: string;
  updatedByUserId: string;
  postedByUserId: string | null;
  reversedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
  postedAt: string | null;
  reversedAt: string | null;
  postedJournalEntryId: string | null;
  reversalJournalEntryId: string | null;
  reversalOfTransactionId: string | null;
  cashAccount: CashbookAccountRef;
  destinationCashAccount: CashbookAccountRef | null;
  offsetGlAccount: CashbookGLAccountRef | null;
  offsetSubledgerAccount: (CashbookGLAccountRef & { type: string }) | null;
  postedJournalEntry: CashbookJournalRef | null;
  reversalJournalEntry: CashbookJournalRef | null;
  reversalOfTransaction: CashbookTransactionRef | null;
  reversalTransaction: CashbookTransactionRef | null;
}

export interface QueryCashbookParams {
  cashAccountId?: string;
  transactionType?: CashbookTransactionType;
  status?: CashbookTransactionStatus;
  currency?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface CreateCashbookEntryPayload {
  cashAccountId: string;
  amount: number;
  currency: string;
  transactionDate: string;
  settlementMethod: AccountingCashbookSettlementMethod;
  reference?: string;
  counterpartyType?: string;
  counterpartyId?: string;
  externalReference?: string;
  description: string;
  offsetGlAccountId: string;
  offsetSubledgerAccountId?: string;
  exchangeRate?: number;
}

export interface CreateCashbookAdjustmentPayload extends CreateCashbookEntryPayload {
  direction: 'INFLOW' | 'OUTFLOW';
}

export interface CreateCashbookTransferPayload {
  cashAccountId: string;
  destinationCashAccountId: string;
  amount: number;
  currency: string;
  transactionDate: string;
  exchangeRate?: number;
  reference?: string;
  description: string;
}

export interface ReverseCashbookTransactionPayload {
  reversalDate: string;
  reason: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type SubledgerType =
  'CUSTOMER' | 'VENDOR' | 'CEDANT' | 'REINSURER' | 'EMPLOYEE' | 'STATUTORY' | 'OTHER';

export const MANUAL_SUBLEDGER_TYPES: SubledgerType[] = [
  'CUSTOMER',
  'VENDOR',
  'EMPLOYEE',
  'STATUTORY',
  'OTHER',
];

export const SUBLEDGER_TYPE_LABELS: Record<SubledgerType, string> = {
  CUSTOMER: 'Customer',
  VENDOR: 'Vendor',
  CEDANT: 'Cedant',
  REINSURER: 'Reinsurer',
  EMPLOYEE: 'Employee',
  STATUTORY: 'Statutory',
  OTHER: 'Other',
};

export interface EntityType {
  id: string;
  name: string;
  isSystem: boolean;
  entityCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEntityTypePayload {
  name: string;
}

export type UpdateEntityTypePayload = Partial<CreateEntityTypePayload>;

export interface SubledgerAccount {
  id: string;
  code: string;
  name: string;
  /** Any name from the tenant's own Entity Types list — not the fixed SubledgerType enum. */
  type: string;
  externalRef: string | null;
  /** No entity needs one — which GL account a document affects is decided by the
   *  Transaction Type Rule used to create it, not anything fixed on the entity. Only ever
   *  set as an explicit, optional override. */
  controlAccountId: string | null;
  controlAccount: {
    id: string;
    code: string;
    name: string;
    category: GLAccountCategory;
    normalBalance: NormalBalance;
  } | null;
  currency: string | null;
  contactName: string | null;
  address: string | null;
  status: GLAccountStatus;
  balance: AccountingSubledgerBalance;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSubledgerAccountPayload {
  code: string;
  name: string;
  /** Any name from the tenant's own Entity Types list — not the fixed SubledgerType enum. */
  type: string;
  externalRef?: string;
  /** Optional, explicit override only — not needed for normal use. */
  controlAccountId?: string;
  currency?: string;
  contactName?: string;
  address?: string;
}

export type UpdateSubledgerAccountPayload = Partial<CreateSubledgerAccountPayload>;

export interface QuerySubledgerAccountsParams {
  type?: string;
  externalRef?: string;
  controlAccountId?: string;
  status?: GLAccountStatus;
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
  isConfigured?: boolean;
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

export type AgingBucket = 'CURRENT' | '1_30' | '31_60' | '61_90' | 'OVER_90';

export interface AccountingAgingCurrencyTotal extends Record<AgingBucket, string> {
  currency: string;
}

export interface AccountingOpenItem {
  id: string;
  documentNumber: string;
  documentDate: string;
  dueDate: string | null;
  currency: string;
  totalAmount: string;
  outstandingAmount: string;
}

export interface AccountingAgingReport {
  agingByCurrency: AccountingAgingCurrencyTotal[];
}

export interface AccountingPartyStatement extends AccountingAgingReport {
  asOfDate: string;
  documents: AccountingOpenItem[];
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

export type BudgetPeriod = 'MONTHLY' | 'QUARTERLY' | 'YEARLY';

export type BudgetStatus = 'DRAFT' | 'ACTIVE' | 'CLOSED';

/**
 * Which side of the chart of accounts a budget targets. Drives which leaf accounts are
 * offered as budget lines: EXPENSE → expense-classification accounts, INCOME →
 * revenue-classification accounts, BOTH → both.
 */
export type BudgetScope = 'EXPENSE' | 'INCOME' | 'BOTH';

export interface BudgetLineInput {
  accountId: string;
  amount: number;
}

export interface CreateBudgetPayload {
  name: string;
  period: BudgetPeriod;
  /** ISO YYYY-MM-DD — first day the budget takes effect. */
  startDate: string;
  scope: BudgetScope;
  lines: BudgetLineInput[];
}

/** A single account's target within a budget, with actuals rolled up from posted GL activity. */
export interface BudgetLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  category: GLAccountCategory;
  budgeted: number;
  /** Posted actual for the account over the budget window; null until the period has activity. */
  actual: number | null;
}

/** One row in the budgets list. */
export interface Budget {
  id: string;
  name: string;
  period: BudgetPeriod;
  scope: BudgetScope;
  /** ISO YYYY-MM-DD — inclusive window derived from period + start. */
  startDate: string;
  endDate: string;
  currency: string;
  incomeBudgeted: number;
  expenseBudgeted: number;
  /** incomeBudgeted − expenseBudgeted. */
  netAmount: number;
  status: BudgetStatus;
  createdAt: string;
  updatedAt: string;
}

/** Budget row plus its per-account lines — the details-page payload. */
export interface BudgetDetail extends Budget {
  lines: BudgetLine[];
}

export type PostingRuleDirection = 'DR' | 'CR';
export type PostingRuleSubledgerType = SubledgerType;

export interface PostingRuleLine {
  id: string;
  sequence: number;
  direction: PostingRuleDirection;
  glAccountId: string;
  subledgerType: PostingRuleSubledgerType | null;
  subledgerExternalRefSource: string | null;
  amountSource: string;
  currencySource: string;
  descriptionTemplate: string;
  glAccount: { id: string; code: string; name: string; status: string };
}

export interface PostingRule {
  id: string;
  name: string;
  sourceModule: string;
  sourceEventType: string;
  version: number;
  active: boolean;
  effectiveFrom: string;
  effectiveTo: string | null;
  createdAt: string;
  updatedAt: string;
  lines: PostingRuleLine[];
}

export interface QueryPostingRulesParams {
  sourceModule?: string;
  sourceEventType?: string;
  active?: boolean;
}

export interface PostingRuleLineInput {
  sequence: number;
  direction: PostingRuleDirection;
  glAccountId: string;
  subledgerType?: PostingRuleSubledgerType;
  subledgerExternalRefSource?: string;
  amountSource: string;
  currencySource: string;
  descriptionTemplate: string;
}

export interface CreatePostingRulePayload {
  name: string;
  sourceModule: string;
  sourceEventType: string;
  version: number;
  active?: boolean;
  effectiveFrom: string;
  effectiveTo?: string;
  lines?: PostingRuleLineInput[];
}

export interface UpdatePostingRulePayload {
  name?: string;
  active?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
}

export type CreatePostingRuleLinePayload = PostingRuleLineInput;
export type UpdatePostingRuleLinePayload = Partial<PostingRuleLineInput>;
