// OTP PAGE //

import { AuthPageShell } from '@/components/organisms/AuthPageShell';
import { OtpVerification } from '@/components/organisms/OtpVerification';

export default function OtpVerificationPage() {
  return (
    <AuthPageShell>
      <OtpVerification />
    </AuthPageShell>
  );
}
