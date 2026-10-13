'use client';

import { useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { FileUpload } from '@/components/atoms/FileUpload';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { Icons } from '@/components/atoms/icons';
import { AddLeafAccountPanel } from '@/components/organisms/accounting/panels/AddLeafAccountPanel';
import {
  accountRefKey,
  downloadJournalLineImportTemplate,
  matchAccount,
  parseJournalLineImportFile,
  postingBlocker,
  suggestAccount,
  type AccountMatch,
  type ParsedJournalLineRow,
} from '@/lib/accounting/journalLineImport';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { GLAccount, GLAccountCategory, JournalLine } from '@/types/accounting';

export type ImportMode = 'replace' | 'append';

interface ImportJournalLinesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: GLAccount[];
  allowedClasses?: GLAccountCategory[];
  /** When the form already has lines, the user chooses whether to replace or append. */
  hasExistingLines: boolean;
  onImport: (lines: JournalLine[], mode: ImportMode) => void;
}

interface RefState {
  ref: { accountCode: string; accountName: string };
  match: AccountMatch;
}

const fmt = (n: number | '') =>
  n === '' ? '' : n.toLocaleString(undefined, { minimumFractionDigits: 2 });

export function ImportJournalLinesDialog({
  isOpen,
  onClose,
  accounts,
  allowedClasses,
  hasExistingLines,
  onImport,
}: ImportJournalLinesDialogProps) {
  const toast = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [rows, setRows] = useState<ParsedJournalLineRow[] | null>(null);
  /** Accounts the user picked or created for a distinct file value, keyed by `accountRefKey`. */
  const [chosen, setChosen] = useState<Record<string, GLAccount>>({});
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [mode, setMode] = useState<ImportMode>('replace');

  const usableAccounts = useMemo(
    () => accounts.filter((a) => !postingBlocker(a, allowedClasses)),
    [accounts, allowedClasses],
  );
  const accountOptions = useMemo(
    () => usableAccounts.map((a) => ({ value: a.id, label: `${a.code} – ${a.name}` })),
    [usableAccounts],
  );

  // One match per distinct account reference in the file.
  const refStates = useMemo(() => {
    const map = new Map<string, RefState>();
    for (const row of rows ?? []) {
      const key = accountRefKey(row);
      if (map.has(key) || !key.replace('|', '')) continue;
      const ref = { accountCode: row.accountCode, accountName: row.accountName };
      map.set(key, { ref, match: matchAccount(accounts, ref, allowedClasses) });
    }
    return map;
  }, [rows, accounts, allowedClasses]);

  const resolvedAccount = (key: string): GLAccount | undefined => {
    if (chosen[key]) return chosen[key];
    const match = refStates.get(key)?.match;
    return match?.status === 'matched' ? match.account : undefined;
  };

  const rowHasIssue = (row: ParsedJournalLineRow) =>
    row.errors.length > 0 || !resolvedAccount(accountRefKey(row));
  const issueCount = rows?.filter(rowHasIssue).length ?? 0;
  const canImport = rows !== null && rows.length > 0 && issueCount === 0;

  const reset = () => {
    setFile(null);
    setRows(null);
    setChosen({});
    setCreatingKey(null);
    setMode('replace');
    setIsParsing(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFileChange = async (selected: File | null) => {
    setFile(selected);
    setChosen({});
    if (!selected) {
      setRows(null);
      return;
    }
    setIsParsing(true);
    try {
      const parsed = await parseJournalLineImportFile(selected);
      if (parsed.length === 0) toast.error('No rows found in this file');
      setRows(parsed);
    } catch (error) {
      toast.error(extractError(error, 'Unable to read this file — is it the template?'));
      setRows(null);
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirm = () => {
    if (!rows || !canImport) return;
    const lines: JournalLine[] = rows.map((row) => {
      const account = resolvedAccount(accountRefKey(row))!;
      return {
        accountClass: account.category,
        targetAccount: account.id,
        description: row.description,
        debit: row.debit,
        credit: row.credit,
      };
    });
    onImport(lines, hasExistingLines ? mode : 'replace');
    toast.success(`Imported ${lines.length} line${lines.length === 1 ? '' : 's'}`);
    handleClose();
  };

  const renderAccountCell = (row: ParsedJournalLineRow) => {
    const key = accountRefKey(row);
    const state = refStates.get(key);
    const account = resolvedAccount(key);
    if (!state) return <span className="text-gray-400">—</span>;

    if (account) {
      return (
        <span className="text-gray-700">
          <span className="font-mono">{account.code}</span> – {account.name}
        </span>
      );
    }

    const typed = row.accountName || row.accountCode;
    const suggestion =
      state.match.status === 'unresolved' ? suggestAccount(usableAccounts, state.ref) : undefined;
    const message =
      state.match.status === 'ambiguous'
        ? `"${typed}" matches more than one account`
        : state.match.status === 'unavailable'
          ? `"${typed}" ${state.match.reason}`
          : `"${typed}" was not found`;
    const candidateOptions =
      state.match.status === 'ambiguous'
        ? state.match.candidates.map((a) => ({ value: a.id, label: `${a.code} – ${a.name}` }))
        : accountOptions;

    return (
      <div className="flex min-w-60 flex-col gap-1.5">
        <span className="text-red-600">{message}</span>
        {suggestion && (
          <button
            type="button"
            onClick={() => setChosen((prev) => ({ ...prev, [key]: suggestion }))}
            className="text-left text-brand hover:underline"
          >
            Did you mean {suggestion.code} – {suggestion.name}?
          </button>
        )}
        <SearchSelect
          size="sm"
          placeholder="Match to an account…"
          options={candidateOptions}
          value=""
          onChange={(id) => {
            const picked = accounts.find((a) => a.id === id);
            if (picked) setChosen((prev) => ({ ...prev, [key]: picked }));
          }}
        />
        {state.match.status !== 'ambiguous' && (
          <button
            type="button"
            onClick={() => setCreatingKey(key)}
            className="flex items-center gap-1 self-start text-brand hover:underline"
          >
            <Icons.Plus className="h-3.5 w-3.5" />
            Create account
          </button>
        )}
      </div>
    );
  };

  const creatingRef = creatingKey ? refStates.get(creatingKey)?.ref : undefined;

  return (
    <>
      {/* Hidden (not unmounted) while the create-account panel is open so the parsed rows and
          the user's choices survive, and the two overlays never stack. */}
      <Modal
        isOpen={isOpen && creatingKey === null}
        onClose={() => {
          if (creatingKey === null) handleClose();
        }}
        title="Import Journal Lines"
        description="Upload the filled template to fill in this entry's lines. Resolve any problems below before importing."
        width="max-w-5xl"
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              icon={<Download className="h-3.5 w-3.5" />}
              onClick={() => downloadJournalLineImportTemplate(usableAccounts)}
            >
              Template
            </Button>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleConfirm} disabled={!canImport}>
                Import {rows && rows.length > 0 ? rows.length : ''} line
                {rows?.length === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        }
      >
        <div className="flex flex-col gap-4 pt-2">
          <FileUpload
            label="Filled template"
            accept=".xlsx"
            value={file}
            onChange={handleFileChange}
            hint="Only .xlsx files exported from the template are supported."
          />

          {isParsing && <p className="text-sm text-gray-500">Reading file…</p>}

          {rows && rows.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className={issueCount > 0 ? 'text-xs text-red-600' : 'text-xs text-green-600'}>
                  {issueCount > 0
                    ? `${issueCount} line${issueCount === 1 ? '' : 's'} need${issueCount === 1 ? 's' : ''} attention before you can import`
                    : `${rows.length} line${rows.length === 1 ? '' : 's'} ready to import`}
                </p>
                {hasExistingLines && (
                  <div className="flex items-center gap-4 text-xs text-gray-700">
                    {(['replace', 'append'] as const).map((value) => (
                      <label key={value} className="flex cursor-pointer items-center gap-1.5">
                        <input
                          type="radio"
                          name="journal-import-mode"
                          checked={mode === value}
                          onChange={() => setMode(value)}
                        />
                        {value === 'replace' ? 'Replace existing lines' : 'Add to existing lines'}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="max-h-96 overflow-auto rounded-lg border border-gray-100">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-gray-50 text-gray-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Row</th>
                      <th className="px-3 py-2 font-semibold">Account</th>
                      <th className="px-3 py-2 font-semibold">Description</th>
                      <th className="px-3 py-2 text-right font-semibold">Debit</th>
                      <th className="px-3 py-2 text-right font-semibold">Credit</th>
                      <th className="px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.rowNumber} className="border-t border-gray-100 align-top">
                        <td className="px-3 py-2 text-gray-400">{row.rowNumber}</td>
                        <td className="px-3 py-2">{renderAccountCell(row)}</td>
                        <td className="px-3 py-2 text-gray-700">{row.description || '—'}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmt(row.debit)}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{fmt(row.credit)}</td>
                        <td className="px-3 py-2">
                          {row.errors.length > 0 ? (
                            <span className="text-red-600">{row.errors.join('; ')}</span>
                          ) : resolvedAccount(accountRefKey(row)) ? (
                            <span className="text-green-600">Ready</span>
                          ) : (
                            <span className="text-red-600">Resolve account</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Modal>

      <AddLeafAccountPanel
        isOpen={creatingKey !== null}
        onClose={() => setCreatingKey(null)}
        initialName={creatingRef?.accountName || creatingRef?.accountCode || ''}
        onCreated={(account) => {
          if (creatingKey === null) return;
          const blocker = postingBlocker(account, allowedClasses);
          if (blocker) {
            toast.error(`${account.name} ${blocker}, so it can't be used here`);
            return;
          }
          setChosen((prev) => ({ ...prev, [creatingKey]: account }));
        }}
      />
    </>
  );
}
