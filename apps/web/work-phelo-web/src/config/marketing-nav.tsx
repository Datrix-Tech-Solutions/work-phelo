import { NavGroup } from '@/components/organisms/shared/Sidebar';

import { BookSearch, LayoutDashboard, Settings } from 'lucide-react';

const DashboardIcon = () => <LayoutDashboard className="w-5 h-5" />;
const SettingsIcon = () => <Settings className="w-5 h-5" />;
const ProspectingIcon = () => <BookSearch className="w-5 h-5" />;

export const MARKETING_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        key: 'dashboard',
        label: 'Dashboard',
        icon: <DashboardIcon />,
        href: 'dashboard',
        enabled: true,
        active: true,
      },
    ],
  },
  {
    label: 'CRM Settings',
    items: [
      {
        key: 'settings',
        label: 'Settings',
        icon: <SettingsIcon />,
        href: 'settings',
        enabled: true,
        active: false,
      },
      {
        key: 'prospecting',
        label: 'Prospecting',
        icon: <ProspectingIcon />,
        href: 'prospecting',
        enabled: true,
        active: true,
      },
    ],
  },
];
