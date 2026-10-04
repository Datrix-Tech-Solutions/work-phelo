'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useLoadingRouter as useRouter } from '@/hooks/useLoadingRouter';
import { ClientBreadcrumb } from '@/components/molecules/marketing/ClientBreadcrumb';
import { ClientProductCard } from '@/components/molecules/marketing/ClientProductCard';
import { ConfirmDeleteProspectModal } from '@/components/molecules/marketing/ConfirmDeleteProspectModal';
import { ProspectManageMenu } from '@/components/molecules/marketing/ProspectManageMenu';
import { ProspectInteractionTimeline } from '@/components/molecules/marketing/ProspectInteractionTimeline';
import { AddInteractionPanel } from '@/components/organisms/marketing/AddInteractionPanel';
import { AddClientProductModal } from '@/components/organisms/marketing/AddClientProductModal';
import { ChangeClientDecisionMakerModal } from '@/components/organisms/marketing/ChangeClientDecisionMakerModal';
import { ChangeClientLocationModal } from '@/components/organisms/marketing/ChangeClientLocationModal';
import { ClientBillingModal } from '@/components/organisms/marketing/ClientBillingModal';
import { ClientTransactionsTab } from '@/components/organisms/marketing/ClientTransactionsTab';
import { EditClientCompanyModal } from '@/components/organisms/marketing/EditClientCompanyModal';
import { DataCardGrid } from '@/components/organisms/shared/DataCardGrid';
import { CollapsibleOverview } from '@/components/atoms/CollapsibleOverview';
import { DetailField } from '@/components/atoms/DetailField';
import { Skeleton } from '@/components/atoms/Skeleton';
import { TypeChip } from '@/components/atoms/TypeChip';
import { TabBar } from '@/components/molecules/shared/TabBar';
import { useClient, useClientBillingSummary, useDeleteClient } from '@/hooks/marketing/useClients';
import { useAnyPermissionRules } from '@/hooks/hr/usePermission';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { formatMoney } from '@/lib/formatMoney';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';

