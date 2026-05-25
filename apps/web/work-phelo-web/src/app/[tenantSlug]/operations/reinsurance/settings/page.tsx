import { redirect } from 'next/navigation';

export default function ReinsuranceSettingsPage({ params }: { params: { tenantSlug: string } }) {
  redirect(`/${params.tenantSlug}/operations/reinsurance/settings/cedants`);
}
