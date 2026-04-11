'use client';

import { useForm } from 'react-hook-form';
import { extractError } from '@/lib/extractError';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AppLogo } from '@/components/atoms/AppLogo';
import { api } from '@/lib/api';
import { LoginPayload, User } from '@/types/auth';
import { useAuthStore } from '@/store/auth.store';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/atoms/Button';
import { GoogleButton } from '@/components/atoms/GoogleButton';
import { MicrosoftButton } from '@/components/atoms/MicrosoftButton';
import { FormField } from '@/components/molecules/shared/FormField';

interface LoginFormProps {
  showSocialLogin?: boolean;
  tenantSlug?: string;
  forgotPasswordHref?: string;
  redirectTo?: string;
}

export function LoginForm({
  showSocialLogin = false,
  tenantSlug,
  forgotPasswordHref = '/forgot-password',
  redirectTo = '/dashboard',
}: LoginFormProps) {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);
  const toast = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginPayload>();

  const isTenantLogin = !!tenantSlug;
  const endpoint = isTenantLogin ? '/auth/login' : '/auth/admin/login';

  const { mutate, isPending } = useMutation({
    mutationFn: (data: LoginPayload) => api.post<{ user: User }>(endpoint, data),
    onSuccess: (res) => {
      setUser(res.data.user);
      const destination = isTenantLogin ? `/${tenantSlug}/dashboard` : (redirectTo ?? '/dashboard');
      router.push(destination);
    },
    onError: (err) => {
      toast.error(extractError(err, 'Invalid email or password'));
    },
  });

  const onSubmit = (data: LoginPayload) => {
    mutate({ ...data, ...(tenantSlug ? { tenantSlug } : {}) });
  };

  return (
    <div className="w-full max-w-sm px-8 py-10">
      <div className="flex justify-center mb-6">
        <AppLogo />
      </div>

      <h1 className="text-2xl font-semibold text-gray-900 text-center mb-6">Sign in</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          label="Email"
          registration={register('email', { required: 'Email is required' })}
          error={errors.email}
          type="email"
          placeholder="Enter your organization assigned email"
        />

        <div className="flex flex-col gap-1">
          <FormField
            label="Password"
            registration={register('password', { required: 'Password is required' })}
            error={errors.password}
            type="password"
            placeholder="Enter your password"
          />
          <div className="flex justify-end">
            <Link
              href={forgotPasswordHref}
              className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              Forgot your Password?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          isLoading={isPending}
          loadingText="Signing in..."
          className="w-full mt-1"
        >
          Sign in
        </Button>
      </form>

      {showSocialLogin && (
        <>
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400">Sign in with</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <div className="flex gap-3">
            <GoogleButton className="flex-1" />
            <MicrosoftButton className="flex-1" />
          </div>
        </>
      )}
    </div>
  );
}
