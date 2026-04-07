// RESET PASSWORD PAGE //

import { AuthPageShell } from '@/components/organisms/AuthPageShell';
import { ResetPassword } from '@/components/organisms/ResetPassword';

export default function ResetPasswordPage() {
  return (
    <AuthPageShell>
      <ResetPassword />
    </AuthPageShell>
  );
}
