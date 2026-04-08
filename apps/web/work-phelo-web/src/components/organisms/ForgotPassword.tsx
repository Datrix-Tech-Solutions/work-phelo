'use client';

import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { AppLogo } from '@/components/atoms/AppLogo';
import { useForgotPassword } from '@/hooks';
import { Button } from '@/components/atoms/Button';
import { FormField } from '@/components/molecules/FormField';

interface ForgotPasswordForm {
  email: string;
}

interface ForgotPasswordProps {
  tenantSlug?: string;
}

export function ForgotPassword({ tenantSlug }: ForgotPasswordProps) {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>();

  const { mutate, isPending } = useForgotPassword();
  const handleSubmit2 = (data: ForgotPasswordForm) => {
    mutate({ ...data, tenantSlug } as any, {
      onSuccess: () => {
        sessionStorage.setItem('fpEmail', data.email);
        const base = tenantSlug ? `/${tenantSlug}` : '';
        router.push(`${base}/forgot-password/verify`);
      },
    });
  };

  const backHref = tenantSlug ? `/${tenantSlug}/login` : '/login';

  return (
    <div className="w-full max-w-sm px-8 py-10">
      <div className="flex justify-center mb-6">
        <AppLogo />
      </div>

      <h1 className="text-2xl font-semibold text-gray-900 text-center mb-2">Forgot Password</h1>
      <p className="text-sm text-gray-500 text-center mb-6">
        Enter your email and we&apos;ll send you a code to reset your password.
      </p>

      <form onSubmit={handleSubmit(handleSubmit2)} className="flex flex-col gap-4">
        <FormField
          label="Email"
          registration={register('email', { required: 'Email is required' })}
          error={errors.email}
          type="email"
          placeholder="Enter your organization assigned email"
        />

        <Button
          type="submit"
          isLoading={isPending}
          loadingText="Sending..."
          className="w-full mt-1"
        >
          Send Reset Code
        </Button>
      </form>

      <p className="text-center text-xs text-gray-400 mt-6">
        Remembered it?{' '}
        <a href={backHref} className="text-[#0D2244] font-medium hover:underline">
          Sign in
        </a>
      </p>
    </div>
  );
}
