'use client';

import { useRef, useState, ClipboardEvent, KeyboardEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { api } from '@/lib/api';
import { Button } from '@/components/atoms/Button';
import { cn } from '@/lib/utils';

const OTP_LENGTH = 6;

interface OtpVerificationProps {
  tenantSlug?: string;
}

export function OtpVerification({ tenantSlug }: OtpVerificationProps) {
  const router = useRouter();
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const { mutate, isPending, isError } = useMutation({
    mutationFn: (otp: string) => api.post('/auth/verify-otp', { otp, tenantSlug }),
    onSuccess: () => {
      const base = tenantSlug ? `/${tenantSlug}` : '';
      router.push(`${base}/forgot-password/reset`);
    },
  });

  const handleChange = (index: number, value: string) => {
    const char = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = char;
    setDigits(next);
    if (char && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LENGTH);
    const next = [...digits];
    pasted.split('').forEach((char, i) => {
      next[i] = char;
    });
    setDigits(next);
    inputRefs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
  };

  const handleSubmit = () => {
    const otp = digits.join('');
    if (otp.length === OTP_LENGTH) mutate(otp);
  };

  const { mutate: resend, isPending: isResending } = useMutation({
    mutationFn: () => api.post('/auth/resend-otp', { tenantSlug }),
  });

  return (
    <div className="w-full max-w-sm px-8 py-10">
      <div className="flex justify-center mb-6">
        <Image
          src="/images/HRphelo.png"
          alt="WorkPhelo"
          width={160}
          height={40}
          className="h-10 w-auto"
        />
      </div>

      <h1 className="text-2xl font-semibold text-gray-900 text-center mb-2">Verify Your Email</h1>
      <p className="text-sm text-gray-500 text-center mb-8">
        Enter the 6-digit code we sent to your email address.
      </p>

      {/* OTP boxes */}
      <div className="flex justify-center gap-3 mb-6">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            className={cn(
              'w-11 h-13 text-center text-lg font-semibold border rounded-xl',
              'focus:outline-none focus:ring-2 focus:ring-[#0D2244] focus:border-[#0D2244]',
              'transition-colors text-gray-900',
              isError ? 'border-red-500' : digit ? 'border-[#0D2244]' : 'border-gray-300',
            )}
          />
        ))}
      </div>

      {isError && (
        <p className="text-xs text-red-500 text-center mb-4">Invalid code. Please try again.</p>
      )}

      <Button
        onClick={handleSubmit}
        isLoading={isPending}
        loadingText="Verifying..."
        disabled={digits.join('').length < OTP_LENGTH}
        className="w-full"
      >
        Verify Code
      </Button>

      <p className="text-center text-xs text-gray-400 mt-6">
        Didn&apos;t receive a code?{' '}
        <button
          onClick={() => resend()}
          disabled={isResending}
          className="text-[#0D2244] font-medium hover:underline disabled:opacity-50"
        >
          {isResending ? 'Resending...' : 'Resend'}
        </button>
      </p>
    </div>
  );
}
