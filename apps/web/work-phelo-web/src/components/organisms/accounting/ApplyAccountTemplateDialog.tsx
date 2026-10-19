'use client';

import { useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Modal } from '@/components/organisms/shared/Modal';
import { Button } from '@/components/atoms/Button';
import {
  CHART_OF_ACCOUNTS_TEMPLATES,
  buildTemplatePayload,
  templateCounts,
} from '@/lib/accounting/chartOfAccountsTemplates';
import {
  CATEGORY_LABEL_BY_VALUE,
  CASH_FLOW_LABEL_BY_VALUE,
} from '@/lib/accounting/glAccountImportShared';
import { useBulkImportGLAccounts } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { AccountClassification, AccountGroup, GLAccount } from '@/types/accounting';

interface ApplyAccountTemplateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  classifications: AccountClassification[];
  groups: AccountGroup[];
  existingAccounts: GLAccount[];
  /** Opens the file import for a chart the user builds themselves. */
  onImportCustom: () => void;
}

const norm = (value: string) => value.trim().toLowerCase();

/** Two steps: pick a template, then look through everything it would add — laid out like the
 *  import preview — before applying it. Records whose code already exists are shown as such and
 *  left alone, so a template is safe to apply to a chart that's already in use. */
export function ApplyAccountTemplateDialog({
  isOpen,
  onClose,
  classifications,
  groups,
  existingAccounts,
  onImportCustom,
}: ApplyAccountTemplateDialogProps) {
  const toast = useToast();
  const { mutateAsync: bulkImport, isPending } = useBulkImportGLAccounts();
  const [viewingId, setViewingId] = useState<string | null>(null);

  const template = CHART_OF_ACCOUNTS_TEMPLATES.find((t) => t.id === viewingId);

  const preview = useMemo(() => {
    if (!template) return null;
    const taken = {
      classifications: new Set(classifications.map((c) => norm(c.code))),
      groups: new Set(groups.map((g) => norm(g.code))),
      accounts: new Set(existingAccounts.map((a) => norm(a.code))),
    };
    const all = buildTemplatePayload(template, { classifications: [], groups: [], accounts: [] });
    const payload = buildTemplatePayload(template, {
      classifications: classifications.map((c) => c.code),
      groups: groups.map((g) => g.code),
      accounts: existingAccounts.map((a) => a.code),
    });
    const parentName = new Map(all.groups.map((g) => [g.code, g.name]));
    return {
      payload,
      totalNew: payload.classifications.length + payload.groups.length + payload.accounts.length,
      classifications: all.classifications.map((c) => ({
        key: c.code,
        cells: [c.code, c.name, CATEGORY_LABEL_BY_VALUE[c.category], '—'],
        exists: taken.classifications.has(norm(c.code)),
      })),
      groups: all.groups.map((g) => ({
        key: g.code,
        cells: [g.code, g.name, `Classification ${g.classificationCode}`, '—'],
        exists: taken.groups.has(norm(g.code)),
      })),
      accounts: all.accounts.map((a) => ({
        key: a.code,
        cells: [
          a.code,
          a.name,
          a.parentAccountCode
            ? `${parentName.get(a.parentAccountCode) ?? a.parentAccountCode}`
            : `Classification ${a.classificationCode}`,
          a.cashFlowCategory ? CASH_FLOW_LABEL_BY_VALUE[a.cashFlowCategory] : '—',
        ],
        exists: taken.accounts.has(norm(a.code)),
      })),
    };
  }, [template, classifications, groups, existingAccounts]);

  const handleClose = () => {
    setViewingId(null);
    onClose();
  };

  const handleApply = async () => {
    if (!preview || preview.totalNew === 0) return;
    try {
      const response = await bulkImport(preview.payload);
      const results = [...response.classifications, ...response.groups, ...response.accounts];
      const created = results.filter((r) => r.status === 'created').length;
      const problems = results.filter((r) => r.status === 'failed');
      if (problems.length === 0) {
        toast.success(`Template applied — ${created} item${created === 1 ? '' : 's'} created`);
        handleClose();
      } else {
        toast.error(
          `Created ${created} of ${preview.totalNew}. ${problems[0].code}: ${problems[0].message ?? 'failed'}`,
        );
      }
    } catch (error) {
      toast.error(extractError(error, 'Unable to apply the template — nothing was created'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={template ? template.name : 'Templates'}
      description={
        template
          ? 'Review what this template adds. Anything you already have with the same code is kept as it is.'
          : 'Start your chart of accounts from a ready-made system template, or bring your own with a custom file. Open a template to see its accounts before anything is created.'
      }
      width="max-w-3xl"
      footer={
        template && preview ? (
          <div className="flex w-full items-center justify-between gap-3">
            <Button
              variant="outline"
              size="sm"
              icon={<ArrowLeft className="h-3.5 w-3.5" />}
              onClick={() => setViewingId(null)}
              disabled={isPending}
            >
              Back
            </Button>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleClose} disabled={isPending}>
                Cancel
              </Button>
              <Button
                onClick={handleApply}
                disabled={preview.totalNew === 0 || isPending}
                isLoading={isPending}
                loadingText="Applying…"
              >
                Apply {preview.totalNew > 0 ? preview.totalNew : ''} item
                {preview.totalNew === 1 ? '' : 's'}
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        )
      }
    >
      {template && preview ? (
        <div className="flex flex-col gap-4 pt-2">
          <p className="text-xs text-gray-500">
            {preview.totalNew === 0
              ? 'Everything in this template already exists in your chart.'
              : `${preview.totalNew} new item${preview.totalNew === 1 ? '' : 's'} will be created.`}
          </p>
          <PreviewSection
            title="Classifications"
            columns={['Code', 'Name', 'Type', 'Cash flow']}
            rows={preview.classifications}
          />
          <PreviewSection
            title="Parent Accounts"
            columns={['Code', 'Name', 'Under', 'Cash flow']}
            rows={preview.groups}
          />
          <PreviewSection
            title="Accounts"
            columns={['Code', 'Name', 'Under', 'Cash flow']}
            rows={preview.accounts}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3 pt-2">
          {CHART_OF_ACCOUNTS_TEMPLATES.map((t) => {
            const counts = templateCounts(t);
            return (
              <div
                key={t.id}
                className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4"
              >
                <div>
                  <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                  <p className="mt-1 text-xs text-gray-500">{t.description}</p>
                  <p className="mt-2 text-xs text-gray-400">
                    {counts.classifications} classifications · {counts.groups} parent accounts ·{' '}
                    {counts.accounts} accounts
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setViewingId(t.id)}>
                  View
                </Button>
              </div>
            );
          })}
          <div className="flex items-start justify-between gap-4 rounded-lg border border-dashed border-gray-300 p-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Custom</p>
              <p className="mt-1 text-xs text-gray-500">
                Your own chart of accounts. Download the spreadsheet template, fill it in, and
                upload it to create your classifications, parent accounts and accounts.
              </p>
              <p className="mt-2 text-xs text-gray-400">
                You review the rows before anything is created.
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={onImportCustom}>
              Import
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function PreviewSection({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: { key: string; cells: string[]; exists: boolean }[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h4>
      <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-100">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-gray-50 text-gray-500">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-3 py-2 font-semibold">
                  {col}
                </th>
              ))}
              <th className="px-3 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono text-gray-700">{row.cells[0]}</td>
                <td className="px-3 py-2 text-gray-700">{row.cells[1]}</td>
                <td className="px-3 py-2 text-gray-500">{row.cells[2]}</td>
                <td className="px-3 py-2 text-gray-500">{row.cells[3]}</td>
                <td className="px-3 py-2">
                  {row.exists ? (
                    <span className="text-gray-400">Already exists</span>
                  ) : (
                    <span className="text-green-600">New</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
