'use client';

import { ChangeEvent, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { DatePicker } from '@/components/atoms/DatePicker';
import { AccountingTradeDocument } from '@/types/accounting';
import {
  useCreatePayableCreditNote,
  useCreateReceivableCreditNote,
  useGLAccountOptions,
  usePostPayableCreditNote,
  usePostReceivableCreditNote,
} from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';

interface Props {
  isOpen: boolean;
  document: AccountingTradeDocument;
  /** What is still owed on the document; a deduction can't take more than this. */
  outstanding: number;
  onClose: () => void;
  onDone: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Lowers a posted invoice or bill by an amount against an account of the user's choice. It is a
 *  credit note raised and posted in one step, applied to this document, so it needs no
 *  transaction type: the customer or vendor, currency and control account come from the document. */
export function AddDocumentDeductionModal({
  isOpen,
  document,
  outstanding,
  onClose,
  onDone,
}: Props) {
  const toast = useToast();
  const isReceivable = document.side === 'RECEIVABLE';
  const noun = isReceivable ? 'invoice' : 'bill';

  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [description, setDescription] = useState('');

  const { options, isLoading } = useGLAccountOptions();

  const createReceivable = useCreateReceivableCreditNote();
  const createPayable = useCreatePayableCreditNote();
  const postReceivable = usePostReceivableCreditNote();
  const postPayable = usePostPayableCreditNote();
  const isPending =
    createReceivable.isPending ||
    createPayable.isPending ||
    postReceivable.isPending ||
    postPayable.isPending;

  // Start empty each time the modal opens again.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (wasOpen !== isOpen) {
    setWasOpen(isOpen);
    if (!isOpen) {
      setAccountId('');
      setAmount('');
      setDate(today());
      setDescription('');
    }
  }

  const value = Number(amount);
  const tooMuch = value > outstanding;
  const canSubmit = !!accountId && value > 0 && !tooMuch && !!date;

  const handleSubmit = async () => {
    const payload = {
      partyId: document.party.id,
      documentDate: date,
      currency: document.currency,
      amount: value,
      offsetGlAccountId: accountId,
      controlAccountId: document.controlAccount.id,
      originalDocumentId: document.id,
      costCentreId: document.costCentre?.id,
      description: description.trim() || `Deduction on ${document.documentNumber}`,
    };

    let noteId: string;
    try {
      const note = isReceivable
        ? await createReceivable.mutateAsync(payload)
        : await createPayable.mutateAsync(payload);
      noteId = note.id;
    } catch (err) {
      toast.error(extractError(err, 'Failed to add the deduction'));
      return;
    }

    try {
      if (isReceivable) {
        await postReceivable.mutateAsync(noteId);
      } else {
        await postPayable.mutateAsync(noteId);
      }
      toast.success(`Deduction applied to ${document.documentNumber}.`);
      onDone();
    } catch (err) {
      toast.error(
        extractError(
          err,
          'The credit note was saved as a draft but could not be posted. Post it from Credit Notes.',
        ),
      );
      onDone();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Deduction"
      description={`Lowers what is owed on ${document.documentNumber}. It is recorded as a credit note applied to this ${noun}.`}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            isLoading={isPending}
            loadingText="Applying…"
            disabled={!canSubmit}
            onClick={handleSubmit}
          >
            Add Deduction
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <SearchSelect
          label={isReceivable ? 'Account (debited)' : 'Account (credited)'}
          placeholder={isLoading ? 'Loading…' : 'Select GL account…'}
          options={options}
          value={accountId}
          onChange={setAccountId}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label={`Amount (${document.currency})`}
            type="number"
            step="0.01"
            value={amount}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setAmount(e.target.value)}
            placeholder={`Up to ${outstanding.toLocaleString()}`}
            error={tooMuch ? `More than the ${outstanding.toLocaleString()} still owed` : undefined}
          />
          <DatePicker label="Date" value={date} onChange={setDate} />
        </div>
        <Input
          label="Description"
          type="textarea"
          rows={2}
          value={description}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
          placeholder="Optional, e.g. Early settlement discount"
        />
      </div>
    </Modal>
  );
}
