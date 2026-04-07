'use client';

import { useState } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useAcceptInvite } from '@/hooks';
import { extractError } from '@/lib/errors';

export default function AcceptInvitePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const tenantSlug = params.tenantSlug as string;
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const acceptInvite = useAcceptInvite();

  const handleSubmit = async () => {
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    try {
      await acceptInvite.mutateAsync({ inviteToken: token, password });
      setSuccess(true);
      setTimeout(() => router.push(`/${tenantSlug}/login`), 2000);
    } catch (err) {
      setError(extractError(err));
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-red-600">Invalid Link</h1>
          <p className="text-gray-500 mt-2">This invitation link is invalid or has expired.</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-green-600">Password Set!</h1>
          <p className="text-gray-500 mt-2">Redirecting you to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Set Your Password</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Create a password to access your WorkPhelo account.
          </p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Repeat your password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={acceptInvite.isPending}
            className="w-full bg-orange-500 text-white py-2.5 rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {acceptInvite.isPending ? 'Setting password...' : 'Set Password'}
          </button>
        </div>
      </div>
    </div>
  );
}
