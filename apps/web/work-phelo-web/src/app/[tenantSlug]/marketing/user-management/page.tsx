import { redirect } from 'next/navigation';

export default async function UserManagementPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  redirect(`/${tenantSlug}/marketing/user-management/roles-permissions`);
}
