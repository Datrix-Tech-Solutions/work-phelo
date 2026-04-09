// RESET PASSWORD PAGE //

import { AuthPageShell } from '@/components/organisms/login/AuthPageShell';
import { ResetPassword } from '@/components/organisms/login/ResetPassword';

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
