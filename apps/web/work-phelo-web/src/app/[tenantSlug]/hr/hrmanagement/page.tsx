// HR MANAGEMENT PAGE //

import { redirect } from 'next/navigation';

export default function HRManagementPage({ params }: { params: { tenantSlug: string } }) {
  redirect(`/${params.tenantSlug}/hr/hrmanagement/leave-types`);
}
