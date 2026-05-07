export const RESOURCES = [
  {
    name: 'users',
    module: 'AUTH',
    description: 'User accounts and invitations',
  },
  { name: 'tenants', module: 'AUTH', description: 'Company tenants' },
  {
    name: 'permission-sets',
    module: 'AUTH',
    description: 'Permission set bundles',
  },
  { name: 'audit-logs', module: 'AUTH', description: 'Audit trail' },

  { name: 'employees', module: 'HR', description: 'Employee profiles' },
  {
    name: 'employee-profile',
    module: 'HR',
    description: 'Employee self-service profile access',
  },
  { name: 'resignations', module: 'HR', description: 'Employee resignations' },
  { name: 'departments', module: 'HR', description: 'Department management' },
  { name: 'branches', module: 'HR', description: 'Branch locations' },
  { name: 'hr-settings', module: 'HR', description: 'HR workspace settings' },
  { name: 'leave', module: 'HR', description: 'Leave requests and types' },
  { name: 'attendance', module: 'HR', description: 'Clock-in/out records' },
  { name: 'timesheets', module: 'HR', description: 'Weekly timesheets' },
  {
    name: 'time-corrections',
    module: 'HR',
    description: 'Time correction requests',
  },
  { name: 'schedules', module: 'HR', description: 'Shift schedules' },
  { name: 'payroll', module: 'HR', description: 'Payroll runs and payslips' },
  { name: 'appraisals', module: 'HR', description: 'Performance appraisals' },
  { name: 'assets', module: 'HR', description: 'Company asset management' },
  { name: 'announcements', module: 'HR', description: 'Company announcements' },
  { name: 'documents', module: 'HR', description: 'Employee documents' },
  { name: 'allowances', module: 'HR', description: 'Employee allowances' },

  {
    name: 'payroll-reports',
    module: 'FINANCE',
    description: 'Payroll financial reports',
  },
  {
    name: 'expense-reports',
    module: 'FINANCE',
    description: 'Expense reports',
  },

  {
    name: 'platform-settings',
    module: 'PLATFORM',
    description: 'Platform configuration',
  },
  {
    name: 'subscriptions',
    module: 'PLATFORM',
    description: 'Subscription management',
  },
] as const;
