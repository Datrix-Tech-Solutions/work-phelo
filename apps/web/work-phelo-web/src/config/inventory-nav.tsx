import { NavGroup } from '@/components/organisms/shared/Sidebar';

import { LayoutDashboard, Settings, Users } from 'lucide-react';

/* ── Icons ── */
const DashboardIcon = () => <LayoutDashboard className="w-5 h-5" />;
const SettingsIcon = () => <Settings className="w-5 h-5" />;
const UserManagementIcon = () => <Users className="w-5 h-5" />;

/* ── Nav groups ── */

export const INVENTORY_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        key: 'dashboard',
        label: 'Dashboard',
        icon: <DashboardIcon />,
        href: '',
        enabled: true,
        active: true,
        exact: true,
      },
    ],
  },
  {
    label: 'System',
    items: [
      {
        key: 'settings',
        label: 'Settings',
        icon: <SettingsIcon />,
        href: 'settings',
        enabled: true,
        active: true,
      },
      {
        key: 'user-management',
        label: 'User Management',
        icon: <UserManagementIcon />,
        href: 'user-management',
        enabled: true,
        active: true,
      },
    ],
  },
];
