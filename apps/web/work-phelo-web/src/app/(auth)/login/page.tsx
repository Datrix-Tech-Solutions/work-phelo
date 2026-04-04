// SUPER ADMIN LOGIN PAGE //

import { AuthPageShell } from '@/components/organisms/AuthPageShell';
import { LoginForm } from '@/components/organisms/LoginForm';

export default function PlatformLoginPage() {
  return (
    <AuthPageShell>
      <LoginForm forgotPasswordHref="/forgot-password" />
    </AuthPageShell>
  );
}
