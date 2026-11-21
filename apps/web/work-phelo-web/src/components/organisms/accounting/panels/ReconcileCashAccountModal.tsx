'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { DatePicker } from '@/components/atoms/DatePicker';
import { FileUpload } from '@/components/atoms/FileUpload';
import { Input } from '@/components/atoms/Input';
import {
  downloadBankStatementTemplate,
  parseBankStatementFile,
} from '@/lib/accounting/bankStatementImport';
import type { BankStatementRow } from '@/store/bankStatementDraft.store';
import { extractError } from '@/lib/extractError';

interface Props {
  accountName: string;
  onClose: () => void;
  onReconcile: (details: {
    fromDate: string;
    toDate: string;
    bankOpeningBalance: string;
    bankClosingBalance: string;
    statementRows: BankStatementRow[];
  }) => void;
}

const MAX_SHOWN_ERRORS = 6;

/** Collects the period, the bank's opening and closing balances and the statement sheet, reads the
 *  sheet in the browser, then hands the values to the caller, which opens the reconcile page.
 *  The file itself is never kept. */
export function ReconcileCashAccountModal({ accountName, onClose, onReconcile }: Props) {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [bankOpeningBalance, setBankOpeningBalance] = useState('');
  const [bankClosingBalance, setBankClosingBalance] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);

  const submit = async () => {
    if (!file) return;
    setIsReading(true);
    setProblems([]);
    try {
      const { rows, errors } = await parseBankStatementFile(file, { fromDate, toDate });
      if (errors.length > 0) {
        setProblems(errors);
        return;
      }
      onReconcile({
        fromDate,
        toDate,
        bankOpeningBalance,
        bankClosingBalance,
        statementRows: rows,
      });
    } catch (error) {
      setProblems([extractError(error, 'Unable to read this file')]);
    } finally {
      setIsReading(false);
    }
  };

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
            onClick={submit}
            isLoading={isReading}
            disabled={
              !fromDate ||
              !toDate ||
              bankOpeningBalance.trim() === '' ||
              bankClosingBalance.trim() === '' ||
              !file
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
          onChange={(value) => {
            setFromDate(value);
            setProblems([]);
          }}
          maxDate={toDate || undefined}
        />
        <DatePicker
          label="To"
          value={toDate}
          onChange={(value) => {
            setToDate(value);
            setProblems([]);
          }}
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
        <div className="sm:col-span-2 flex flex-col gap-2">
          <FileUpload
            label="Bank Statement"
            accept=".xlsx"
            value={file}
            onChange={(selected) => {
              setFile(selected);
              setProblems([]);
            }}
            hint="Excel file (.xlsx). Only its values are used; the file is not saved."
          />
          <button
            type="button"
            onClick={() => void downloadBankStatementTemplate()}
            className="self-start inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Download template
          </button>
        </div>
        {problems.length > 0 && (
          <div className="sm:col-span-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="font-medium">
              {problems.length === 1 ? 'This file has a problem' : `${problems.length} problems`}
            </p>
            <ul className="mt-1 list-disc pl-5 text-xs">
              {problems.slice(0, MAX_SHOWN_ERRORS).map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
            {problems.length > MAX_SHOWN_ERRORS && (
              <p className="mt-1 text-xs">…and {problems.length - MAX_SHOWN_ERRORS} more</p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
