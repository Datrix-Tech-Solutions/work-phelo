'use client';

import { useState } from 'react';
import { DataCardGrid } from '@/components/organisms/shared/DataCardGrid';
import { SearchSelect } from '@/components/atoms/SearchSelect';
import { TransportOfficerCard } from '@/components/molecules/marketing/TransportOfficerCard';
import { AddTransportOfficersPanel } from '@/components/organisms/marketing/AddTransportOfficersPanel';
import {
  useSetTransportOfficerActive,
  useTransportOfficers,
} from '@/hooks/marketing/useTransportOfficers';
import { usePermissionRule } from '@/hooks/hr/usePermission';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';
import type { TransportOfficersQuery } from '@/types/marketing';

const PAGE_SIZE = 12;

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

export default function TransportOfficerDetailsPage() {
  const toast = useToast();
  const canCreate = usePermissionRule('marketing.transport-officers:CREATE');
  const canEdit = usePermissionRule('marketing.transport-officers:EDIT');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);

  const { data, isLoading, isError } = useTransportOfficers({
    page,
    limit: PAGE_SIZE,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(status ? { status: status as TransportOfficersQuery['status'] } : {}),
  });
  const setActive = useSetTransportOfficerActive();

  if (isError) {
    return (
      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto')}>
        <p className="text-sm text-red-500 text-center py-8">Failed to load transport officers.</p>
      </div>
    );
  }

  return (
    <>
      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto')}>
        <DataCardGrid
          data={data?.data ?? []}
          isLoading={isLoading}
          searchPlaceholder="Search officers…"
          searchValue={search}
          onSearch={(q) => {
            setSearch(q);
            setPage(1);
          }}
          extraFilters={
            <SearchSelect
              size="sm"
              placeholder="Status"
              allLabel="All statuses"
              options={STATUS_OPTIONS}
              value={status}
              showAllOption
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
            />
          }
          actionButton={
            canCreate ? { label: 'Add Officer', onClick: () => setAddOpen(true) } : undefined
          }
          emptyMessage={
            search || status
              ? 'No transport officers found'
              : 'No transport officers yet — add employees who will drive'
          }
          currentPage={page}
          totalPages={Math.max(1, data?.meta.totalPages ?? 1)}
          onPageChange={setPage}
          renderCard={(officer) => (
            <TransportOfficerCard
              officer={officer}
              onToggleActive={
                canEdit
                  ? () =>
                      setActive.mutate(
                        { id: officer.id, active: !officer.isActive },
                        {
                          onSuccess: (result) => {
                            if (officer.isActive && result.upcomingTrips > 0) {
                              toast.success(
                                `${officer.name} deactivated. ${result.upcomingTrips} approved upcoming trip${result.upcomingTrips === 1 ? ' still lists' : 's still list'} them as driver.`,
                              );
                            } else {
                              toast.success(
                                officer.isActive ? 'Officer deactivated' : 'Officer reactivated',
                              );
                            }
                          },
                          onError: (error) =>
                            toast.error(apiErrorMessage(error, 'Failed to update officer')),
                        },
                      )
                  : undefined
              }
            />
          )}
        />
      </div>

      <AddTransportOfficersPanel isOpen={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}
