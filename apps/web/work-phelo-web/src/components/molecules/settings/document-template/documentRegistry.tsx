'use client';

import type { ReactNode } from 'react';
import {
  BillDocumentBody,
  BillDocumentFooterNote,
} from '@/components/molecules/accounting/documents/BillDocument';
import {
  CreditNoteDocumentBody,
  CreditNoteDocumentFooterNote,
} from '@/components/molecules/accounting/documents/CreditNoteDocument';
import {
  DebitNoteDocumentBody,
  DebitNoteDocumentFooterNote,
} from '@/components/molecules/accounting/documents/DebitNoteDocument';
import {
  InvoiceDocumentBody,
  InvoiceDocumentFooterNote,
} from '@/components/molecules/accounting/documents/InvoiceDocument';
import {
  PayslipDocumentBody,
  PayslipDocumentFooterNote,
} from '@/components/molecules/hr/payroll/PayslipDocumentBody';
import {
  PaymentReceiptDocumentBody,
  PaymentReceiptDocumentFooterNote,
} from '@/components/molecules/accounting/documents/PaymentReceiptDocument';
import {
  PaymentVoucherDocumentBody,
  PaymentVoucherDocumentFooterNote,
} from '@/components/molecules/accounting/documents/PaymentVoucherDocument';
import type { PaymentDocumentData, TradeDocumentData } from '@/lib/accounting/documents';
import type { PayrollItem } from '@/types/hr';
import type { DocumentTemplate, PreviewDoc } from './templateConfig';

export type DocumentModule = 'HR' | 'ACCOUNTING';

export interface DocumentDefinition {
  key: PreviewDoc;
  module: DocumentModule;
  label: string;
  /** The document's body filled with sample data, for the studio's paper. Only the body —
   *  the letterhead, footer, watermark and signature come from the template around it. */
  renderSample: (template: DocumentTemplate) => ReactNode;
  /** A closing note the paper pins to the bottom, just above its footer line — separate from
   *  the body so the signature can follow the body's content instead. */
  renderFooterNote?: () => ReactNode;
}

const SAMPLE_BILL: TradeDocumentData = {
  documentNumber: 'BILL26-00012',
  date: '2026-09-14',
  dueDate: '2026-10-14',
  currency: 'GHS',
  status: 'POSTED',
  party: {
    code: 'VEN-0004',
    name: 'Accra Office Supplies Ltd',
    roleLabel: 'Vendor',
    address: '14 Independence Avenue, Accra',
    contactName: 'Kofi Mensah',
    phone: '+233 24 000 0000',
  },
  originalNumber: null,
  lines: [
    { itemNumber: 1, name: 'A4 printing paper (box)', quantity: 12, unitPrice: 150, total: 1800 },
    { itemNumber: 2, name: 'Toner cartridge', quantity: 2, unitPrice: 320.5, total: 641 },
  ],
  subtotal: 2441,
  tax: 366.15,
  total: 2807.15,
};

const SAMPLE_INVOICE: TradeDocumentData = {
  documentNumber: 'INV26-00031',
  date: '2026-09-18',
  dueDate: '2026-10-18',
  currency: 'GHS',
  status: 'POSTED',
  party: {
    code: 'CUS-0007',
    name: 'Kumasi Trading Company',
    roleLabel: 'Customer',
    address: '22 Adum Road, Kumasi',
    contactName: 'Abena Owusu',
    phone: '+233 20 000 0000',
  },
  originalNumber: null,
  lines: [
    {
      itemNumber: 1,
      name: 'Consulting services (hours)',
      quantity: 15,
      unitPrice: 150,
      total: 2250,
    },
    { itemNumber: 2, name: 'Site visit', quantity: 1, unitPrice: 75, total: 75 },
  ],
  subtotal: 2325,
  tax: 348.75,
  total: 2673.75,
};

const SAMPLE_CREDIT_NOTE: TradeDocumentData = {
  documentNumber: 'CN26-00004',
  date: '2026-09-25',
  dueDate: null,
  currency: 'GHS',
  status: 'POSTED',
  party: {
    code: 'CUS-0007',
    name: 'Kumasi Trading Company',
    roleLabel: 'Customer',
    address: '22 Adum Road, Kumasi',
    contactName: 'Abena Owusu',
    phone: '+233 20 000 0000',
  },
  originalNumber: 'INV26-00031',
  lines: [{ itemNumber: 1, name: 'Site visit — returned', quantity: 1, unitPrice: 75, total: 75 }],
  subtotal: 75,
  tax: 11.25,
  total: 86.25,
};

const SAMPLE_DEBIT_NOTE: TradeDocumentData = {
  documentNumber: 'DN26-00002',
  date: '2026-09-26',
  dueDate: null,
  currency: 'GHS',
  status: 'POSTED',
  party: {
    code: 'VEN-0004',
    name: 'Accra Office Supplies Ltd',
    roleLabel: 'Vendor',
    address: '14 Independence Avenue, Accra',
    contactName: 'Kofi Mensah',
    phone: '+233 24 000 0000',
  },
  originalNumber: 'BILL26-00012',
  lines: [
    {
      itemNumber: 1,
      name: 'Toner cartridge — returned',
      quantity: 1,
      unitPrice: 320.5,
      total: 320.5,
    },
  ],
  subtotal: 320.5,
  tax: 48.08,
  total: 368.58,
};

