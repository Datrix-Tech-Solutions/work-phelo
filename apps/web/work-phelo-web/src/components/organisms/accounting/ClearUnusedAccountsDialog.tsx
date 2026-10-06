'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import { CATEGORIES } from '@/components/organisms/accounting/ChartOfAccountsTree';
import { useBulkDeleteGLAccounts, useUnusedGLAccounts } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { BulkDeleteAccountResult } from '@/types/accounting';

interface ClearUnusedAccountsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ClearUnusedAccountsDialog({ isOpen, onClose }: ClearUnusedAccountsDialogProps) {
  const toast = useToast();
  const { data: unused = [], isLoading, isError } = useUnusedGLAccounts(isOpen);
  const { mutateAsync: bulkDelete, isPending } = useBulkDeleteGLAccounts();

  /** Accounts the user took out of the deletion; everything else is selected by default. */
  const [kept, setKept] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, BulkDeleteAccountResult>>({});

  const selected = useMemo(
    () => unused.filter((a) => !kept[a.id] && results[a.id]?.status !== 'deleted'),
    [unused, kept, results],
  );

  const handleClose = () => {
    if (isPending) return;
    setKept({});
    setResults({});
    onClose();
  };

  const toggle = (id: string) => setKept((prev) => ({ ...prev, [id]: !prev[id] }));
  const allSelected = unused.length > 0 && selected.length === unused.length;
  const toggleAll = () =>
    setKept(allSelected ? Object.fromEntries(unused.map((a) => [a.id, true])) : {});

  const handleDelete = async () => {
    if (selected.length === 0) return;
    try {
      const response = await bulkDelete(selected.map((a) => a.id));
      setResults(Object.fromEntries(response.map((r) => [r.id, r])));
      const deleted = response.filter((r) => r.status === 'deleted').length;
      if (deleted === response.length) {
        toast.success(`Deleted ${deleted} account${deleted === 1 ? '' : 's'}`);
        handleClose();
      } else {
        toast.error(`Deleted ${deleted} of ${response.length} — see the notes below`);
      }
    } catch (error) {
      toast.error(extractError(error, 'Unable to delete accounts — nothing was changed'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Clear Unused Accounts"
      description="These accounts have no journal activity and aren't used by any rule, cash account, entity, document, budget or mapping. Deleting them is permanent — untick anything you want to keep."
      width="max-w-3xl"
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={isPending}>
            Close
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            disabled={selected.length === 0}
            isLoading={isPending}
            loadingText="Deleting…"
          >
            Delete {selected.length > 0 ? selected.length : ''} account
            {selected.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pt-3">
        {isLoading && <p className="text-sm text-gray-500">Checking which accounts are unused…</p>}
        {isError && <p className="text-sm text-red-600">Unable to load unused accounts.</p>}
        {!isLoading && !isError && unused.length === 0 && (
          <p className="text-sm text-gray-500">There are no unused accounts to clear.</p>
        )}

        {unused.length > 0 && (
          <>
            <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-gray-700">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              Select all ({unused.length})
            </label>

            <div className="max-h-96 overflow-auto rounded-lg border border-gray-100">
              {CATEGORIES.map((category) => {
                const rows = unused.filter((a) => a.category === category.value);
                if (rows.length === 0) return null;
                return (
                  <div key={category.value}>
                    <div className="sticky top-0 z-10 bg-gray-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      {category.label} · {rows.length}
                    </div>
                    {rows.map((account) => {
                      const result = results[account.id];
                      const isDeleted = result?.status === 'deleted';
                      return (
                        <label
                          key={account.id}
                          className="flex cursor-pointer items-start gap-3 border-t border-gray-100 px-3 py-2 text-xs"
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={!kept[account.id] && !isDeleted}
                            disabled={isDeleted}
                            onChange={() => toggle(account.id)}
                          />
                          <span className="w-20 shrink-0 font-mono text-gray-700">
                            {account.code}
                          </span>
                          <span className="flex-1 text-gray-800">{account.name}</span>
                          <span className="text-gray-400">
                            {account.accountGroup?.name ?? account.classification?.name ?? ''}
                          </span>
                          {result && (
                            <span
                              className={isDeleted ? 'text-green-600' : 'text-red-600'}
                              title={result.message}
                            >
                              {isDeleted ? 'Deleted' : (result.message ?? result.status)}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
