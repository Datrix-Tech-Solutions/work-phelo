'use client';

import { useState } from 'react';
import { Button } from '@/components/atoms/Button';
import { Mail } from 'lucide-react';

export default function ReinsuranceEmailPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSignIn = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 3000);
  };

  return (
    <div className="flex flex-col items-center justify-center h-70% p-8 text-center">
      <Mail size={48} className="text-slate-300 mb-4" />
      <h2 className="text-xl font-bold text-slate-900 mb-2">Connect your Outlook</h2>
      <p className="text-slate-500 mb-6 max-w-sm">
        Connect your Outlook account to view your recent emails directly in iRisk.
      </p>
      <Button onClick={handleSignIn} isLoading={isLoading} loadingText="Signing in...">
        Sign in with Outlook
      </Button>
    </div>
  );
}
