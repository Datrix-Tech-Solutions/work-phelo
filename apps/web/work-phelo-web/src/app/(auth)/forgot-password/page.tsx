// FORGOT PASSWORD PAGE //

import { AuthPageShell } from '@/components/organisms/AuthPageShell';
import { ForgotPassword } from '@/components/organisms/ForgotPassword';

export default function ForgotPasswordPage() {
  return (
    <AuthPageShell>
      <ForgotPassword />
    </AuthPageShell>
  );
}
