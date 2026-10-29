import { redirect } from 'next/navigation';

export default async function InventorySettingsPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  redirect(`/${tenantSlug}/operations/inventory/settings/categories`);
}
