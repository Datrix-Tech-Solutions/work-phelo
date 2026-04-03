import { AuthPageShell } from '@/components/organisms/AuthPageShell';
import { LoginForm } from '@/components/organisms/LoginForm';

export default async function TenantLoginPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;

  return (
    <AuthPageShell>
      <LoginForm
        showSocialLogin
        tenantSlug={tenantSlug}
        forgotPasswordHref={`/${tenantSlug}/forgot-password`}
      />
    </AuthPageShell>
  );
}
