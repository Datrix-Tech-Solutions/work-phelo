import type { AccountingTradeDocument, AccountingTradeDocumentStatus } from '@/types/accounting';

/** The printable documents a Transaction Type can be given (its "Allowed Document"). Each
 *  key has its own component — a Bill and an Invoice deliberately don't share one. */
export type AccountingDocumentKey = 'BILL' | 'INVOICE' | 'CREDIT_NOTE' | 'DEBIT_NOTE';

export const ACCOUNTING_DOCUMENT_OPTIONS: { value: AccountingDocumentKey; label: string }[] = [
  { value: 'BILL', label: 'Bill' },
  { value: 'INVOICE', label: 'Invoice' },
  { value: 'CREDIT_NOTE', label: 'Credit Note' },
  { value: 'DEBIT_NOTE', label: 'Debit Note' },
];

export function isAccountingDocumentKey(
  value: string | null | undefined,
): value is AccountingDocumentKey {
  return ACCOUNTING_DOCUMENT_OPTIONS.some((option) => option.value === value);
}

export function accountingDocumentLabel(key: AccountingDocumentKey): string {
  return ACCOUNTING_DOCUMENT_OPTIONS.find((option) => option.value === key)?.label ?? key;
}

/** One row of the document's item table. A transaction has a single line today; the
 *  documents render whatever `lines` holds, so multi-line transactions need no redesign. */
export interface TradeDocumentLine {
  itemNumber: number;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface TradeDocumentData {
  documentNumber: string;
  date: string;
  dueDate: string | null;
  currency: string;
  status: AccountingTradeDocumentStatus;
  party: {
    code: string;
    name: string;
    /** The entity's own type (e.g. "Vendor"), used to label its ID. */
    roleLabel: string;
    address: string | null;
    contactName: string | null;
    phone: string | null;
  };
  /** The invoice/bill a credit or debit note is issued against, when it has one. */
  originalNumber: string | null;
  lines: TradeDocumentLine[];
  subtotal: number;
  tax: number;
  total: number;
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

/** What the payment receipt and payment voucher render — a payment or receipt of money,
 *  not a trade document. The party is optional: a direct cashbook entry may not name one. */
export interface PaymentDocumentData {
  documentNumber: string;
  date: string;
  currency: string;
  status: AccountingTradeDocumentStatus;
  party: TradeDocumentData['party'] | null;
  lines: TradeDocumentLine[];
  total: number;
  /** e.g. "Bank Transfer" */
  method: string;
  reference: string | null;
  /** The cash/bank account the money went into (receipt) or came out of (voucher). */
  account: string | null;
}

/** Maps a trade document (bill, invoice, …) onto what the printable documents render. */
export function buildTradeDocumentData(document: AccountingTradeDocument): TradeDocumentData {
  const subtotal = Number(document.subtotalAmount);
  const quantity = document.quantity ? Number(document.quantity) : 1;
  const unitPrice = document.unitPrice ? Number(document.unitPrice) : subtotal;

  return {
    documentNumber: document.documentNumber,
    date: document.documentDate,
    dueDate: document.dueDate,
    currency: document.currency,
    status: document.status,
    party: {
      code: document.party.code,
      name: document.party.name,
      roleLabel: document.party.type ? titleCase(document.party.type) : 'Entity',
      address: document.party.address ?? null,
      contactName: document.party.contactName ?? null,
      phone: document.party.phone ?? null,
    },
    originalNumber: document.originalDocument?.documentNumber ?? null,
    lines: [
      {
        itemNumber: 1,
        name: document.description ?? '—',
        quantity,
        unitPrice,
        total: subtotal,
      },
    ],
    subtotal,
    tax: Number(document.taxAmount),
    total: Number(document.totalAmount),
  };
}

export function formatDocumentDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDocumentAmount(value: number) {
  return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
