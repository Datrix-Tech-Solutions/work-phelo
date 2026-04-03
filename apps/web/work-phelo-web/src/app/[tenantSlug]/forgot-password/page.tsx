import { AuthPageShell } from '@/components/organisms/AuthPageShell';
import { ForgotPassword } from '@/components/organisms/ForgotPassword';

export default async function TenantForgotPasswordPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return (
    <AuthPageShell>
      <ForgotPassword tenantSlug={tenantSlug} />
    </AuthPageShell>
  );
}
