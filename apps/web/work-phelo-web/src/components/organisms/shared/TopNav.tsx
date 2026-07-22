'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Bell, Home, LayoutGrid, LogOutIcon, Menu, Settings, UserIcon } from 'lucide-react';
import { cn, frostedAvatarStyle } from '@/lib/utils';
import { WorkPheloLogo } from '@/components/atoms/WorkPheloLogo';
import { Modal } from '@/components/organisms/shared/Modal';
import { SidePanel } from '@/components/organisms/shared/SidePanel';
import { HelpCenter } from '@/components/organisms/shared/HelpCenter';
import { Button } from '@/components/atoms/Button';
import { useAuthStore } from '@/store/auth.store';
import { useLogout } from '@/hooks/useAuth';
import { useRouter, usePathname } from 'next/navigation';

export interface NavTab {
  key: string;
  label: string;
  href: string;
}

interface TopNavProps {
  showMenuButton?: boolean;
  onMenuClick?: () => void;
  tabs?: NavTab[];
  notificationCount?: number;
  userInitials: string;
  userColor?: string;
  logoVariant?: 'text' | 'image';
}

/* ── Nav tabs — routed links rendered flush with the header's bottom edge ── */
function NavTabs({ tabs }: { tabs: NavTab[] }) {
  const pathname = usePathname();

  return (
    <div className="self-stretch flex items-end gap-1">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/');
        return (
          <Link
            key={tab.key}
            href={tab.href}
            className={cn(
              'relative px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
              isActive
                ? 'text-black font-semibold after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-black after:rounded-t-full'
                : 'text-black/70 hover:text-black',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}

function formatRoleLabel(role: string): string {
  return role
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/* ── Profile dropdown ── */
function ProfileDropdown({
  userInitials,
  userColor,
  userName,
  userRole,
  onProfileClick,
  onSettingsClick,
  onLogoutClick,
  isSuperAdmin,
}: {
  userInitials: string;
  userColor?: string;
  userName?: string;
  userRole?: string;
  onProfileClick: () => void;
  onSettingsClick: () => void;
  onLogoutClick: () => void;
  isSuperAdmin?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const anchorRef = useRef<HTMLDivElement>(null);
  const avatarColor = userColor ?? 'var(--module-btn-bg, var(--color-brand))';

  useEffect(() => {
    if (!open) return;
    const updatePos = () => {
      if (!anchorRef.current) return;
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    };
    updatePos();
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [open]);

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
      onClick: () => {
        setOpen(false);
        onSettingsClick();
      },
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
    <div className="relative" ref={anchorRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={frostedAvatarStyle(avatarColor)}
        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold backdrop-blur-sm border border-white/30 transition-opacity hover:opacity-80"
      >
        {userInitials}
      </button>

      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <div
              style={{ position: 'fixed', top: pos.top, right: pos.right, minWidth: 200 }}
              className="z-20 bg-white border border-gray-100 rounded-input shadow-lg overflow-hidden"
            >
              {userName && (
                <>
                  <div className="flex items-center gap-2.5 px-4 py-3">
                    <span
                      style={frostedAvatarStyle(avatarColor)}
                      className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-white text-[10px] font-bold backdrop-blur-sm border border-white/30"
                    >
                      {userInitials}
                    </span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-gray-900 truncate">
                        {userName}
                      </span>
                      {userRole && (
                        <span className="text-xs text-gray-500 truncate">{userRole}</span>
                      )}
                    </div>
                  </div>
                  <div className="h-px bg-gray-100" />
                </>
              )}
              <div className="py-1.5">
                {items.map((item) => (
                  <button
                    key={item.label}
                    onClick={item.onClick}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors',
                      item.danger
                        ? 'text-red-500 hover:bg-red-50'
                        : 'text-gray-700 hover:bg-(--surface-hover-subtle,var(--color-gray-50))',
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}

/* ── TopNav ── */
export function TopNav({
  showMenuButton = false,
  onMenuClick,
  tabs,
  notificationCount,
  userInitials,
  userColor,
  logoVariant = 'text',
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

  // Modules that have their own layout (sidebar) and dedicated profile/settings pages.
  // Add a module here when its layout.tsx and profile/settings pages exist.
  const LAYOUT_MODULES = new Set(['hr', 'operations']);

  const currentModule = (() => {
    const segment = pathname.split('/')[2];
    return LAYOUT_MODULES.has(segment) ? segment : null;
  })();

  const handleProfileClick = () => {
    const slug = user?.tenantSlug || pathname.split('/')[1];
    router.push(currentModule ? `/${slug}/${currentModule}/profile` : `/${slug}/profile`);
  };

  const handleSettingsClick = () => {
    const slug = user?.tenantSlug || pathname.split('/')[1];
    router.push(currentModule ? `/${slug}/${currentModule}/settings` : `/${slug}/settings`);
  };

  const displayName = user
    ? `${user.firstName.charAt(0).toUpperCase()}. ${user.lastName ?? ''}`.trim()
    : undefined;
  const displayRole = user ? formatRoleLabel(user.role) : undefined;

  return (
    <>
      <header
        className={cn(
          'relative w-full border-b border-white/10 shadow-md px-5 h-14 flex items-center gap-4 shrink-0',
        )}
      >
        {/* Menu button */}
        {showMenuButton && (
          <button
            onClick={onMenuClick}
            className="text-(--module-btn-bg,var(--color-brand)) hover:text-(--module-btn-bg-hover,var(--color-brand-hover)) transition-colors"
            aria-label="Toggle menu"
          >
            <Menu />
          </button>
        )}

        {/* Logo */}
        <WorkPheloLogo className="text-base shrink-0" variant={logoVariant} />

        {/* Tabs — centered relative to the full header width */}
        {tabs && tabs.length > 1 && (
          <div className="absolute left-1/2 -translate-x-1/2 top-0 h-full flex items-end">
            <NavTabs tabs={tabs} />
          </div>
        )}

        <div className="flex-1" />

        {/* Right icons */}
        <div className="flex items-center gap-3">
          {/* Bell */}
          <button
            onClick={() => setNotificationsOpen(true)}
            className="relative text-(--module-btn-bg,var(--color-brand)) hover:text-(--module-btn-bg-hover,var(--color-brand-hover)) transition-colors"
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

          {/* Apps grid — back to module launcher */}
          <button
            className="text-(--module-btn-bg,var(--color-brand)) hover:text-(--module-btn-bg-hover,var(--color-brand-hover)) transition-colors"
            aria-label="Apps"
            onClick={() => {
              if (user?.role === 'SUPER_ADMIN') {
                router.push('/dashboard');
              } else {
                const slug = user?.tenantSlug || pathname.split('/')[1];
                router.push(`/${slug}/modules`);
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
            userName={displayName}
            userRole={displayRole}
            onProfileClick={handleProfileClick}
            onSettingsClick={handleSettingsClick}
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
              variant="danger"
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