function formatDate(value: string | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

type ClientTab = 'products' | 'interactions' | 'transactions';

export default function ClientDetailPage() {
  const { tenantSlug, id } = useParams<{ tenantSlug: string; id: string }>();
  const router = useRouter();
  const toast = useToast();

  const { data: client, isLoading, isError } = useClient(id);
  const deleteClient = useDeleteClient();
  const canViewBilling = useAnyPermissionRules(['marketing.clients.billing:VIEW']);
  const canBill = useAnyPermissionRules(['marketing.clients.billing:CREATE']);
  const { data: billingSummary } = useClientBillingSummary(id, canViewBilling);
  const canEdit = useAnyPermissionRules(['marketing.clients:EDIT', 'marketing.clients.all:EDIT']);
  const canAddFollowUp = useAnyPermissionRules([
    'marketing.prospects.interactions:CREATE',
    'marketing.prospects.interactions.all:CREATE',
  ]);
  const canDelete = useAnyPermissionRules([
    'marketing.clients:DELETE',
    'marketing.clients.all:DELETE',
  ]);

  const [activeTab, setActiveTab] = useState<ClientTab>('products');
  const [addingProduct, setAddingProduct] = useState(false);
  const [addingFollowUp, setAddingFollowUp] = useState(false);
  const [billingOpen, setBillingOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState(false);
  const [changingLocation, setChangingLocation] = useState(false);
  const [changingDecisionMaker, setChangingDecisionMaker] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const listHref = `/${tenantSlug}/marketing/clients`;
  const shell = cn(pageContent, 'flex-1 min-h-0 overflow-y-auto flex flex-col gap-6');

  if (isLoading) {
    return (
      <div className={shell}>
        <ClientBreadcrumb tenantSlug={tenantSlug} clientName="Loading…" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !client) {
    return (
      <div className={shell}>
        <ClientBreadcrumb tenantSlug={tenantSlug} clientName="Client" />
        <p className="text-sm text-red-500 text-center py-8">Failed to load client.</p>
      </div>
    );
  }

  const primaryContact = client.contacts.find((c) => c.isPrimary) ?? client.contacts[0];
  const lastInteraction = client.interactions.reduce<string | null>(
    (latest, i) => (latest === null || i.occurredAt > latest ? i.occurredAt : latest),
    null,
  );
  const purchased = client.products.filter((p) => p.status === 'PURCHASED').length;
  const achievedByProduct = new Map(
    (billingSummary?.products ?? []).map((p) => [p.productId, p.achievedRevenue]),
  );
  // A transaction can be tagged to any product the client has, except one it isn't interested in.
  const billingProductOptions = client.products
    .filter((p) => p.status !== 'UNINTERESTED')
    .map((p) => ({ value: p.product.id, label: p.product.name }));

  const menuItems = [
    ...(canEdit
      ? [
          { label: 'Add Product', onClick: () => setAddingProduct(true) },
          { label: 'Edit Company Details', onClick: () => setEditingCompany(true) },
          { label: 'Change Location', onClick: () => setChangingLocation(true) },
          { label: 'Change Decision Maker', onClick: () => setChangingDecisionMaker(true) },
        ]
      : []),
    ...(canDelete
      ? [{ label: 'Delete Client', onClick: () => setConfirmingDelete(true), danger: true }]
      : []),
  ];

  function handleDelete() {
    deleteClient.mutate(id, {
      onSuccess: () => {
        toast.success('Client deleted');
        router.push(listHref);
      },
      onError: (error) => {
        setConfirmingDelete(false);
        toast.error(apiErrorMessage(error, 'Failed to delete client'));
      },
    });
  }

  return (
    <div className={shell}>
      <div className="flex items-center justify-between gap-4">
        <ClientBreadcrumb tenantSlug={tenantSlug} clientName={client.companyName} />
        {menuItems.length > 0 && <ProspectManageMenu items={menuItems} />}
      </div>

      <CollapsibleOverview
        title="Overview"
        headerExtra={
          <TypeChip
            label={client.isBillable ? 'Billable' : 'Non-billable'}
            color={client.isBillable ? 'green' : 'purple'}
          />
        }
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-6 gap-y-5">
          <DetailField label="Company Name" value={client.companyName} />
          <DetailField label="Type of Business" value={client.businessType?.name} />
          <DetailField label="Source Type" value={client.sourceType?.name} />
          <DetailField label="Location" value={client.location.label} />
          <DetailField label="Decision Maker Role" value={primaryContact?.decisionMaker?.name} />
          <DetailField label="Primary Contact" value={primaryContact?.name} />
          <DetailField label="Primary Contact Phone" value={primaryContact?.phone} />
          <DetailField label="Primary Contact Email" value={primaryContact?.email} />
          <DetailField
            label={client.convertedAt ? 'Converted On' : 'Date Created'}
            value={formatDate(client.convertedAt ?? client.createdAt)}
          />
          <DetailField label="Last Interaction" value={formatDate(lastInteraction)} />
          <DetailField
            label="Achieved Revenue"
            value={formatMoney(billingSummary?.achievedRevenue)}
          />
          <DetailField
            label="Products"
            value={
              client.products.length === 0
                ? '—'
                : `${client.products.length} (${purchased} purchased)`
            }
          />
          <DetailField
            label="Origin"
            value={client.convertedFromProspectId ? 'Converted from prospect' : 'Added directly'}
          />
        </div>
      </CollapsibleOverview>

      <TabBar
        tabs={[
          { key: 'products', label: 'Products / Services' },
          { key: 'interactions', label: 'Follow-ups' },
          ...(canViewBilling ? [{ key: 'transactions', label: 'Transaction History' }] : []),
        ]}
        activeTab={activeTab}
        onTabChange={(t) => setActiveTab(t as ClientTab)}
      />

      {activeTab === 'products' && (
        <DataCardGrid
          data={client.products}
          renderCard={(product) => (
            <ClientProductCard
              product={product}
              achievedRevenue={achievedByProduct.get(product.product.id)}
            />
          )}
          emptyMessage="No products on record"
          currentPage={1}
          totalPages={0}
          onPageChange={() => {}}
        />
      )}

      {activeTab === 'interactions' && (
        <ProspectInteractionTimeline
          interactions={client.interactions}
          addLabel="Add Follow-up"
          onAdd={canAddFollowUp ? () => setAddingFollowUp(true) : undefined}
        />
      )}

      {activeTab === 'transactions' && canViewBilling && (
        <ClientTransactionsTab
          clientId={id}
          clientName={client.companyName}
          onNew={canBill ? () => setBillingOpen(true) : undefined}
          canPay={canBill}
        />
      )}

      {billingOpen && (
        <ClientBillingModal
          clientId={id}
          clientName={client.companyName}
          entityTypeId={client.accountingEntityTypeId}
          productOptions={billingProductOptions}
          isOpen
          onClose={() => setBillingOpen(false)}
        />
      )}

      <AddInteractionPanel
        clientId={id}
        primaryContact={
          primaryContact && {
            name: primaryContact.name,
            phone: primaryContact.phone,
            role: primaryContact.decisionMaker?.name,
          }
        }
        isOpen={addingFollowUp}
        onClose={() => setAddingFollowUp(false)}
      />

      {editingCompany && (
        <EditClientCompanyModal
          currentAssignedUserId={client.assignedUserId}
          clientId={id}
          clientName={client.companyName}
          currentBusinessTypeId={client.businessType?.id ?? ''}
          currentSourceTypeId={client.sourceType?.id ?? ''}
          currentBillable={client.isBillable}
          currentEntityTypeId={client.accountingEntityTypeId}
          productOptions={billingProductOptions}
          isOpen
          onClose={() => setEditingCompany(false)}
        />
      )}

      {changingLocation && (
        <ChangeClientLocationModal
          clientId={id}
          clientName={client.companyName}
          currentLocation={client.location}
          isOpen
          onClose={() => setChangingLocation(false)}
        />
      )}

      {changingDecisionMaker && (
        <ChangeClientDecisionMakerModal
          clientId={id}
          clientName={client.companyName}
          currentName={primaryContact?.name ?? ''}
          currentRoleId={primaryContact?.decisionMaker?.id ?? ''}
          isOpen
          onClose={() => setChangingDecisionMaker(false)}
        />
      )}

      {addingProduct && (
        <AddClientProductModal
          clientId={id}
          clientName={client.companyName}
          existingProductIds={client.products.map((p) => p.product.id)}
          isOpen
          onClose={() => setAddingProduct(false)}
        />
      )}

      {confirmingDelete && (
        <ConfirmDeleteProspectModal
          title="Delete Client"
          name={client.companyName}
          consequence="removes its contacts and products, and the interactions recorded after it became a client. Anything recorded while it was a prospect stays with the prospect"
          isDeleting={deleteClient.isPending}
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
