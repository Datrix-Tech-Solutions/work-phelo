'use client';

import { useParams, useRouter } from 'next/navigation';
import {
  ProspectWizard,
  ProspectWizardValues,
} from '@/components/organisms/marketing/ProspectWizard';
import { useCreateProspect } from '@/hooks/marketing/useProspects';
import { useToast } from '@/hooks/useToast';
import { apiErrorMessage } from '@/lib/apiError';
import { CreateProspectPayload } from '@/types/marketing';

function buildPayload({
  company,
  productRows,
  location,
  saleStage,
}: ProspectWizardValues): CreateProspectPayload {
  return {
    companyName: company.companyName.trim(),
    ...(company.businessType ? { businessTypeId: company.businessType } : {}),
    ...(company.sourceType ? { sourceTypeId: company.sourceType } : {}),
    pipelineStageId: saleStage.pipelineStageId,
    primaryContact: {
      name: company.contactName.trim(),
      ...(company.phone.trim() ? { phone: company.phone.trim() } : {}),
      ...(company.email.trim() ? { email: company.email.trim() } : {}),
      ...(company.roleJobTitle ? { decisionMakerTypeId: company.roleJobTitle } : {}),
    },
    products: productRows.map((row) => ({
      productId: row.productType,
      expectedValue: Number(row.expectedRevenue),
      ...(row.achievedRevenue.trim() !== '' ? { achievedValue: Number(row.achievedRevenue) } : {}),
      ...(row.expectedCloseDate ? { expectedCloseDate: row.expectedCloseDate } : {}),
    })),
    location: {
      label: location.location,
      latitude: location.lat as number,
      longitude: location.lng as number,
    },
    ...(company.dateContacted
      ? {
          initialInteraction: {
            occurredAt: company.dateContacted,
            ...(company.interactionType ? { interactionMediumId: company.interactionType } : {}),
          },
        }
      : {}),
  };
}

export default function NewProspectPage() {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  const router = useRouter();
  const toast = useToast();
  const createProspect = useCreateProspect();

  const listHref = `/${tenantSlug}/marketing/prospects/all`;

  function handleSubmit(values: ProspectWizardValues) {
    createProspect.mutate(buildPayload(values), {
      onSuccess: () => {
        toast.success('Prospect created');
        router.push(listHref);
      },
      onError: (error) => toast.error(apiErrorMessage(error, 'Failed to create prospect')),
    });
  }

  return (
    <ProspectWizard
      tenantSlug={tenantSlug}
      title="Create New Prospect"
      isSubmitting={createProspect.isPending}
      onSubmit={handleSubmit}
      onCancel={() => router.push(listHref)}
    />
  );
}
