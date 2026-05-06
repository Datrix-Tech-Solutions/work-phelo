import { redirect } from 'next/navigation';

export default function CompanyPoliciesPage({ params }: { params: { tenantSlug: string } }) {
  redirect(`/${params.tenantSlug}/hr/hrmanagement/companyPolicies/employment`);
}
