'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ProspectWizard,
  ProspectWizardValues,
} from '@/components/organisms/marketing/ProspectWizard';
import { ProspectBreadcrumb } from '@/components/molecules/marketing/ProspectBreadcrumb';
import { Skeleton } from '@/components/atoms/Skeleton';
import { useProspect, useUpdateProspect } from '@/hooks/marketing/useProspects';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { pageContent } from '@/lib/layout';
import { cn } from '@/lib/utils';
import { ProspectDetail, UpdateProspectPayload } from '@/types/marketing';

/** Strips the time part of an ISO timestamp — the date pickers work with YYYY-MM-DD. */
function toDateInput(value: string | null): string {
  return value ? value.slice(0, 10) : '';
}

function toInitialValues(prospect: ProspectDetail): ProspectWizardValues {
  const contact = prospect.contacts.find((c) => c.isPrimary) ?? prospect.contacts[0];

  return {
    company: {
      companyName: prospect.companyName,
      businessType: prospect.businessType?.id ?? '',
      contactName: '',
      contactPerson: contact?.name ?? '',
      phone: contact?.phone ?? '',
      email: contact?.email ?? '',
      interactionType: '',
      roleJobTitle: contact?.decisionMaker?.id ?? '',
      sourceType: prospect.sourceType?.id ?? '',
      dateContacted: '',
    },
    productRows: prospect.products.map((p) => ({
      // The association id doubles as the row id so edits can be sent back as updates.
      id: p.id,
      productType: p.product.id,
      expectedRevenue: p.expectedValue,
      achievedRevenue: p.achievedValue ?? '',
      expectedCloseDate: toDateInput(p.expectedCloseDate),
      commissionRate: p.commissionRate != null ? String(Number(p.commissionRate)) : '',
    })),
    location: {
      location: prospect.location.label,
      lat: Number(prospect.location.latitude),
      lng: Number(prospect.location.longitude),
    },
    saleStage: { pipelineStageId: prospect.salesStage.id },
  };
}

function buildPayload(
  { company, productRows, location, saleStage }: ProspectWizardValues,
  existingProductIds: Set<string>,
): UpdateProspectPayload {
  return {
    companyName: company.companyName.trim(),
    businessTypeId: company.businessType || null,
    sourceTypeId: company.sourceType || null,
    pipelineStageId: saleStage.pipelineStageId,
    primaryContact: {
      name: company.contactPerson.trim(),
      ...(company.phone.trim() ? { phone: company.phone.trim() } : {}),
      ...(company.email.trim() ? { email: company.email.trim() } : {}),
      decisionMakerTypeId: company.roleJobTitle || null,
    },
    // The full desired set: rows carrying an existing id are updated, new rows are added,
    // and any existing row the user removed is dropped by the backend.
    products: productRows.map((row) => ({
      ...(existingProductIds.has(row.id) ? { id: row.id } : {}),
      productId: row.productType,
      expectedValue: Number(row.expectedRevenue),
      achievedValue: row.achievedRevenue.trim() !== '' ? Number(row.achievedRevenue) : null,
      expectedCloseDate: row.expectedCloseDate || null,
      commissionRate: row.commissionRate?.trim() ? Number(row.commissionRate) : null,
    })),
    location: {
      label: location.location,
      latitude: location.lat as number,
      longitude: location.lng as number,
    },
  };
}

export default function EditProspectPage() {
  const { tenantSlug, id } = useParams<{ tenantSlug: string; id: string }>();
  const router = useRouter();
  const toast = useToast();

  const { data: prospect, isLoading, isError } = useProspect(id);
  const updateProspect = useUpdateProspect(id);

  const initialValues = useMemo(
    () => (prospect ? toInitialValues(prospect) : undefined),
    [prospect],
  );
  const detailHref = `/${tenantSlug}/marketing/prospects/all/${id}`;

  if (isLoading || isError || !prospect || !initialValues) {
    return (
      <div className={cn(pageContent, 'flex-1 min-h-0 overflow-y-auto flex flex-col gap-6')}>
        <ProspectBreadcrumb tenantSlug={tenantSlug} prospectName="Edit Prospect" />
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <p className="text-sm text-red-500 text-center py-8">Failed to load prospect.</p>
        )}
      </div>
    );
  }

  const existingProductIds = new Set(prospect.products.map((p) => p.id));

  function handleSubmit(values: ProspectWizardValues) {
    updateProspect.mutate(buildPayload(values, existingProductIds), {
      onSuccess: () => {
        toast.success('Prospect updated');
        router.push(detailHref);
      },
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to update prospect')),
    });
  }

  return (
    <ProspectWizard
      tenantSlug={tenantSlug}
      title={`Edit ${prospect.companyName}`}
      initialValues={initialValues}
      isEdit
      isSubmitting={updateProspect.isPending}
      onSubmit={handleSubmit}
      onCancel={() => router.push(detailHref)}
    />
  );
}
