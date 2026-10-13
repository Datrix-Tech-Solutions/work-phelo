import { redirect } from 'next/navigation';

/**
 * Currency now belongs to each payroll configuration and the pension tiers are pay components, so
 * this page is no longer used. Old links go to the first policies tab.
 */
export default async function FinancesPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  redirect(`/${tenantSlug}/hr/hrmanagement/companyPolicies/employment`);
}
