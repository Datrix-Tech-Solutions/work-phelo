'use client';

import { useMemo, useState } from 'react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import {
  CHART_OF_ACCOUNTS_TEMPLATES,
  buildTemplatePayload,
  templateCounts,
} from '@/lib/accounting/chartOfAccountsTemplates';
import { useBulkImportGLAccounts } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { cn } from '@/lib/utils';
import type { AccountClassification, AccountGroup, GLAccount } from '@/types/accounting';

interface ApplyAccountTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  classifications: AccountClassification[];
  groups: AccountGroup[];
  existingAccounts: GLAccount[];
}

/** Lets the tenant start their chart of accounts from a ready-made template. Records whose code
 *  already exists are left alone, so applying a template is safe on a chart that's already in use. */
export function ApplyAccountTemplateDialog({
  isOpen,
  onClose,
  classifications,
  groups,
  existingAccounts,
}: ApplyAccountTemplateDialogProps) {
  const toast = useToast();
  const { mutateAsync: bulkImport, isPending } = useBulkImportGLAccounts();
  const [selectedId, setSelectedId] = useState(CHART_OF_ACCOUNTS_TEMPLATES[0]?.id ?? '');

  const template = CHART_OF_ACCOUNTS_TEMPLATES.find((t) => t.id === selectedId);
  const payload = useMemo(
    () =>
      template
        ? buildTemplatePayload(template, {
            classifications: classifications.map((c) => c.code),
            groups: groups.map((g) => g.code),
            accounts: existingAccounts.map((a) => a.code),
          })
        : null,
    [template, classifications, groups, existingAccounts],
  );
  const totalNew = payload
    ? payload.classifications.length + payload.groups.length + payload.accounts.length
    : 0;

  const handleApply = async () => {
    if (!payload || totalNew === 0) return;
    try {
      const response = await bulkImport(payload);
      const results = [...response.classifications, ...response.groups, ...response.accounts];
      const created = results.filter((r) => r.status === 'created').length;
      const problems = results.filter((r) => r.status === 'failed');
      if (problems.length === 0) {
        toast.success(`Template applied — ${created} item${created === 1 ? '' : 's'} created`);
        onClose();
      } else {
        toast.error(
          `Created ${created} of ${totalNew}. ${problems[0].code}: ${problems[0].message ?? 'failed'}`,
        );
      }
    } catch (error) {
      toast.error(extractError(error, 'Unable to apply the template — nothing was created'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Use a Template"
      description="Start your chart of accounts from a ready-made template. Anything you already have with the same code is kept as it is."
      width="max-w-xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            disabled={totalNew === 0 || isPending}
            isLoading={isPending}
            loadingText="Applying…"
          >
            Apply template
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3 pt-2">
        {CHART_OF_ACCOUNTS_TEMPLATES.map((t) => {
          const counts = templateCounts(t);
          const active = t.id === selectedId;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSelectedId(t.id)}
              className={cn(
                'rounded-lg border p-4 text-left transition-colors',
                active ? 'border-brand bg-brand/5' : 'border-gray-200 hover:border-gray-300',
              )}
            >
              <p className="text-sm font-semibold text-gray-900">{t.name}</p>
              <p className="mt-1 text-xs text-gray-500">{t.description}</p>
              <p className="mt-2 text-xs text-gray-400">
                {counts.classifications} classifications · {counts.groups} parent accounts ·{' '}
                {counts.accounts} accounts
              </p>
            </button>
          );
        })}
        {template && (
          <p className="text-xs text-gray-500">
            {totalNew === 0
              ? 'Everything in this template already exists in your chart.'
              : `${totalNew} new item${totalNew === 1 ? '' : 's'} will be created.`}
          </p>
        )}
      </div>
    </Modal>
  );
}
