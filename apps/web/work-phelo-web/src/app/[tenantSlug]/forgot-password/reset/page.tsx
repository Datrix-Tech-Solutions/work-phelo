import { AuthPageShell } from '@/components/organisms/AuthPageShell';
import { ResetPassword } from '@/components/organisms/ResetPassword';

export default async function TenantResetPasswordPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return (
    <AuthPageShell>
      <ResetPassword tenantSlug={tenantSlug} />
    </AuthPageShell>
  );
}
