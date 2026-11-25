'use client';

import { DocumentContentLayout } from '@/components/molecules/settings/document-template/DocumentContentLayout';
import { DocumentPaper } from '@/components/molecules/settings/document-template/DocumentPaper';
import type { DocumentTemplate } from '@/components/molecules/settings/document-template/templateConfig';
import type { AccountingDocumentKey, TradeDocumentData } from '@/lib/accounting/documents';
import { BillDocumentBody, BillDocumentFooterNote } from './BillDocument';
import { CreditNoteDocumentBody, CreditNoteDocumentFooterNote } from './CreditNoteDocument';
import { DebitNoteDocumentBody, DebitNoteDocumentFooterNote } from './DebitNoteDocument';
import { InvoiceDocumentBody, InvoiceDocumentFooterNote } from './InvoiceDocument';

const DOCUMENTS = {
  BILL: { templateKey: 'bill', Body: BillDocumentBody, FooterNote: BillDocumentFooterNote },
  INVOICE: {
    templateKey: 'invoice',
    Body: InvoiceDocumentBody,
    FooterNote: InvoiceDocumentFooterNote,
  },
  CREDIT_NOTE: {
    templateKey: 'credit-note',
    Body: CreditNoteDocumentBody,
    FooterNote: CreditNoteDocumentFooterNote,
  },
  DEBIT_NOTE: {
    templateKey: 'debit-note',
    Body: DebitNoteDocumentBody,
    FooterNote: DebitNoteDocumentFooterNote,
  },
} as const;

/** A real transaction's document on the company's saved template. */
export function AccountingDocumentSheet({
  documentKey,
  data,
  template,
}: {
  documentKey: AccountingDocumentKey;
  data: TradeDocumentData;
  template: DocumentTemplate;
}) {
  const { templateKey, Body, FooterNote } = DOCUMENTS[documentKey];

  return (
    <DocumentPaper template={template}>
      <DocumentContentLayout
        template={template}
        documentKey={templateKey}
        footerNote={<FooterNote />}
      >
        <Body data={data} compact />
      </DocumentContentLayout>
    </DocumentPaper>
  );
}