const SAMPLE_RECEIPT: PaymentDocumentData = {
  documentNumber: 'RCPT26-00007',
  date: '2026-09-22',
  currency: 'GHS',
  status: 'POSTED',
  party: {
    code: 'CUS-0007',
    name: 'Kumasi Trading Company',
    roleLabel: 'Customer',
    address: '22 Adum Road, Kumasi',
    contactName: 'Abena Owusu',
    phone: '+233 20 000 0000',
  },
  lines: [
    {
      itemNumber: 1,
      name: 'Payment against invoice INV26-00031',
      quantity: 1,
      unitPrice: 2673.75,
      total: 2673.75,
    },
  ],
  total: 2673.75,
  method: 'Bank Transfer',
  reference: 'TRX-88213',
  account: 'GCB Main Current Account',
};

const SAMPLE_VOUCHER: PaymentDocumentData = {
  documentNumber: 'PMNT26-00015',
  date: '2026-09-24',
  currency: 'GHS',
  status: 'POSTED',
  party: {
    code: 'VEN-0004',
    name: 'Accra Office Supplies Ltd',
    roleLabel: 'Vendor',
    address: '14 Independence Avenue, Accra',
    contactName: 'Kofi Mensah',
    phone: '+233 24 000 0000',
  },
  lines: [
    {
      itemNumber: 1,
      name: 'Payment against bill BILL26-00012',
      quantity: 1,
      unitPrice: 2807.15,
      total: 2807.15,
    },
  ],
  total: 2807.15,
  method: 'Cheque',
  reference: 'CHQ-004512',
  account: 'GCB Main Current Account',
};

const SAMPLE_PAYSLIP: PayrollItem = {
  id: 'sample',
  tenantId: 'sample',
  payrollRunId: 'sample',
  employeeId: 'sample',
  basicSalary: '5000.00',
  commissionAmount: '0',
  totalAllowances: '400.00',
  allowanceItems: [
    { id: 'a1', payrollItemId: 'sample', name: 'Transport Allowance', amount: '400.00' },
  ],
  transportAmount: '0',
  otherDeductions: '150.00',
  deductionItems: [{ id: 'd1', payrollItemId: 'sample', name: 'Staff Loan', amount: '150.00' }],
  overtimePay: '0',
  bonus: '0',
  thirteenthMonth: '0',
  grossSalary: '5400.00',
  employeeSSNIT: '297.00',
  employerSSNIT: '702.00',
  tier1Contribution: '0',
  tier2Contribution: '0',
  tier3Employee: '0',
  taxableIncome: '5103.00',
  payeTax: '620.00',
  totalDeductions: '1067.00',
  netSalary: '4333.00',
  createdAt: '2026-09-25T00:00:00.000Z',
  employee: {
    firstName: 'Ama',
    lastName: 'Mensah',
    employeeNumber: 'EMP-0012',
    jobTitle: 'Accountant',
    department: 'Finance',
  },
  payrollRun: {
    month: 9,
    year: 2026,
    status: 'PAID',
    payrollCountry: 'GH',
    payrollCurrency: 'GHS',
    tier3Enabled: false,
  },
};

/** Every printable document in the app that has a template preview. Add an entry here (with
 *  its key added to `PreviewDoc`) to make a document selectable in the studio. */
export const DOCUMENT_DEFINITIONS: DocumentDefinition[] = [
  {
    key: 'payslip',
    module: 'HR',
    label: 'Payslip',
    renderSample: (template) => (
      <PayslipDocumentBody item={SAMPLE_PAYSLIP} accent={template.accent} compact />
    ),
    renderFooterNote: () => <PayslipDocumentFooterNote hrEmail="hr@yourcompany.com" />,
  },
  {
    key: 'bill',
    module: 'ACCOUNTING',
    label: 'Bill',
    renderSample: () => <BillDocumentBody data={SAMPLE_BILL} compact />,
    renderFooterNote: () => <BillDocumentFooterNote />,
  },
  {
    key: 'invoice',
    module: 'ACCOUNTING',
    label: 'Invoice',
    renderSample: () => <InvoiceDocumentBody data={SAMPLE_INVOICE} compact />,
    renderFooterNote: () => <InvoiceDocumentFooterNote />,
  },
  {
    key: 'credit-note',
    module: 'ACCOUNTING',
    label: 'Credit Note',
    renderSample: () => <CreditNoteDocumentBody data={SAMPLE_CREDIT_NOTE} compact />,
    renderFooterNote: () => <CreditNoteDocumentFooterNote />,
  },
  {
    key: 'debit-note',
    module: 'ACCOUNTING',
    label: 'Debit Note',
    renderSample: () => <DebitNoteDocumentBody data={SAMPLE_DEBIT_NOTE} compact />,
    renderFooterNote: () => <DebitNoteDocumentFooterNote />,
  },
  {
    key: 'payment-receipt',
    module: 'ACCOUNTING',
    label: 'Payment Receipt',
    renderSample: () => <PaymentReceiptDocumentBody data={SAMPLE_RECEIPT} compact />,
    renderFooterNote: () => <PaymentReceiptDocumentFooterNote />,
  },
  {
    key: 'payment-voucher',
    module: 'ACCOUNTING',
    label: 'Payment Voucher',
    renderSample: () => <PaymentVoucherDocumentBody data={SAMPLE_VOUCHER} compact />,
    renderFooterNote: () => <PaymentVoucherDocumentFooterNote />,
  },
];

export function getDocumentDefinition(key: PreviewDoc): DocumentDefinition {
  return DOCUMENT_DEFINITIONS.find((doc) => doc.key === key) ?? DOCUMENT_DEFINITIONS[0];
}
