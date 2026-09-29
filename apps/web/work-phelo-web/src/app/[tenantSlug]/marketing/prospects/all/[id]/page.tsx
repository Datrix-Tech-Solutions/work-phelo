'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Pencil, Trash2, UserCheck } from 'lucide-react';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { ProspectBreadcrumb } from '@/components/molecules/marketing/ProspectBreadcrumb';
import { ConfirmDeleteProspectModal } from '@/components/molecules/marketing/ConfirmDeleteProspectModal';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { DetailField } from '@/components/atoms/DetailField';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { Skeleton } from '@/components/atoms/Skeleton';
import { AddInteractionPanel } from '@/components/organisms/marketing/AddInteractionPanel';
import { ConvertToClientModal } from '@/components/organisms/marketing/ConvertToClientModal';
import { InteractionDetailPanel } from '@/components/organisms/marketing/InteractionDetailPanel';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import type { ProspectDetailInteraction, ProspectDetailProduct } from '@/types/marketing';
import { useDeleteProspect, useProspect } from '@/hooks/marketing/useProspects';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';

function formatMoney(value: string | null): string {
  if (value == null) return '—';
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const PRODUCT_COLUMNS: Column<ProspectDetailProduct>[] = [
  { key: 'product', label: 'Product', render: (row) => row.product.name },
  {
    key: 'expectedValue',
    label: 'Expected Revenue',
    render: (row) => formatMoney(row.expectedValue),
  },
  {
    key: 'achievedValue',
    label: 'Achieved Revenue',
    render: (row) => formatMoney(row.achievedValue),
  },
  {
    key: 'expectedCloseDate',
    label: 'Expected Close Date',
    render: (row) => formatDate(row.expectedCloseDate),
  },
];

const INTERACTION_COLUMNS: Column<ProspectDetailInteraction>[] = [
  { key: 'occurredAt', label: 'Date', width: '160px', render: (row) => formatDate(row.occurredAt) },
  {
    key: 'interactionMedium',
    label: 'Medium',
    width: '200px',
    render: (row) => row.interactionMedium?.name ?? '—',
  },
  {
    key: 'decisionMaker',
    label: 'Decision Maker Met',
    width: '200px',
    render: (row) => row.decisionMaker?.name ?? '—',
  },
  {
    key: 'decisionMakerName',
    label: 'Decision Maker Name',
    width: 'minmax(200px, 1fr)',
    render: (row) => row.decisionMakerName || '—',
  },
  { key: 'notes', label: 'Notes', width: 'minmax(200px, 1fr)', render: (row) => row.notes || '—' },
];

type ProspectTab = 'products' | 'interactions';

export default function ProspectDetailPage() {
  const { tenantSlug, id } = useParams<{ tenantSlug: string; id: string }>();
  const router = useRouter();
  const toast = useToast();

  const { data: prospect, isLoading, isError } = useProspect(id);
  const deleteProspect = useDeleteProspect();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [viewingInteraction, setViewingInteraction] = useState<ProspectDetailInteraction | null>(
    null,
  );
  const [convertingToClient, setConvertingToClient] = useState(false);
  const [addingInteraction, setAddingInteraction] = useState(false);
  const [activeTab, setActiveTab] = useState<ProspectTab>('products');

  const listHref = `/${tenantSlug}/marketing/prospects/all`;
  const shell = cn(pageContent, 'flex-1 min-h-0 overflow-y-auto flex flex-col gap-6');

  if (isLoading) {
    return (
      <div className={shell}>
        <ProspectBreadcrumb tenantSlug={tenantSlug} prospectName="Loading…" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !prospect) {
    return (
      <div className={shell}>
        <ProspectBreadcrumb tenantSlug={tenantSlug} prospectName="Prospect" />
        <p className="text-sm text-red-500 text-center py-8">Failed to load prospect.</p>
      </div>
    );
  }

  const primaryContact = prospect.contacts.find((c) => c.isPrimary) ?? prospect.contacts[0];
  const lastInteraction = prospect.interactions.reduce<string | null>(
    (latest, i) => (latest === null || i.occurredAt > latest ? i.occurredAt : latest),
    null,
  );

  function handleDelete() {
    deleteProspect.mutate(id, {
      onSuccess: () => {
        toast.success('Prospect deleted');
        router.push(listHref);
      },
      onError: (error) => {
        setConfirmingDelete(false);
        toast.error(apiErrorMessage(error, 'Failed to delete prospect'));
      },
    });
  }

  return (
    <div className={shell}>
      <div className="flex items-center justify-between gap-4">
        <ProspectBreadcrumb tenantSlug={tenantSlug} prospectName={prospect.companyName} />
        <div className="flex items-center gap-3">
          {prospect.progress >= 100 && (
            <Button
              variant="outline"
              icon={<UserCheck className="w-4 h-4" />}
              onClick={() => setConvertingToClient(true)}
            >
              Convert to Client
            </Button>
          )}
          <Button
            variant="outline"
            icon={<Trash2 className="w-4 h-4" />}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete
          </Button>
          <Button
            icon={<Pencil className="w-4 h-4" />}
            onClick={() => router.push(`${listHref}/${id}/edit`)}
          >
            Edit
          </Button>
        </div>
      </div>

      <CollapsibleOverview
        title="Overview"
        headerExtra={<Badge label={prospect.salesStage.name} variant="info" />}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
          <DetailField label="Company Name" value={prospect.companyName} />
          <DetailField label="Type of Business" value={prospect.businessType?.name} />
          <DetailField label="Source Type" value={prospect.sourceType?.name} />
          <DetailField label="Location" value={prospect.location.label} />
          <DetailField label="Contact Person" value={primaryContact?.name} />
          <DetailField label="Role / Job Title" value={primaryContact?.decisionMaker?.name} />
          <DetailField label="Phone" value={primaryContact?.phone} />
          <DetailField label="Email" value={primaryContact?.email} />
          <DetailField label="Last Interaction" value={formatDate(lastInteraction)} />
          <DetailField label="Total Expected" value={formatMoney(prospect.totalExpectedValue)} />
          <DetailField label="Total Achieved" value={formatMoney(prospect.totalAchievedValue)} />
          <div className="col-span-2 flex flex-col gap-1.5">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
              Progress
            </span>
            <ProgressBar value={prospect.progress} />
          </div>
        </div>
      </CollapsibleOverview>

      <TabBar
        tabs={[
          { key: 'products', label: 'Products / Services' },
          { key: 'interactions', label: 'Interactions' },
        ]}
        activeTab={activeTab}
        onTabChange={(t) => setActiveTab(t as ProspectTab)}
      />

      {activeTab === 'products' && (
        <DataTable
          columns={PRODUCT_COLUMNS}
          data={prospect.products}
          emptyMessage="No products on record"
          currentPage={1}
          totalPages={0}
          onPageChange={() => {}}
          noInternalScroll
        />
      )}

      {activeTab === 'interactions' && (
        <DataTable
          columns={INTERACTION_COLUMNS}
          data={prospect.interactions}
          emptyMessage="No interactions yet"
          onRowClick={setViewingInteraction}
          actionButton={{ label: 'Add Interaction', onClick: () => setAddingInteraction(true) }}
          currentPage={1}
          totalPages={0}
          onPageChange={() => {}}
          noInternalScroll
        />
      )}

      <ConvertToClientModal
        prospect={prospect}
        isOpen={convertingToClient}
        onClose={() => setConvertingToClient(false)}
      />

      <InteractionDetailPanel
        interaction={viewingInteraction}
        onClose={() => setViewingInteraction(null)}
      />

      <AddInteractionPanel
        prospectId={id}
        primaryContact={
          primaryContact && {
            name: primaryContact.name,
            decisionMakerId: primaryContact.decisionMaker?.id,
          }
        }
        isOpen={addingInteraction}
        onClose={() => setAddingInteraction(false)}
      />

      {confirmingDelete && (
        <ConfirmDeleteProspectModal
          name={prospect.companyName}
          isDeleting={deleteProspect.isPending}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
