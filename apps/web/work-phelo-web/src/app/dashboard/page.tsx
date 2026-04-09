//SUPER ADMIN PORTAL

'use client';

import { useState, useMemo } from 'react';
import { useTenants } from '@/hooks/useTenants';
import { useRouter } from 'next/navigation';
import { WelcomeBanner } from '@/components/organisms/WelcomeBanner';
import { StatCard } from '@/components/molecules/StatCard';
import { DataTable, Column } from '@/components/organisms/DataTable';
import { StatusBadge } from '@/components/molecules/StatusBadge';
import { AddCompanyForm } from '@/components/organisms/superadmin/AddCompanyForm';
import { useAuthStore } from '@/store/auth.store';
import { Company } from '@/types/tenant';

/* ── Icons ── */
const TotalCompaniesIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const ActiveIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);
const InactiveIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
    <line x1="18" y1="8" x2="23" y2="13" />
    <line x1="23" y1="8" x2="18" y2="13" />
  </svg>
);
const CalendarIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const PAGE_SIZE = 7;

const COLUMNS: Column<Company>[] = [
  { key: 'name', label: 'Company name', width: '2.5fr' },
  { key: 'dateCreated', label: 'Date Created', width: '1.2fr' },
  { key: 'contact', label: 'Contact Number', width: '1.2fr' },
  { key: 'industry', label: 'Industry', width: '1fr' },
  {
    key: 'status',
    label: 'Status',
    width: '1fr',
    render: (row) => <StatusBadge status={row.status} />,
  },
];

export default function AdminDashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [panelOpen, setPanelOpen] = useState(false);

  /* ── Fetch companies ── */
  const { data: apiData, isLoading } = useTenants();

  const allCompanies: Company[] = useMemo(() => {
    if (!apiData) return [];
    const list = apiData ?? [];
    return list.map((c: any) => ({
      id: c.id ?? c._id,
      name: c.name ?? c.companyName,
      dateCreated:
        (c.dateCreated ?? c.createdAt)
          ? new Date(String(c.dateCreated ?? c.createdAt)).toLocaleDateString('en-US', {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
            })
          : '—',
      contact: c.phone ?? c.contact ?? c.contactNumber ?? '—',
      industry: c.industry ?? '—',
      status: (c.status as Company['status']) ?? 'SUSPENDED',
    }));
  }, [apiData]);

  /* ── Client-side search / filter ── */
  const filtered = useMemo(() => {
    let data = allCompanies;
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (c) =>
          c.name?.toLowerCase().includes(q) ||
          c.contact?.includes(q) ||
          c.industry?.toLowerCase().includes(q),
      );
    }
    if (filter) data = data.filter((c) => c.status === filter);
    return data;
  }, [allCompanies, search, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /* ── Stats ── */
  const stats = useMemo(
    () => ({
      total: allCompanies.length,
      active: allCompanies.filter((c) => c.status === 'ACTIVE').length,
      inactive: allCompanies.filter((c) => c.status === 'SUSPENDED').length,
      newMonth: allCompanies.filter((c) => {
        const now = new Date();
        return (
          c.dateCreated.includes(now.getFullYear().toString()) &&
          c.dateCreated.includes(now.toLocaleString('en-US', { month: 'short' }))
        );
      }).length,
    }),
    [allCompanies],
  );

  const firstName = user?.firstName ?? 'Admin';

  return (
    <>
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-6 flex flex-col gap-6 min-h-0">
        {/* Welcome banner */}
        <WelcomeBanner userName={firstName} />

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Total Companies"
            value={isLoading ? null : stats.total}
            icon={<TotalCompaniesIcon />}
          />
          <StatCard title="Active" value={isLoading ? null : stats.active} icon={<ActiveIcon />} />
          <StatCard
            title="Suspended"
            value={isLoading ? null : stats.inactive}
            icon={<InactiveIcon />}
          />
          <StatCard
            title="New This Month"
            value={isLoading ? null : stats.newMonth}
            icon={<CalendarIcon />}
          />
        </div>

        {/* Companies table */}
        <div className="flex flex-col gap-4 flex-1 min-h-0">
          <h2 className="text-xl font-bold text-gray-900">Companies</h2>
          <DataTable
            columns={COLUMNS}
            data={pageData}
            isLoading={isLoading}
            searchPlaceholder="Search company name, phone, or industry..."
            onSearch={(q) => {
              setSearch(q);
              setPage(1);
            }}
            filterOptions={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
              { value: 'SUSPENDED', label: 'Suspended' },
              { value: 'PENDING', label: 'Pending' },
            ]}
            onFilter={(v) => {
              setFilter(v);
              setPage(1);
            }}
            onExport={() => console.log('export')}
            actionButton={{ label: 'New Company', onClick: () => setPanelOpen(true) }}
            rowActions={(row) => [
              { label: 'View', onClick: () => router.push(`/dashboard/${row.id}`) },
              { label: 'Deactivate', onClick: () => console.log('deact', row.id), danger: true },
            ]}
            emptyMessage="No companies onboarded"
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      </main>

      {/* Add Company side panel */}
      <AddCompanyForm isOpen={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  );
}
