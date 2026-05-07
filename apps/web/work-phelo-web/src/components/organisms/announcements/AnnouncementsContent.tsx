'use client';

import { useState } from 'react';
import { Megaphone } from 'lucide-react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { CreateAnnouncementPanel } from '@/components/organisms/announcements/CreateAnnouncementPanel';

interface Announcement {
  id: string;
  title: string;
  message: string;
  expiresAt: string;
  notifyEmail: boolean;
}

const COLUMNS: Column<Announcement>[] = [
  {
    key: 'title',
    label: 'Title',
    width: '1.5fr',
    render: (row) => <span className="font-medium text-gray-900">{row.title}</span>,
  },
  {
    key: 'message',
    label: 'Message',
    width: '2fr',
    render: (row) => <span className="text-gray-500 line-clamp-1">{row.message}</span>,
  },
  {
    key: 'expiresAt',
    label: 'Expires',
    width: '1fr',
    render: (row) => (
      <span className="text-gray-600">
        {new Date(row.expiresAt).toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </span>
    ),
  },
  {
    key: 'notifyEmail',
    label: 'Notify Email',
    width: '120px',
    render: (row) =>
      row.notifyEmail ? (
        <Badge label="Yes" variant="success" />
      ) : (
        <Badge label="No" variant="neutral" />
      ),
  },
];

export function AnnouncementsContent() {
  const [panelOpen, setPanelOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const announcements: Announcement[] = []; // TODO: replace with useAnnouncements hook

  const filtered = announcements.filter(
    (a) =>
      !search ||
      a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.message.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Announcements</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {filtered.length} announcement{filtered.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <DataTable
        columns={COLUMNS}
        data={filtered}
        emptyMessage="No announcements yet"
        emptyImage={
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <Megaphone className="w-7 h-7 text-gray-400" />
          </div>
        }
        searchPlaceholder="Search announcements…"
        searchValue={search}
        onSearch={setSearch}
        actionButton={{ label: '+ New Announcement', onClick: () => setPanelOpen(true) }}
        currentPage={page}
        totalPages={Math.max(1, Math.ceil(filtered.length / 10))}
        onPageChange={setPage}
      />

      <CreateAnnouncementPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}
