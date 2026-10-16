import { NavGroup } from '@/components/organisms/shared/Sidebar';

import {
  BookSearch,
  Megaphone,
  SlidersHorizontal,
  Users,
  ClipboardClock,
  ClipboardList,
  Handshake,
  Target,
  LayoutDashboard,
  Truck,
  SquareUser,
  UserKey,
} from 'lucide-react';

const DashboardIcon = () => <LayoutDashboard className="w-5 h-5" />;

const ProspectIcon = () => <Handshake className="w-5 h-5" />;
const AppointmentIcon = () => <ClipboardClock className="w-5 h-5" />;
const RequestsIcon = () => <ClipboardList className="w-5 h-5" />;
const TransportOfficersIcon = () => <SquareUser className="w-5 h-5" />;
const FleetIcon = () => <Truck className="w-5 h-5" />;

const ClientsIcon = () => <Users className="w-5 h-5" />;
const CampaignManagementIcon = () => <SlidersHorizontal className="w-5 h-5" />;
const TargetsIcon = () => <Target className="w-5 h-5" />;
const CampaignsIcon = () => <Megaphone className="w-5 h-5" />;

const UserManagementIcon = () => <UserKey className="w-5 h-5" />;

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
    label: 'Campaign',
    items: [
      {
        key: 'campaigns',
        label: 'Campaigns',
        icon: <CampaignsIcon />,
        href: 'campaigns',
        enabled: true,
        active: true,
      },
      {
        key: 'campaign-management',
        label: 'Campaign Management',
        icon: <CampaignManagementIcon />,
        href: 'campaign-management',
        enabled: true,
        active: true,
      },
    ],
  },
  {
    label: 'Sales CRM',
    items: [
      {
        key: 'prospects',
        label: 'Prospects',
        icon: <ProspectIcon />,
        href: 'prospects',
        enabled: true,
        active: true,
      },
      {
        key: 'clients',
        label: 'Clients',
        icon: <ClientsIcon />,
        href: 'clients',
        enabled: true,
        active: true,
      },
      {
        key: 'appointments',
        label: 'Appointments',
        icon: <AppointmentIcon />,
        href: 'appointments',
        enabled: true,
        active: true,
      },
      {
        key: 'settings',
        label: 'CRM Configuration',
        icon: <ProspectingIcon />,
        href: 'settings',
        enabled: true,
        active: true,
      },
    ],
  },
  {
    label: 'Transport',
    items: [
      {
        key: 'fleet-management',
        label: 'Fleet Management',
        icon: <FleetIcon />,
        href: 'fleet-management',
        enabled: true,
        active: true,
      },
      {
        key: 'requests',
        label: 'Requests',
        icon: <RequestsIcon />,
        href: 'requests',
        enabled: true,
        active: true,
      },
      {
        key: 'transport-officers',
        label: 'Transport Officers',
        icon: <TransportOfficersIcon />,
        href: 'transport-officers',
        enabled: true,
        active: true,
      },
    ],
  },
  {
    label: 'Targets and Reports',
    items: [
      {
        key: 'targets',
        label: 'Sales Targets',
        icon: <TargetsIcon />,
        href: 'targets',
        enabled: true,
        active: true,
      },
    ],
  },
  {
    label: 'Administration',
    items: [
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

/**
 * The top-nav tabs. Each one owns the sidebar group whose label matches `groupLabel`; every other
 * group in MARKETING_NAV_GROUPS is a constant that always shows.
 */
export const MARKETING_TABS = [
  { key: 'campaign', label: 'Campaign', groupLabel: 'Campaign' },
  { key: 'prospecting', label: 'Sales CRM', groupLabel: 'Sales CRM' },
  { key: 'transport', label: 'Transport', groupLabel: 'Transport' },
] as const;

export type MarketingTabKey = (typeof MARKETING_TABS)[number]['key'];
