import { AuthPageShell } from '@/components/organisms/AuthPageShell';
import { LoginForm } from '@/components/organisms/LoginForm';

export default function PlatformLoginPage() {
  return (
    <AuthPageShell>
      <LoginForm forgotPasswordHref="/platform/forgot-password" redirectTo="/dashboard" />
    </AuthPageShell>
  );
}
