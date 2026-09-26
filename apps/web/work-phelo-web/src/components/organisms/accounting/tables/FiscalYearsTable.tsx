'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import { Badge } from '@/components/atoms/Badge';
import { GenerateFiscalYearModal } from '@/components/organisms/accounting/modals/GenerateFiscalYearModal';
import { FiscalYear } from '@/types/accounting';
import { useFiscalYears, useGenerateFiscalYear } from '@/hooks';
import { useToast } from '@/hooks/useToast';
import { extractError } from '@/lib/extractError';
import { formatDate } from '@/lib/formatters';
import { FISCAL_STATUS_LABEL, FISCAL_STATUS_VARIANT } from '@/lib/accounting/fiscalPeriodStatus';

const COLUMNS: Column<FiscalYear>[] = [
  {
    key: 'name',
    label: 'Fiscal Year',
    width: 'minmax(150px, 1fr)',
    render: (row) => <span className="font-medium text-gray-900">{row.name}</span>,
  },
  {
    key: 'startDate',
    label: 'Start Date',
    width: '160px',
    render: (row) => <span className="text-sm text-gray-700">{formatDate(row.startDate)}</span>,
  },
  {
    key: 'endDate',
    label: 'End Date',
    width: '160px',
    render: (row) => <span className="text-sm text-gray-700">{formatDate(row.endDate)}</span>,
  },
  {
    key: 'progress',
    label: 'Periods Closed',
    width: '180px',
    render: (row) => (
      <span className="text-sm text-gray-700">
        {row.closedPeriodCount} of {row.periodCount}
      </span>
    ),
  },
  {
    key: 'status',
    label: 'Status',
    width: '150px',
    render: (row) => (
      <Badge label={FISCAL_STATUS_LABEL[row.status]} variant={FISCAL_STATUS_VARIANT[row.status]} />
    ),
  },
];

export function FiscalYearsTable() {
  const router = useRouter();
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const toast = useToast();
  const [generateOpen, setGenerateOpen] = useState(false);
  const { data: years = [], isLoading } = useFiscalYears();
  const generateYear = useGenerateFiscalYear();

  async function generate(year: number, startMonth: number) {
    try {
      const created = await generateYear.mutateAsync({ year, startMonth });
      toast.success(`Created ${created.name} with ${created.periodCount} periods`);
      setGenerateOpen(false);
    } catch (err) {
      toast.error(extractError(err, 'Failed to generate fiscal year'));
    }
  }

  return (
    <>
      <DataTable
        columns={COLUMNS}
        data={years}
        isLoading={isLoading}
        actionButton={{ label: 'Generate Fiscal Year', onClick: () => setGenerateOpen(true) }}
        onRowClick={(row) => router.push(`/${tenantSlug}/accounting/fiscal-year/${row.id}`)}
        emptyMessage="No fiscal years yet — generate one to get started"
        currentPage={1}
        totalPages={1}
        onPageChange={() => {}}
        noInternalScroll
      />

      <GenerateFiscalYearModal
        key={String(generateOpen)}
        isOpen={generateOpen}
        onClose={() => setGenerateOpen(false)}
        onGenerate={generate}
        isGenerating={generateYear.isPending}
      />
    </>
  );
}
