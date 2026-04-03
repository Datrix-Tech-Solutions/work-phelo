'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface Stat {
  label: string;
  value: string | number;
}

interface AvatarPin {
  initial: string;
  bgColor?: string;
}

interface WelcomeBannerProps {
  userName: string;
  companyName?: string;
  stats?: Stat[];
  avatars?: AvatarPin[];
  className?: string;
}

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatDate(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function AvatarPinBubble({ initial, bgColor = 'bg-gray-700' }: AvatarPin) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold',
          bgColor,
        )}
      >
        {initial}
      </div>
      {/* Pin triangle */}
      <div
        className={cn('w-0 h-0')}
        style={{
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: `6px solid ${bgColor.startsWith('bg-') ? 'currentColor' : bgColor}`,
        }}
      />
    </div>
  );
}

export function WelcomeBanner({
  userName,
  companyName,
  stats,
  avatars,
  className,
}: WelcomeBannerProps) {
  const greeting = useMemo(
    () => (companyName ? `${getTimeGreeting()}, ${userName}` : `Welcome back, ${userName}!`),
    [companyName, userName],
  );

  const date = useMemo(() => formatDate(), []);

  return (
    <div
      className={cn(
        'w-full rounded-xl px-6 py-4 flex items-center justify-between gap-6 overflow-hidden',
        className,
      )}
      style={{
        background: 'linear-gradient(to right, #0D1F44, #1E3A8A)',
      }}
    >
      {/* Left — greeting block */}
      <div className="flex flex-col gap-0.5">
        {companyName && (
          <span className="text-sm font-semibold text-orange-400">{companyName}</span>
        )}
        <span className="text-lg font-bold text-white">{greeting}</span>
        {!companyName && <span className="text-sm font-medium text-orange-400">{date}</span>}
      </div>

      {/* Right — stats */}
      {stats && stats.length > 0 && (
        <div className="flex items-center gap-8 shrink-0">
          {stats.map((stat, i) => (
            <div key={i} className="flex flex-col items-start gap-0.5">
              <span className="text-xs text-white/60">{stat.label}</span>
              <span className="text-base font-bold text-white">{stat.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Right — avatar pins */}
      {avatars && avatars.length > 0 && (
        <div className="flex items-start gap-3 self-start shrink-0">
          {avatars.map((avatar, i) => (
            <AvatarPinBubble key={i} {...avatar} />
          ))}
        </div>
      )}
    </div>
  );
}
