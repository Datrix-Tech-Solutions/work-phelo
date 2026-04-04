import { NavGroup } from '@/components/organisms/Sidebar';
import { BuildingIcon } from 'lucide-react';

/* ── Icons ── */
const DashboardIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);
const DepartmentsIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 21h18" />
    <path d="M5 21V7l7-4 7 4v14" />
    <path d="M9 21v-4h6v4" />
    <rect x="9" y="9" width="2" height="2" />
    <rect x="13" y="9" width="2" height="2" />
    <rect x="9" y="13" width="2" height="2" />
    <rect x="13" y="13" width="2" height="2" />
  </svg>
);
const BranchesIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 9h18M3 15h18M12 3v18" />
    <rect x="3" y="3" width="6" height="6" rx="1" />
    <rect x="15" y="3" width="6" height="6" rx="1" />
    <rect x="15" y="15" width="6" height="6" rx="1" />
    <rect x="3" y="15" width="6" height="6" rx="1" />
  </svg>
);
const EmployeesIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const LeaveIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
  </svg>
);
const AppraisalIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 21h8" />
    <path d="M12 21v-4" />
    <path d="M17 4H7a1 1 0 0 0-1 1v6a6 6 0 0 0 12 0V5a1 1 0 0 0-1-1z" />
    <path d="M6 9H3a1 1 0 0 0-1 1v1a4 4 0 0 0 4 4" />
    <path d="M18 9h3a1 1 0 0 1 1 1v1a4 4 0 0 1-4 4" />
  </svg>
);
const TimeClockIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <polyline points="12 7 12 12 15 15" />
  </svg>
);
const SchedulingIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <polyline points="9 16 11 18 15 14" />
  </svg>
);
const ProjectsIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="13" y2="16" />
    <circle cx="7.5" cy="12" r="0.5" fill="currentColor" />
    <circle cx="7.5" cy="16" r="0.5" fill="currentColor" />
  </svg>
);
const PayrollIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="7" x2="12" y2="17" />
    <path d="M15 10a3 3 0 0 0-6 0c0 4 6 4 6 0a3 3 0 0 0-6 0" />
  </svg>
);
const AssetIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="2" y="3" width="20" height="14" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </svg>
);

/* ── Nav groups — all items default enabled & active ── */

export const HR_NAV_GROUPS: NavGroup[] = [
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
      },
    ],
  },
  {
    label: 'People Management',
    items: [
      {
        key: 'departments',
        label: 'Departments',
        icon: <DepartmentsIcon />,
        href: 'departments',
        enabled: true,
        active: true,
      },
      {
        key: 'branches',
        label: 'Branches',
        icon: <BranchesIcon />,
        href: 'branches',
        enabled: true,
        active: false,
      },
      {
        key: 'employees',
        label: 'Employees',
        icon: <EmployeesIcon />,
        href: 'employees',
        enabled: true,
        active: true,
      },
      {
        key: 'leave',
        label: 'Leave Management',
        icon: <LeaveIcon />,
        href: 'leave',
        enabled: true,
        active: false,
      },
      {
        key: 'appraisal',
        label: 'Appraisal',
        icon: <AppraisalIcon />,
        href: 'appraisal',
        enabled: true,
        active: true,
      },
    ],
  },
  {
    label: 'Workforce Management',
    items: [
      {
        key: 'timeclock',
        label: 'Time Clock',
        icon: <TimeClockIcon />,
        href: 'time-clock',
        enabled: true,
        active: false,
      },
      {
        key: 'scheduling',
        label: 'Smart Scheduling',
        icon: <SchedulingIcon />,
        href: 'scheduling',
        enabled: true,
        active: false,
      },
      {
        key: 'projects',
        label: 'Project & Tasks',
        icon: <ProjectsIcon />,
        href: 'projects',
        enabled: true,
        active: false,
      },
    ],
  },
  {
    label: 'Payroll and Compensation',
    items: [
      {
        key: 'payroll',
        label: 'Payroll',
        icon: <PayrollIcon />,
        href: 'payroll',
        enabled: true,
        active: false,
      },
    ],
  },
  {
    label: 'Assets & Resources',
    items: [
      {
        key: 'assets',
        label: 'Asset Management',
        icon: <AssetIcon />,
        href: 'assets',
        enabled: true,
        active: false,
      },
    ],
  },
  {
    label: 'Management',
    items: [
      {
        key: 'management',
        label: 'HR Management',
        icon: <BuildingIcon />,
        href: 'hrmanagement',
        enabled: true,
        active: true,
      },
    ],
  },
];
