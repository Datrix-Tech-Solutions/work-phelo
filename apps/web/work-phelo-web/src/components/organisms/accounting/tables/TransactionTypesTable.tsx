'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Modal } from '@/components/organisms/shared/Modal';
import { DataTable, type Column } from '@/components/organisms/shared/DataTable';
import { TransactionTypePanel } from '@/components/organisms/accounting/panels/TransactionTypePanel';
import { TypeChip } from '@/components/atoms/TypeChip';
import { useDeleteTransactionType, useTransactionTypes } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import {
  TRANSACTION_TYPE_CATEGORY_CHIP_COLOR,
  TRANSACTION_TYPE_CATEGORY_LABEL,
} from '@/lib/accounting/transactionTypeCategory';
import type { TransactionTypeDefinition } from '@/types/accounting';

const PAGE_SIZE = 10;

export function TransactionTypesTable() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [panelTarget, setPanelTarget] = useState<TransactionTypeDefinition | null | undefined>(
    undefined,
  );
  const [deleteTarget, setDeleteTarget] = useState<TransactionTypeDefinition | null>(null);
  const { data = [], isLoading } = useTransactionTypes();
  const deleteTransactionType = useDeleteTransactionType();
  const toast = useToast();

  // Only Receivable/Payable types are usable from New Transaction today — Neutral/None
  // types (Transfer, Bank Charge, Adjustment) have no working form yet, so keep them out
  // of this list rather than show entries that lead nowhere.
  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return data
      .filter((item) => item.category === 'RECEIVABLE' || item.category === 'PAYABLE')
      .filter(
        (item) =>
          !query ||
          item.code.toLowerCase().includes(query) ||
          item.name.toLowerCase().includes(query),
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [data, search]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<TransactionTypeDefinition>[] = [
    {
      key: 'code',
      label: 'Code',
      width: '100px',
      render: (row) => <span className="text-sm text-gray-700">{row.code}</span>,
    },
    {
      key: 'name',
      label: 'Name',
      width: 'minmax(120px, 1fr)',
      render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
    },
    {
      key: 'category',
      label: 'Category',
      width: '140px',
      render: (row) => (
        <TypeChip
          label={TRANSACTION_TYPE_CATEGORY_LABEL[row.category]}
          color={TRANSACTION_TYPE_CATEGORY_CHIP_COLOR[row.category]}
        />
      ),
    },
    {
      key: 'businessRoles',
      label: 'Business Roles',
      width: 'minmax(120px, 1fr)',
      render: (row) => (
        <span className="text-sm text-gray-700">
          {row.businessRoles.length ? row.businessRoles.join(', ') : 'Open'}
        </span>
      ),
    },
    {
      key: 'source',
      label: 'Source',
      width: '120px',
      render: (row) => <span className="text-sm text-gray-700">{row.source ?? 'Manual'}</span>,
    },
    {
      key: 'rules',
      label: 'Rules',
      width: '90px',
      render: (row) => (
        <span className="text-sm text-gray-700">
          {row.rulesCount > 0 ? row.rulesCount : 'None'}
        </span>
      ),
    },
  ];

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteTransactionType.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
      onError: (error) => toast.error(extractError(error, 'Unable to delete transaction type')),
    });
  };

  return (
    <>
      <DataTable
        columns={columns}
        data={paged}
        isLoading={isLoading}
        searchPlaceholder="Search transaction types…"
        searchValue={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        actionButton={{ label: 'Add Transaction Type', onClick: () => setPanelTarget(null) }}
        rowActions={(row) => [
          { label: 'Update', onClick: () => setPanelTarget(row) },
          { label: 'Delete', danger: true, onClick: () => setDeleteTarget(row) },
        ]}
        emptyMessage="No transaction types found"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
      <TransactionTypePanel
        transactionType={panelTarget}
        onClose={() => setPanelTarget(undefined)}
      />
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Transaction Type"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This cannot be undone.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={deleteTransactionType.isPending}
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </div>
        }
      />
    </>
  );
}
