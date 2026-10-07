'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowRightLeft, UserCheck } from 'lucide-react';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { ProspectBreadcrumb } from '@/components/molecules/marketing/ProspectBreadcrumb';
import { ConfirmDeleteProspectModal } from '@/components/molecules/marketing/ConfirmDeleteProspectModal';
import { Button } from '@/components/atoms/Button';
import { Badge } from '@/components/atoms/Badge';
import { TypeChip, type TypeChipColor } from '@/components/atoms/TypeChip';
import { useAuthStore } from '@/store/auth.store';
import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { DetailField } from '@/components/atoms/DetailField';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { ProgressBar } from '@/components/atoms/ProgressBar';
import { Skeleton } from '@/components/atoms/Skeleton';
import { AddInteractionPanel } from '@/components/organisms/marketing/AddInteractionPanel';
import { ProspectManageMenu } from '@/components/molecules/marketing/ProspectManageMenu';
import { EditProspectProductsModal } from '@/components/organisms/marketing/EditProspectProductsModal';
import { EditProspectCompanyModal } from '@/components/organisms/marketing/EditProspectCompanyModal';
import { ChangeProspectLocationModal } from '@/components/organisms/marketing/ChangeProspectLocationModal';
import { EditPrimaryContactModal } from '@/components/organisms/marketing/EditPrimaryContactModal';
import { ProspectInteractionTimeline } from '@/components/molecules/marketing/ProspectInteractionTimeline';
import { UpdateProspectStageModal } from '@/components/organisms/marketing/UpdateProspectStageModal';
import { ConvertToClientModal } from '@/components/organisms/marketing/ConvertToClientModal';
import { DataCardGrid } from '@/components/organisms/shared/DataCardGrid';
import { ProspectProductCard } from '@/components/molecules/marketing/ProspectProductCard';
import { DataTable, Column } from '@/components/organisms/shared/DataTable';
import type { FollowUpStatus, ProspectFollowUp } from '@/types/marketing';
import { useFollowUpWorklist, useProspectFollowUps } from '@/hooks/marketing/useFollowUps';
import { useDeleteProspect, useProspect, useUpdateProspect } from '@/hooks/marketing/useProspects';
import { usePermissionRule } from '@/hooks/hr/usePermission';
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

const FOLLOW_UP_STATUS: Record<FollowUpStatus, { label: string; color: TypeChipColor }> = {
  PENDING: { label: 'Pending', color: 'amber' },
  COMPLETED: { label: 'Completed', color: 'green' },
  CANCELLED: { label: 'Cancelled', color: 'gray' },
};

const FOLLOW_UP_COLUMNS: Column<ProspectFollowUp>[] = [
  {
    key: 'dueAt',
    label: 'Due Date',
    width: '160px',
    render: (row) => <span className="font-semibold">{formatDate(row.dueAt)}</span>,
  },
  {
    key: 'status',
    label: 'Status',
    width: '140px',
    render: (row) => (
      <TypeChip
        label={FOLLOW_UP_STATUS[row.status].label}
        color={FOLLOW_UP_STATUS[row.status].color}
      />
    ),
  },
  {
    key: 'note',
    label: 'Note',
    width: 'minmax(160px, 1fr)',
    render: (row) => <span className="font-semibold">{row.note || '—'}</span>,
  },
  {
    key: 'completedAt',
    label: 'Completed On',
    width: '160px',
    render: (row) => <span className="font-semibold">{formatDate(row.completedAt)}</span>,
  },
  {
    key: 'createdAt',
    label: 'Scheduled On',
    width: '160px',
    render: (row) => <span className="font-semibold">{formatDate(row.createdAt)}</span>,
  },
];

type ProspectTab = 'products' | 'interactions' | 'follow-ups';

