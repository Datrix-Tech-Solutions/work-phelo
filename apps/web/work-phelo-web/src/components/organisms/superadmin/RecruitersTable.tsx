'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { StatusBadge } from '@/components/molecules/shared/StatusBadge';
import { Column, DataTable } from '@/components/organisms/shared/DataTable';
import { Modal } from '@/components/organisms/shared/Modal';
import {
  useApproveTenant,
  useDeleteTenant,
  useSetTenantVerified,
  useSuspendTenant,
  useTenants,
} from '@/hooks/useTenants';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { toCompany } from '@/lib/tenantRows';
import type { Company } from '@/types/tenant';

const PAGE_SIZE = 7;

const COLUMNS: Column<Company>[] = [
  {
    key: 'name',
    label: 'Company name',
    width: '2.5fr',
    render: (row) => (
      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-900">{row.name}</span>
        {row.email && <span className="text-xs text-gray-400">{row.email}</span>}
      </div>
    ),
  },
  { key: 'dateCreated', label: 'Date Created', width: '1.2fr' },
  { key: 'industry', label: 'Industry', width: '1fr' },
  {
    key: 'isVerified',
    label: 'Verified',
    width: '1fr',
    render: (row) => (
      <Badge
        label={row.isVerified ? 'Verified' : 'Unverified'}
        variant={row.isVerified ? 'success' : 'neutral'}
      />
    ),
  },
  {
    key: 'status',
    label: 'Status',
    width: '1fr',
    render: (row) => <StatusBadge status={row.status} />,
  },
];

type Pending = { kind: 'block' | 'delete'; company: Company };

/** Companies that signed up on the careers site: verify, block, or remove them. */
export function RecruitersTable() {
  const router = useRouter();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<Pending | null>(null);

  const { data, isLoading } = useTenants('WEBSITE');
  const { mutate: setVerified } = useSetTenantVerified();
  const { mutate: suspend, isPending: isBlocking } = useSuspendTenant();
  const { mutate: approve } = useApproveTenant();
  const { mutate: deleteTenant, isPending: isDeleting } = useDeleteTenant();

  const recruiters = useMemo(() => (data ?? []).map(toCompany), [data]);

  const filtered = useMemo(() => {
    let rows = recruiters;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.industry.toLowerCase().includes(q),
      );
    }
    if (filter) rows = rows.filter((c) => c.status === filter);
    return rows;
  }, [recruiters, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const fail = (fallback: string) => (err: unknown) => toast.error(extractError(err, fallback));

  const toggleVerified = (company: Company) =>
    setVerified(
      { tenantId: company.id, isVerified: !company.isVerified },
      {
        onSuccess: () =>
          toast.success(
            company.isVerified
              ? `${company.name} is no longer verified`
              : `${company.name} is now verified`,
          ),
        onError: fail('Failed to update verification'),
      },
    );

  const unblock = (company: Company) =>
    approve(company.id, {
      onSuccess: () => toast.success(`${company.name} unblocked`),
      onError: fail('Failed to unblock recruiter'),
    });

  const confirm = () => {
    if (!pending) return;
    const { kind, company } = pending;
    const done = () => setPending(null);
    if (kind === 'block') {
      suspend(company.id, {
        onSuccess: () => {
          toast.success(`${company.name} blocked`);
          done();
        },
        onError: fail('Failed to block recruiter'),
      });
    } else {
      deleteTenant(company.id, {
        onSuccess: () => {
          toast.success(`${company.name} deleted`);
          done();
        },
        onError: fail('Failed to delete recruiter'),
      });
    }
  };

  const isBlock = pending?.kind === 'block';

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={pageData}
        isLoading={isLoading}
        searchPlaceholder="Search company name, email, or industry..."
        onSearch={(q) => {
          setSearch(q);
          setPage(1);
        }}
        onRowClick={(row) => router.push(`/dashboard/${row.id}`)}
        filterOptions={[
          { value: 'ACTIVE', label: 'Active' },
          { value: 'SUSPENDED', label: 'Blocked' },
        ]}
        onFilter={(v) => {
          setFilter(v);
          setPage(1);
        }}
        rowActions={(row) => [
          { label: 'View', onClick: () => router.push(`/dashboard/${row.id}`) },
          {
            label: row.isVerified ? 'Remove verification' : 'Verify',
            onClick: () => toggleVerified(row),
          },
          row.status === 'SUSPENDED'
            ? { label: 'Unblock', variant: 'success', onClick: () => unblock(row) }
            : {
                label: 'Block',
                danger: true,
                onClick: () => setPending({ kind: 'block', company: row }),
              },
          {
            label: 'Delete',
            danger: true,
            onClick: () => setPending({ kind: 'delete', company: row }),
          },
        ]}
        emptyMessage="No recruiters have signed up on the careers site yet"
        currentPage={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />

      <Modal
        isOpen={!!pending}
        onClose={() => setPending(null)}
        title={isBlock ? 'Block Recruiter' : 'Delete Recruiter'}
        description={
          isBlock
            ? `"${pending?.company.name}" will be signed out and cannot sign in, and their jobs are hidden from the careers site. You can unblock them later.`
            : `Are you sure you want to delete "${pending?.company.name}"? Their jobs are hidden from the careers site. This action cannot be undone.`
        }
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setPending(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isLoading={isBlock ? isBlocking : isDeleting}
              loadingText={isBlock ? 'Blocking...' : 'Deleting...'}
              onClick={confirm}
            >
              {isBlock ? 'Block' : 'Delete'}
            </Button>
          </div>
        }
      />
    </>
  );
}
