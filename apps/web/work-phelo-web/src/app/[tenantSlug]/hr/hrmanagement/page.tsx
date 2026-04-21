// HR MANAGEMENT PAGE //

import { redirect } from 'next/navigation';

export default async function HRManagementPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  redirect(`/${tenantSlug}/hr/hrmanagement/leave-types`);
}