export default function ProspectDetailPage() {
  const { tenantSlug, id } = useParams<{ tenantSlug: string; id: string }>();
  const router = useRouter();
  const toast = useToast();

  const { data: prospect, isLoading, isError } = useProspect(id);
  const updateProspect = useUpdateProspect(id);
  // The assignee can convert their own prospect; the permission extends that to others' prospects.
  const currentUserId = useAuthStore((s) => s.user?.id);
  const hasCreateClientPermission = usePermissionRule('marketing.clients:CREATE');
  const canCreateClient =
    hasCreateClientPermission || (!!prospect && prospect.assignedUserId === currentUserId);
  const deleteProspect = useDeleteProspect();
  const { data: followUps = [], isLoading: followUpsLoading } = useProspectFollowUps(id);
  const { data: worklist = [] } = useFollowUpWorklist();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [convertingToClient, setConvertingToClient] = useState(false);
  const [updatingStage, setUpdatingStage] = useState(false);
  const [editingProducts, setEditingProducts] = useState(false);
  const [editingCompany, setEditingCompany] = useState(false);
  const [changingLocation, setChangingLocation] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
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
          {prospect.progress >= 100 && !prospect.clientId && canCreateClient && (
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
            icon={<ArrowRightLeft className="w-4 h-4" />}
            onClick={() => setUpdatingStage(true)}
          >
            Update Stage
          </Button>
          <ProspectManageMenu
            items={[
              { label: 'Manage Products', onClick: () => setEditingProducts(true) },
              { label: 'Edit Company Details', onClick: () => setEditingCompany(true) },
              { label: 'Change Location', onClick: () => setChangingLocation(true) },
              { label: 'Edit Primary Contact', onClick: () => setEditingContact(true) },
              { label: 'Delete Prospect', onClick: () => setConfirmingDelete(true), danger: true },
            ]}
          />
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
          <DetailField label="Assigned To" value={prospect.assignedUserName} />
          <DetailField label="Location" value={prospect.location.label} />
          {/* <DetailField label="Decision Maker" value={primaryContact?.name} /> */}
          <DetailField label="Decision Maker Role" value={primaryContact?.decisionMaker?.name} />
          <DetailField label="Primary Contact" value={primaryContact?.name} />
          <DetailField label="Primary Contact Phone" value={primaryContact?.phone} />
          <DetailField label="Primary Contact Email" value={primaryContact?.email} />
          <DetailField label="Date Created" value={formatDate(prospect.createdAt)} />
          <DetailField label="Last Interaction" value={formatDate(lastInteraction)} />
          <DetailField label="Total Expected" value={formatMoney(prospect.totalExpectedValue)} />
          {/* <DetailField label="Total Achieved" value={formatMoney(prospect.totalAchievedValue)} /> */}
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
          { key: 'interactions', label: 'Follow ups' },
          // { key: 'follow-ups', label: 'Follow-ups' },
        ]}
        activeTab={activeTab}
        onTabChange={(t) => setActiveTab(t as ProspectTab)}
      />

      {activeTab === 'products' && (
        <DataCardGrid
          data={prospect.products}
          renderCard={(product) => <ProspectProductCard product={product} />}
          emptyMessage="No products on record"
          currentPage={1}
          totalPages={0}
          onPageChange={() => {}}
        />
      )}

      {activeTab === 'interactions' && (
        <ProspectInteractionTimeline
          interactions={prospect.interactions}
          onAdd={() => setAddingInteraction(true)}
          upcoming={worklist.find((w) => w.prospectId === id)}
        />
      )}

      {activeTab === 'follow-ups' && (
        <DataTable
          columns={FOLLOW_UP_COLUMNS}
          data={followUps}
          emptyMessage="No follow-ups yet"
          isLoading={followUpsLoading}
          currentPage={1}
          totalPages={0}
          onPageChange={() => {}}
          noInternalScroll
        />
      )}

      <UpdateProspectStageModal
        key={prospect.salesStage.id}
        prospectId={id}
        prospectName={prospect.companyName}
        currentStageId={prospect.salesStage.id}
        isOpen={updatingStage}
        onClose={() => setUpdatingStage(false)}
      />

      {editingProducts && (
        <EditProspectProductsModal
          prospectId={id}
          prospectName={prospect.companyName}
          products={prospect.products}
          isOpen
          onClose={() => setEditingProducts(false)}
        />
      )}

      {editingCompany && (
        <EditProspectCompanyModal
          currentAssignedUserId={prospect.assignedUserId}
          currentAssignedUserName={prospect.assignedUserName}
          prospectId={id}
          prospectName={prospect.companyName}
          currentBusinessTypeId={prospect.businessType?.id ?? ''}
          currentSourceTypeId={prospect.sourceType?.id ?? ''}
          isOpen
          onClose={() => setEditingCompany(false)}
        />
      )}

      {changingLocation && (
        <ChangeProspectLocationModal
          prospectId={id}
          prospectName={prospect.companyName}
          currentLocation={prospect.location}
          isOpen
          onClose={() => setChangingLocation(false)}
        />
      )}

      {editingContact && (
        <EditPrimaryContactModal
          companyName={prospect.companyName}
          current={{
            name: primaryContact?.name ?? '',
            phone: primaryContact?.phone ?? null,
            email: primaryContact?.email ?? null,
            roleId: primaryContact?.decisionMaker?.id ?? '',
          }}
          isOpen
          isSaving={updateProspect.isPending}
          onClose={() => setEditingContact(false)}
          onSave={(changes) =>
            updateProspect.mutate(
              { primaryContact: changes },
              {
                onSuccess: () => {
                  toast.success('Primary contact updated');
                  setEditingContact(false);
                },
                onError: (error) =>
                  toast.error(apiErrorMessage(error, 'Failed to update primary contact')),
              },
            )
          }
        />
      )}

      <ConvertToClientModal
        prospect={prospect}
        isOpen={convertingToClient}
        onClose={() => setConvertingToClient(false)}
      />

      <AddInteractionPanel
        prospectId={id}
        primaryContact={
          primaryContact && {
            name: primaryContact.name,
            phone: primaryContact.phone,
            role: primaryContact.decisionMaker?.name,
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
