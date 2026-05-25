import { NavGroup } from '@/components/organisms/shared/Sidebar';

import {
  LayoutDashboard,
  ScrollText,
  FilePlus2,
  BarChart3,
  ShieldCheck,
  Settings,
} from 'lucide-react';

/* ── Icons ── */
const DashboardIcon = () => <LayoutDashboard className="w-5 h-5" />;
const ReinsuranceIcon = () => <ShieldCheck className="w-5 h-5" />;
const TreatyIcon = () => <ScrollText className="w-5 h-5" />;
const FacultativeIcon = () => <FilePlus2 className="w-5 h-5" />;
const ReportsIcon = () => <BarChart3 className="w-5 h-5" />;
const SettingsIcon = () => <Settings className="w-5 h-5" />;

/* ── Nav groups ── */

export const REINSURANCE_NAV_GROUPS: NavGroup[] = [
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
    label: 'Operations',
    items: [
      {
        key: 'reinsurance',
        label: 'Reinsurance',
        icon: <ReinsuranceIcon />,
        href: '',
        enabled: true,
        active: true,
        children: [
          {
            key: 'treaty',
            label: 'Treaty',
            icon: <TreatyIcon />,
            href: 'treaty',
            enabled: true,
            active: true,
          },
          {
            key: 'facultative',
            label: 'Facultative',
            icon: <FacultativeIcon />,
            href: 'facultative',
            enabled: true,
            active: true,
          },
        ],
      },
    ],
  },
  {
    label: 'Analytics',
    items: [
      {
        key: 'reports',
        label: 'Reports',
        icon: <ReportsIcon />,
        href: 'reports',
        enabled: true,
        active: true,
      },
    ],
  },
  {
    label: 'Configuration',
    items: [
      {
        key: 'settings',
        label: 'Settings',
        icon: <SettingsIcon />,
        href: 'settings',
        enabled: true,
        active: true,
      },
    ],
  },
];
