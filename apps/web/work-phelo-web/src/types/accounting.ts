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
}
