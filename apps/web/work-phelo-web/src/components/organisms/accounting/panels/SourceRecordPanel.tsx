'use client';

import { CashbookTransactionDetailPanel } from '@/components/organisms/accounting/panels/CashbookTransactionDetailPanel';
import { TradeDocumentDetailPanel } from '@/components/organisms/accounting/panels/TradeDocumentDetailPanel';
import { TradeSettlementDetailPanel } from '@/components/organisms/accounting/panels/TradeSettlementDetailPanel';
import {
  useCashbookTransaction,
  usePayableBill,
  usePayableCreditNote,
  usePayablePayment,
  useReceivableCreditNote,
  useReceivableInvoice,
  useReceivableReceipt,
} from '@/hooks';
import type { JournalSourceRecordType } from '@/types/accounting';

export interface SourceRecordTarget {
  type: JournalSourceRecordType;
  /** Cleared when the panel closes; the type stays so a form it hosted outlives the panel. */
  id?: string;
}

interface SourceRecordPanelProps {
  target: SourceRecordTarget | null;
  onClose: () => void;
}

/** Opens the record that posted a journal (invoice, bill, receipt, payment, credit/debit note or
 *  cashbook entry) in its own panel, where void, edit and restore are decided with that record's
 *  own checks. */
export function SourceRecordPanel({ target, onClose }: SourceRecordPanelProps) {
  const idFor = (type: JournalSourceRecordType) => (target?.type === type ? target.id : undefined);
  const invoice = useReceivableInvoice(idFor('INVOICE'));
  const creditNote = useReceivableCreditNote(idFor('CREDIT_NOTE'));
  const receipt = useReceivableReceipt(idFor('RECEIPT'));
  const bill = usePayableBill(idFor('BILL'));
  const debitNote = usePayableCreditNote(idFor('DEBIT_NOTE'));
  const payment = usePayablePayment(idFor('PAYMENT'));
  const cashbook = useCashbookTransaction(idFor('CASHBOOK'));

  if (!target) return null;
  switch (target.type) {
    case 'INVOICE':
      return (
        <TradeDocumentDetailPanel
          side="RECEIVABLE"
          document={invoice.data ?? null}
          onClose={onClose}
        />
      );
    case 'CREDIT_NOTE':
      return (
        <TradeDocumentDetailPanel
          side="RECEIVABLE"
          documentKind="creditNote"
          document={creditNote.data ?? null}
          onClose={onClose}
        />
      );
    case 'BILL':
      return (
        <TradeDocumentDetailPanel side="PAYABLE" document={bill.data ?? null} onClose={onClose} />
      );
    case 'DEBIT_NOTE':
      return (
        <TradeDocumentDetailPanel
          side="PAYABLE"
          documentKind="creditNote"
          document={debitNote.data ?? null}
          onClose={onClose}
        />
      );
    case 'RECEIPT':
      return (
        <TradeSettlementDetailPanel
          side="RECEIVABLE"
          settlement={receipt.data ?? null}
          onClose={onClose}
        />
      );
    case 'PAYMENT':
      return (
        <TradeSettlementDetailPanel
          side="PAYABLE"
          settlement={payment.data ?? null}
          onClose={onClose}
        />
      );
    case 'CASHBOOK':
      return (
        <CashbookTransactionDetailPanel transaction={cashbook.data ?? null} onClose={onClose} />
      );
  }
}
