// RESET PASSWORD PAGE //

import { AuthPageShell } from '@/components/organisms/login/AuthPageShell';
import { ResetPassword } from '@/components/organisms/login/ResetPassword';

export default function ResetPasswordPage() {
  return (
    <AuthPageShell>
      <ResetPassword />
    </AuthPageShell>
  );
}
