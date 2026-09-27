'use client';

import { useMemo, useState } from 'react';
import { TableButton } from '@/components/atoms/TableButton';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { SourceLedgerPanel } from '@/components/organisms/accounting/panels/SourceLedgerPanel';
import { useLinkSourceType, useSourceTypes, useUnlinkSourceType } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import type { SourceModule, SourceTypeDefinition } from '@/types/accounting';

const MODULE_LABELS: Record<SourceModule, string> = {
  HR: 'HR',
  MARKETING: 'Marketing',
  ACCOUNTING: 'Accounting',
  RECRUITMENT: 'Recruitment',
  OPERATIONS: 'Operations',
};

export function SourceTypesTable() {
  const { data = [], isLoading } = useSourceTypes();
  const { mutate: link } = useLinkSourceType();
  const { mutate: unlink } = useUnlinkSourceType();
  const toast = useToast();
  const [manageTarget, setManageTarget] = useState<SourceTypeDefinition | null>(null);
  const [ledgerTarget, setLedgerTarget] = useState<SourceTypeDefinition | null>(null);

  const sorted = useMemo(
    () =>
      [...data].sort(
        (a, b) =>
          MODULE_LABELS[a.module].localeCompare(MODULE_LABELS[b.module]) ||
          a.name.localeCompare(b.name),
      ),
    [data],
  );

  const toggle = (item: SourceTypeDefinition) => {
    const action = item.isActive ? unlink : link;
    action(item.id, {
      onError: (error) =>
        toast.error(extractError(error, `Unable to ${item.isActive ? 'unlink' : 'link'}`)),
    });
  };

  const columns: Column<SourceTypeDefinition>[] = [
    {
      key: 'source',
      label: 'Source',
      width: '200px',
      render: (row) => (
        <span className="font-medium text-gray-900">{MODULE_LABELS[row.module]}</span>
      ),
    },
    {
      key: 'service',
      label: 'Service',
      width: 'minmax(140px, 1fr)',
      render: (row) => <span className="text-gray-700">{row.name}</span>,
    },
    {
      key: 'journalEntries',
      label: 'Journal Entries',
      width: '140px',
      className: 'text-right',
      render: () => <span className="text-gray-400">—</span>,
    },
    {
      key: 'payments',
      label: 'Payments',
      width: '120px',
      className: 'text-right',
      render: () => <span className="text-gray-400">—</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 'minmax(140px, 1fr)',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <TableButton variant="blue" onClick={() => setLedgerTarget(row)}>
            View Ledger
          </TableButton>
          <TableButton variant="blue" onClick={() => setManageTarget(row)}>
            Manage
          </TableButton>
          <TableButton variant={row.isActive ? 'red' : 'green'} onClick={() => toggle(row)}>
            {row.isActive ? 'Unlink' : 'Link'}
          </TableButton>
        </div>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={sorted}
        isLoading={isLoading}
        emptyMessage="No sources linked yet — entries show up here automatically once another module (like Payroll) completes its own accounting setup."
        noInternalScroll
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
      />

      <SidePanel
        isOpen={!!manageTarget}
        onClose={() => setManageTarget(null)}
        title={manageTarget ? `Manage ${manageTarget.name}` : 'Manage'}
        description={
          manageTarget
            ? `${MODULE_LABELS[manageTarget.module]} — ${manageTarget.name} integration`
            : undefined
        }
      >
        <p className="text-sm text-gray-500">
          This will surface {manageTarget ? MODULE_LABELS[manageTarget.module] : 'the module'}
          &apos;s own integration setup here — the same settings screen it manages from its own
          module, opened in place instead of navigating away.
        </p>
      </SidePanel>

      <SourceLedgerPanel sourceType={ledgerTarget} onClose={() => setLedgerTarget(null)} />
    </>
  );
}
