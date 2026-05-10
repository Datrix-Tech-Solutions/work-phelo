'use client';

import { useState } from 'react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { useAuditLogs } from '@/hooks';
import { AuditLog } from '@/types/tenant';

function formatTimestamp(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-gray-800 break-words">{value}</span>
    </div>
  );
}

function ChangesBlock({
  label,
  data,
}: {
  label: string;
  data: Record<string, unknown> | undefined;
}) {
  if (!data || Object.keys(data).length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
      <div className="rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 flex flex-col gap-1.5">
        {Object.entries(data).map(([k, v]) => (
          <div key={k} className="flex gap-2 text-sm">
            <span className="text-gray-500 shrink-0 w-32 truncate">{k}</span>
            <span className="text-gray-800 break-all">{String(v ?? '—')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AuditLogsTable() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AuditLog | null>(null);

  const { data, isLoading } = useAuditLogs();
  const logs: AuditLog[] = data?.logs ?? [];

  const columns: Column<AuditLog>[] = [
    {
      key: 'createdAt',
      label: 'Timestamp',
      width: '200px',
      render: (row) => (
        <span className="text-gray-700 tabular-nums">{formatTimestamp(row.createdAt)}</span>
      ),
    },
    {
      key: 'performedBy',
      label: 'User Name',
      render: (row) => (
        <span className="text-gray-700">
          {row.performedBy ?? <span className="text-gray-400">—</span>}
        </span>
      ),
    },
    {
      key: 'resource',
      label: 'Module',
      render: (row) => (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 capitalize">
          {row.resource}
        </span>
      ),
    },
    {
      key: 'action',
      label: 'Action',
      render: (row) => (
        <span className="text-gray-700 font-medium capitalize">{row.action.toLowerCase()}</span>
      ),
    },
    {
      key: 'view',
      label: 'View',
      width: '80px',
      render: (row) => (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSelected(row);
          }}
          className="text-sm font-semibold text-brand hover:text-brand/80 transition-colors"
        >
          View
        </button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={logs}
        isLoading={isLoading}
        emptyMessage="No audit log entries found"
        currentPage={page}
        totalPages={1}
        onPageChange={setPage}
      />

      <SidePanel
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title="Log Details"
        description={selected ? `${selected.resource} — ${selected.action.toLowerCase()}` : ''}
      >
        {selected && (
          <>
            <DetailRow label="ID" value={selected.id} />
            <DetailRow label="Timestamp" value={formatTimestamp(selected.createdAt)} />
            <DetailRow label="User" value={selected.performedBy ?? '—'} />
            <DetailRow label="Module" value={selected.resource} />
            <DetailRow label="Action" value={selected.action} />
            <ChangesBlock label="Before" data={selected.changes?.before} />
            <ChangesBlock label="After" data={selected.changes?.after} />
          </>
        )}
      </SidePanel>
    </>
  );
}
