'use client';

import { useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { Input } from '@/components/atoms/Input';

interface Props {
  accountName: string;
  onClose: () => void;
  onReconcile: (details: {
    fromDate: string;
    toDate: string;
    bankOpeningBalance: string;
    bankClosingBalance: string;
  }) => void;
}

/** Collects the period and the bank's opening and closing balances, then hands them to the caller, which opens the reconcile details. */
export function ReconcileCashAccountModal({ accountName, onClose, onReconcile }: Props) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [bankOpeningBalance, setBankOpeningBalance] = useState('');
  const [bankClosingBalance, setBankClosingBalance] = useState('');

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Reconcile"
      description={accountName}
      footer={
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() =>
              onReconcile({ fromDate, toDate, bankOpeningBalance, bankClosingBalance })
            }
            disabled={
              !fromDate ||
              !toDate ||
              bankOpeningBalance.trim() === '' ||
              bankClosingBalance.trim() === ''
            }
          >
            Reconcile
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DatePicker
          label="From"
          value={fromDate}
          onChange={setFromDate}
          maxDate={toDate || undefined}
        />
        <DatePicker
          label="To"
          value={toDate}
          onChange={setToDate}
          minDate={fromDate || undefined}
        />
        <Input
          label="Bank Opening Balance"
          type="number"
          inputMode="decimal"
          step="0.01"
          placeholder="0.00"
          value={bankOpeningBalance}
          onChange={(e) => setBankOpeningBalance(e.target.value)}
        />
        <Input
          label="Bank Closing Balance"
          type="number"
          inputMode="decimal"
          step="0.01"
          placeholder="0.00"
          value={bankClosingBalance}
          onChange={(e) => setBankClosingBalance(e.target.value)}
        />
      </div>
    </Modal>
  );
}
