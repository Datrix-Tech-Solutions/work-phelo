'use client';

import { ChangeEvent, useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { Input } from '@/components/atoms/Input';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { useCashAccounts, useGLAccounts, useUpdateCashbookDraft } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { SETTLEMENT_METHOD_OPTIONS } from '@/lib/accounting/settlementMethod';
import { extractError } from '@/lib/extractError';
import type {
  AccountingCashbookSettlementMethod,
  CashbookTransaction,
  UpdateCashbookDraftPayload,
} from '@/types/accounting';

function fmtAmount(amount: string, currency: string) {
  const value = Number(amount);
  return `${currency} ${Number.isFinite(value) ? value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : amount}`;
}

interface Props {
  transaction: CashbookTransaction;
  onClose: () => void;
  /** Called once the changes are saved - the caller refreshes what it is showing. */
  onSaved: () => void;
}

/**
 * Completes a draft direct receipt or payment. The amount was fixed when it was raised, so it is
 * shown but cannot be changed here.
 */
export function EditCashbookDraftModal({ transaction, onClose, onSaved }: Props) {
  const toast = useToast();
  const update = useUpdateCashbookDraft();
  const { data: cashAccounts = [] } = useCashAccounts({
    currency: transaction.currency,
    isActive: true,
  });
  const { data: glAccounts = [] } = useGLAccounts();

  const [transactionDate, setTransactionDate] = useState(transaction.transactionDate.slice(0, 10));
  const [cashAccountId, setCashAccountId] = useState(transaction.cashAccountId);
  const [settlementMethod, setSettlementMethod] = useState<string>(transaction.settlementMethod);
  const [offsetGlAccountId, setOffsetGlAccountId] = useState(transaction.offsetGlAccountId ?? '');
  const [reference, setReference] = useState(transaction.reference ?? '');
  const [description, setDescription] = useState(transaction.description);

  const cashAccountOptions = useMemo(
    () => cashAccounts.map((a) => ({ value: a.id, label: a.name })),
    [cashAccounts],
  );
  const glAccountOptions = useMemo(
    () => glAccounts.map((a) => ({ value: a.id, label: `${a.code} – ${a.name}` })),
    [glAccounts],
  );

  const payload: UpdateCashbookDraftPayload = {
    ...(transactionDate && transactionDate !== transaction.transactionDate.slice(0, 10)
      ? { transactionDate }
      : {}),
    ...(cashAccountId && cashAccountId !== transaction.cashAccountId ? { cashAccountId } : {}),
    ...(settlementMethod !== transaction.settlementMethod
      ? { settlementMethod: settlementMethod as AccountingCashbookSettlementMethod }
      : {}),
    ...(offsetGlAccountId && offsetGlAccountId !== transaction.offsetGlAccountId
      ? { offsetGlAccountId }
      : {}),
    ...(reference.trim() && reference.trim() !== (transaction.reference ?? '')
      ? { reference: reference.trim() }
      : {}),
    ...(description.trim() && description.trim() !== transaction.description
      ? { description: description.trim() }
      : {}),
  };
  const changed = Object.keys(payload).length > 0;

  const handleSave = async () => {
    try {
      await update.mutateAsync({ transactionId: transaction.id, ...payload });
      toast.success('Draft updated.');
      onSaved();
    } catch (err) {
      toast.error(extractError(err, 'Failed to update the draft'));
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Edit Draft"
      description={transaction.transactionNumber ?? transaction.description}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose} disabled={update.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!changed}
            isLoading={update.isPending}
            loadingText="Saving…"
          >
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
          <p className="mb-2 text-xs font-semibold text-gray-500">
            Fixed when the draft was raised
          </p>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold text-gray-500">Amount</span>
            <span className="text-sm text-gray-900">
              {fmtAmount(transaction.amount, transaction.currency)}
            </span>
          </div>
        </div>

        <Input
          label="Transaction Date"
          type="date"
          value={transactionDate}
          onChange={(e) => setTransactionDate(e.target.value)}
        />
        <SearchSelect
          label="Cash / Bank Account"
          placeholder="Select account"
          options={cashAccountOptions}
          value={cashAccountId}
          onChange={setCashAccountId}
          clearable={false}
        />
        <SearchSelect
          label="Settlement Method"
          placeholder="Select method"
          options={SETTLEMENT_METHOD_OPTIONS}
          value={settlementMethod}
          onChange={setSettlementMethod}
          clearable={false}
        />
        <SearchSelect
          label={transaction.direction === 'INFLOW' ? 'Account to Credit' : 'Account to Debit'}
          placeholder="Select account"
          options={glAccountOptions}
          value={offsetGlAccountId}
          onChange={setOffsetGlAccountId}
          clearable={false}
        />
        <Input
          label="Reference"
          value={reference}
          maxLength={120}
          onChange={(e) => setReference(e.target.value)}
        />
        <Input
          label="Description"
          type="textarea"
          rows={3}
          maxLength={500}
          value={description}
          onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
        />
      </div>
    </Modal>
  );
}
