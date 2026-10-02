'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { TableButton } from '@/components/atoms/TableButton';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { SourceLedgerPanel } from '@/components/organisms/accounting/panels/SourceLedgerPanel';
import { SourceTypeManagePanel } from '@/components/organisms/accounting/panels/SourceTypeManagePanel';
import { useLinkSourceType, useSourceTypes, useUnlinkSourceType } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { SOURCE_MODULE_LABELS } from '@/lib/accounting/sourceModules';
import type { SourceTypeDefinition } from '@/types/accounting';

export function SourceTypesTable() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
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
          SOURCE_MODULE_LABELS[a.module].localeCompare(SOURCE_MODULE_LABELS[b.module]) ||
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
        <span className="font-medium text-gray-900">{SOURCE_MODULE_LABELS[row.module]}</span>
      ),
    },
    {
      key: 'service',
      label: 'Service',
      width: 'minmax(140px, 1fr)',
      render: (row) => <span className="text-gray-700">{row.name}</span>,
    },
    {
      key: 'entries',
      label: 'Entries',
      width: '100px',
      className: 'text-right',
      render: (row) => <span className="text-gray-700">{row.entryCount}</span>,
    },
    {
      key: 'paid',
      label: 'Paid',
      width: '120px',
      className: 'text-right',
      render: (row) =>
        row.entryCount === 0 ? (
          <span className="text-gray-400">—</span>
        ) : (
          <span
            className={
              row.paidCount === row.entryCount ? 'text-emerald-600 font-medium' : 'text-gray-700'
            }
          >
            {row.paidCount} / {row.entryCount}
          </span>
        ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 'minmax(140px, 1fr)',
      className: 'text-right',
      render: (row) => (
        <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <TableButton variant="green" onClick={() => setLedgerTarget(row)}>
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
        onRowClick={(row) =>
          router.push(`/${tenantSlug}/accounting/settings/source-types/${row.id}`)
        }
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
      />

      <SourceTypeManagePanel sourceType={manageTarget} onClose={() => setManageTarget(null)} />

      <SourceLedgerPanel sourceType={ledgerTarget} onClose={() => setLedgerTarget(null)} />
    </>
  );
}
