'use client';

import { useState } from 'react';
import { Bell, Home, LayoutGrid, LogOutIcon, Menu, Settings, UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WorkPheloLogo } from '@/components/atoms/WorkPheloLogo';
import { Modal } from '@/components/organisms/shared/Modal';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { HelpCenter } from '@/components/organisms/shared/HelpCenter';
import { Button } from '@/components/atoms/Button';
import { useAuthStore } from '@/store/auth.store';
import { useLogout } from '@/hooks/useAuth';
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
  logoVariant?: 'text' | 'image';
  logoSrc?: string;
}

/* ── Profile dropdown ── */
function ProfileDropdown({
  userInitials,
  userColor,
  onProfileClick,
  onLogoutClick,
  isSuperAdmin,
}: {
  userInitials: string;
  userColor?: string;
  onProfileClick: () => void;
  onLogoutClick: () => void;
  isSuperAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const items = [
    ...(!isSuperAdmin
      ? [
          {
            label: 'Profile',
            icon: <UserIcon className="w-5 h-5" />,
            danger: false,
            onClick: () => {
              setOpen(false);
              onProfileClick();
            },
          },
        ]
      : []),
    {
      label: 'Settings',
      icon: <Settings className="w-5 h-5" />,
      danger: false,
      onClick: () => setOpen(false),
    },
    {
      label: 'Logout',
      icon: <LogOutIcon className="w-5 h-5" />,
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
          userColor ?? 'bg-brand',
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

  notificationCount,
  userInitials,
  userColor,
  logoVariant = 'text',
  logoSrc,
}: TopNavProps) {
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { user } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const { mutate: performLogout, isPending: isLoggingOut } = useLogout();

  const handleLogout = () => {
    const redirectTo =
      user?.role === 'SUPER_ADMIN' ? '/platform/login' : `/${user?.tenantSlug}/login`;
    performLogout(undefined, { onSuccess: () => router.push(redirectTo) });
  };

  const handleProfileClick = () => {
    const slug = user?.tenantSlug || pathname.split('/')[1];
    router.push(`/${slug}/hr/profile`);
  };

  return (
    <>
      <header className="w-full bg-[#FFFFFF] border-b px-5 h-14 flex items-center gap-4 shrink-0">
        {/* Menu button */}
        {showMenuButton && (
          <button
            onClick={onMenuClick}
            className="text-blue-950 hover:text-black transition-colors"
            aria-label="Toggle menu"
          >
            <Menu />
          </button>
        )}

        {/* Logo */}
        <WorkPheloLogo className="text-base shrink-0" variant={logoVariant} src={logoSrc} />

        <div className="flex-1" />

        {/* Right icons */}
        <div className="flex items-center gap-3">
          {/* Bell */}
          <button
            onClick={() => setNotificationsOpen(true)}
            className="relative text-black/70 hover:text-black transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {notificationCount != null && notificationCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-4 h-4 px-0.5 bg-orange-400 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {notificationCount > 99 ? '99+' : notificationCount}
              </span>
            )}
          </button>

          {/* Help */}
          {user?.role !== 'SUPER_ADMIN' && <HelpCenter />}

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
            {user?.role === 'SUPER_ADMIN' ? (
              <Home className="w-5 h-5" />
            ) : (
              <LayoutGrid className="w-5 h-5" />
            )}
          </button>

          {/* Profile avatar */}
          <ProfileDropdown
            userInitials={userInitials}
            userColor={userColor}
            onProfileClick={handleProfileClick}
            onLogoutClick={() => setLogoutOpen(true)}
            isSuperAdmin={user?.role === 'SUPER_ADMIN'}
          />
        </div>
      </header>

      {/* Notifications panel */}
      <SidePanel
        isOpen={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        title="Notifications"
        description="Stay up to date with what's happening."
      >
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center text-gray-300">
            <Bell className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-gray-500">No notifications yet</p>
          <p className="text-xs text-gray-400">You&apos;re all caught up! Check back later.</p>
        </div>
      </SidePanel>

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
            <Button
              variant="outline"
              onClick={handleLogout}
              isLoading={isLoggingOut}
              loadingText="Logging out..."
            >
              Logout
            </Button>
          </>
        }
      />
    </>
  );
}
