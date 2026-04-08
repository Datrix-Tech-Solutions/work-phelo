// TENANT OTP VERIFICATION PAGE //

import { AuthPageShell } from '@/components/organisms/AuthPageShell';
import { OtpVerification } from '@/components/organisms/OtpVerification';

export default async function TenantOtpVerificationPage({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  return (
    <AuthPageShell>
      <OtpVerification tenantSlug={tenantSlug} mode="password-reset" />
    </AuthPageShell>
  );
}
