'use client';

import { useForm, useWatch } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { AppLogo } from '@/components/atoms/AppLogo';
import { useResetPassword } from '@/hooks';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/FormField';
import { cn } from '@/lib/utils';

interface ResetPasswordForm {
  password: string;
  confirmPassword: string;
}

interface ResetPasswordProps {
  tenantSlug?: string;
}

const rules = [
  { label: '8+ characters', test: (v: string) => v.length >= 8 },
  { label: 'Uppercase letter', test: (v: string) => /[A-Z]/.test(v) },
  { label: 'Number', test: (v: string) => /[0-9]/.test(v) },
  { label: 'Special character', test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

export function ResetPassword({ tenantSlug }: ResetPasswordProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ResetPasswordForm>();

  const password = useWatch({ control, name: 'password', defaultValue: '' });

  const { mutate, isPending } = useResetPassword();
  const handleReset = (data: ResetPasswordForm) => {
    const otpCode = sessionStorage.getItem('fpOtp') ?? '';
    const email = sessionStorage.getItem('fpEmail') ?? undefined;
    mutate(
      { otpCode, newPassword: data.password, email, tenantSlug },
      {
        onSuccess: () => {
          sessionStorage.removeItem('fpOtp');
          sessionStorage.removeItem('fpEmail');
          const base = tenantSlug ? `/${tenantSlug}` : '';
          router.push(`${base}/login`);
        },
      },
    );
  };

  return (
    <div className="w-full max-w-sm px-8 py-10">
      <div className="flex justify-center mb-6">
        <AppLogo />
      </div>

      <h1 className="text-2xl font-semibold text-gray-900 text-center mb-2">
        Set Your New Password
      </h1>
      <p className="text-sm text-gray-500 text-center mb-6">
        For security reasons, you must create a new password before accessing your workspace.
      </p>

      <form onSubmit={handleSubmit(handleReset)} className="flex flex-col gap-4">
        <div>
          <FormField
            label="Password"
            registration={register('password', { required: 'Password is required' })}
            error={errors.password}
            type="password"
            placeholder="Create new password"
          />
          {/* Validation checklist */}
          <ul className="mt-2 flex flex-col gap-1">
            {rules.map(({ label, test }) => (
              <li
                key={label}
                className={cn(
                  'flex items-center gap-1.5 text-xs',
                  test(password) ? 'text-green-600' : 'text-gray-400',
                )}
              >
                <span>{test(password) ? '✓' : '✓'}</span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <FormField
          label="Confirm New Password"
          registration={register('confirmPassword', {
            required: 'Please confirm your password',
            validate: (v) => v === password || 'Passwords do not match',
          })}
          error={errors.confirmPassword}
          type="password"
          placeholder="Re-enter new password"
        />

        <Button
          type="submit"
          isLoading={isPending}
          loadingText="Updating..."
          className="w-full mt-1"
        >
          Update Password
        </Button>
      </form>
    </div>
  );
}
