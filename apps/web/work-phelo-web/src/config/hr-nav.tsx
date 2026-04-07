import { NavGroup } from '@/components/organisms/Sidebar';
import {
  LayoutDashboard,
  CircleDollarSign,
  Building,
  Network,
  Users,
  CalendarRange,
  Trophy,
  Timer,
  CalendarCheck,
  ClipboardList,
  MonitorSmartphone,
  FileSliders,
} from 'lucide-react';

/* ── Icons ── */
const DashboardIcon = () => <LayoutDashboard className="w-5 h-5" />;
const DepartmentsIcon = () => <Building className="w-5 h-5" />;
const BranchesIcon = () => <Network className="w-5 h-5" />;
const EmployeesIcon = () => <Users className="w-5 h-5" />;
const LeaveIcon = () => <CalendarRange className="w-5 h-5" />;
const AppraisalIcon = () => <Trophy className="w-5 h-5" />;
const TimeClockIcon = () => <Timer className="w-5 h-5" />;
const SchedulingIcon = () => <CalendarCheck className="w-5 h-5" />;
const ProjectsIcon = () => <ClipboardList className="w-5 h-5" />;
const PayrollIcon = () => <CircleDollarSign className="w-5 h-5" />;
const AssetIcon = () => <MonitorSmartphone className="w-5 h-5" />;
const ManagementIcon = () => <FileSliders className="w-5 h-5" />;

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
        exact: true,
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
        active: true,
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
        active: true,
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
        active: true,
      },
    ],
  },
  {
    label: 'Management',
    items: [
      {
        key: 'management',
        label: 'HR Management',
        icon: <ManagementIcon />,
        href: 'hrmanagement',
        enabled: true,
        active: true,
      },
    ],
  },
];
