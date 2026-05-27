'use client';

import { useMemo, useState } from 'react';
import { Megaphone } from 'lucide-react';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { CreateAnnouncementPanel } from '@/components/organisms/announcements/CreateAnnouncementPanel';
import { useAnnouncementsPage } from '@/hooks';
import { usePermission } from '@/hooks/hr/usePermission';
import { Permission } from '@/lib/permissionMap';
import type { Announcement } from '@/types/hr';

interface AnnouncementRow {
  id: string;
  title: string;
  message: string;
  expiresAt?: string | null;
  notifyEmail: boolean;
}

const COLUMNS: Column<AnnouncementRow>[] = [
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
        {row.expiresAt
          ? new Date(row.expiresAt).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : 'No expiry'}
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
  const canReadAnnouncements = usePermission(Permission.READ_ANNOUNCEMENTS);
  const canManageAnnouncements = usePermission(Permission.MANAGE_ANNOUNCEMENTS);
  const canAccessAnnouncements = canReadAnnouncements || canManageAnnouncements;

  const { items, meta, isLoading } = useAnnouncementsPage({
    page,
    limit: 10,
    search: search || undefined,
    view: canManageAnnouncements ? 'all' : 'visible',
  });

  const rows = useMemo<AnnouncementRow[]>(
    () =>
      items.map((announcement: Announcement) => ({
        id: announcement.id,
        title: announcement.title,
        message: announcement.body,
        expiresAt: announcement.expiresAt,
        notifyEmail: announcement.sendEmail,
      })),
    [items],
  );

  return (
    <>
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Announcements</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {meta.total} announcement{meta.total !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <DataTable
        columns={COLUMNS}
        data={rows}
        isLoading={isLoading}
        emptyMessage="No announcements yet"
        emptyImage={
          <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center">
            <Megaphone className="w-7 h-7 text-gray-400" />
          </div>
        }
        searchPlaceholder="Search announcements…"
        searchValue={search}
        onSearch={(value) => {
          setSearch(value);
          setPage(1);
        }}
        actionButton={
          canManageAnnouncements
            ? { label: '+ New Announcement', onClick: () => setPanelOpen(true) }
            : undefined
        }
        currentPage={page}
        totalPages={Math.max(1, meta.totalPages)}
        onPageChange={setPage}
        noInternalScroll
      />

      {canAccessAnnouncements && canManageAnnouncements && (
        <CreateAnnouncementPanel isOpen={panelOpen} onClose={() => setPanelOpen(false)} />
      )}
    </>
  );
}
