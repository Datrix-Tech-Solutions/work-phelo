'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { WorkPheloLogo } from '@/components/atoms/WorkPheloLogo';
import { Modal } from '@/components/organisms/Modal';
import { Button } from '@/components/atoms/Button';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';
import { useRouter, usePathname } from 'next/navigation';

export interface NavTab {
  label: string;
  value: string;
}

interface TopNavProps {
  showMenuButton?: boolean;
  onMenuClick?: () => void;
  tabs?: NavTab[];
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  notificationCount?: number;
  userInitials: string;
  userColor?: string;
}

/* ── Profile dropdown ── */
function ProfileDropdown({
  userInitials,
  userColor,
  onLogoutClick,
}: {
  userInitials: string;
  userColor?: string;
  onLogoutClick: () => void;
}) {
  const [open, setOpen] = useState(false);

  const items = [
    {
      label: 'Profile',
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
      danger: false,
      onClick: () => setOpen(false),
    },
    {
      label: 'Settings',
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
      danger: false,
      onClick: () => setOpen(false),
    },
    {
      label: 'Logout',
      icon: (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      ),
      danger: true,
      onClick: () => {
        setOpen(false);
        onLogoutClick();
      },
    },
  ];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold transition-opacity hover:opacity-80',
          userColor ?? 'bg-[#0D2244]',
        )}
      >
        {userInitials}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-20 min-w-40 bg-white border border-gray-100 rounded-input shadow-lg py-1.5 overflow-hidden">
            {items.map((item) => (
              <button
                key={item.label}
                onClick={item.onClick}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                  item.danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50',
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/* ── TopNav ── */
export function TopNav({
  showMenuButton = false,
  onMenuClick,
  tabs,
  activeTab,
  onTabChange,
  notificationCount,
  userInitials,
  userColor,
}: TopNavProps) {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const { logout, user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    await api.post('/auth/logout').catch(() => {});
    const redirectTo =
      user?.role === 'SUPER_ADMIN' ? '/platform/login' : `/${user?.tenantSlug}/login`;
    logout();
    router.push(redirectTo);
  };

  return (
    <>
      <header className="w-full bg-[#d5dbe7] border-b border-white/10 px-5 h-14 flex items-center gap-4 shrink-0">
        {/* Menu button */}
        {showMenuButton && (
          <button
            onClick={onMenuClick}
            className="text-white/70 hover:text-black transition-colors"
            aria-label="Toggle menu"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        )}

        {/* Logo */}
        <WorkPheloLogo className="text-base shrink-0" />

        {/* Tabs — center */}
        {tabs && tabs.length > 0 && (
          <nav className="flex-1 flex items-end justify-end gap-6">
            {tabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => onTabChange?.(tab.value)}
                className={cn(
                  'relative text-sm pb-0.5 transition-colors',
                  activeTab === tab.value
                    ? 'text-black font-semibold after:absolute after:-bottom-4.25 after:left-0 after:right-0 after:h-0.5 after:bg-black after:rounded-full'
                    : 'text-black/60 hover:text-/90',
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        )}

        <div className="flex-1" />

        {/* Right icons */}
        <div className="flex items-center gap-3">
          {/* Bell */}
          <button
            className="relative text-black/70 hover:text-black transition-colors"
            aria-label="Notifications"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {notificationCount != null && notificationCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-0.5 bg-orange-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </button>

          {/* Help */}
          <button className="text-black/70 hover:text-black transition-colors" aria-label="Help">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>

          {/* Apps grid — back to module dashboard */}
          <button
            className="text-black/70 hover:text-black transition-colors"
            aria-label="Apps"
            onClick={() => {
              if (user?.role === 'SUPER_ADMIN') {
                router.push('/dashboard');
              } else {
                const slug = user?.tenantSlug || pathname.split('/')[1];
                router.push(`/${slug}/dashboard`);
              }
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
          </button>

          {/* Profile avatar */}
          <ProfileDropdown
            userInitials={userInitials}
            userColor={userColor}
            onLogoutClick={() => setLogoutOpen(true)}
          />
        </div>
      </header>

      {/* Logout confirmation modal */}
      <Modal
        isOpen={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        title="Logout"
        description="Are you sure you want to logout?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLogoutOpen(false)}>
              Stay
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </>
        }
      />
    </>
  );
}
