export enum Permission {
  // ── Tenant / Platform ─────────────────────────────────────────────────────
  READ_TENANT = 'read:tenant',
  UPDATE_TENANT = 'update:tenant',
  MANAGE_MODULES = 'manage:modules',
  VIEW_AUDIT_LOGS = 'view:audit_logs',

  // ── Users ─────────────────────────────────────────────────────────────────
  INVITE_USER = 'invite:user',
  READ_USERS = 'read:users',
  UPDATE_USER = 'update:user',
  DEACTIVATE_USER = 'deactivate:user',
  FORCE_RESET_USER = 'force_reset:user',
  VIEW_PERMISSION_SETS = 'view:permission_sets',
  GRANT_PERMISSION = 'grant:permission',

  // ── Employees ─────────────────────────────────────────────────────────────
  CREATE_EMPLOYEE = 'create:employee',
  READ_EMPLOYEES = 'read:employees',
  READ_OWN_PROFILE = 'read:own_profile',
  UPDATE_EMPLOYEE = 'update:employee',
  UPDATE_OWN_PROFILE = 'update:own_profile',
  DELETE_EMPLOYEE = 'delete:employee',
  OFFBOARD_EMPLOYEE = 'offboard:employee',
  SUBMIT_RESIGNATION = 'submit:resignation',
  WITHDRAW_RESIGNATION = 'withdraw:resignation',
  MANAGE_DOCUMENTS = 'manage:documents',
  EXPORT_EMPLOYEES = 'export:employees',
  READ_HR_SETTINGS = 'read:hr_settings',
  MANAGE_HR_SETTINGS = 'manage:hr_settings',

  // ── Branches ──────────────────────────────────────────────────────────────
  CREATE_BRANCH = 'create:branch',
  READ_BRANCHES = 'read:branches',
  UPDATE_BRANCH = 'update:branch',
  DELETE_BRANCH = 'delete:branch',

  // ── Departments ───────────────────────────────────────────────────────────
  CREATE_DEPARTMENT = 'create:department',
  READ_DEPARTMENTS = 'read:departments',
  UPDATE_DEPARTMENT = 'update:department',
  DELETE_DEPARTMENT = 'delete:department',
  MANAGE_ROLES = 'manage:roles',
  ASSIGN_ROLE = 'assign:role',

  // ── Leave ─────────────────────────────────────────────────────────────────
  REQUEST_LEAVE = 'request:leave',
  APPROVE_LEAVE = 'approve:leave',
  READ_ALL_LEAVES = 'read:all_leaves',
  READ_OWN_LEAVE = 'read:own_leave',
  MANAGE_LEAVE_TYPES = 'manage:leave_types',

  // ── Time Management ───────────────────────────────────────────────────────
  CLOCK_IN_OUT = 'clock:in_out',
  READ_ATTENDANCE = 'read:attendance',
  SUBMIT_TIME_CORRECTION = 'submit:time_correction',
  APPROVE_TIME_CORRECTION = 'approve:time_correction',
  READ_TIMESHEETS = 'read:timesheets',
  APPROVE_TIMESHEET = 'approve:timesheet',
  MANAGE_SCHEDULES = 'manage:schedules',

  // ── Payroll ───────────────────────────────────────────────────────────────
  READ_PAYROLL = 'read:payroll',
  RUN_PAYROLL = 'run:payroll',
  APPROVE_PAYROLL = 'approve:payroll',
  READ_OWN_PAYSLIP = 'read:own_payslip',
  MANAGE_PAYROLL_SETTINGS = 'manage:payroll_settings',

  // ── Appraisal ─────────────────────────────────────────────────────────────
  CONFIGURE_APPRAISAL = 'configure:appraisal',
  CREATE_APPRAISAL = 'create:appraisal',
  READ_APPRAISALS = 'read:appraisals',
  SUBMIT_SELF_ASSESSMENT = 'submit:self_assessment',
  SUBMIT_MANAGER_REVIEW = 'submit:manager_review',
  READ_OWN_REVIEW = 'read:own_review',

  // ── Projects ──────────────────────────────────────────────────────────────
  CREATE_PROJECT = 'create:project',
  READ_PROJECTS = 'read:projects',
  UPDATE_PROJECT = 'update:project',
  ASSIGN_PROJECT = 'assign:project',

  // ── Assets ────────────────────────────────────────────────────────────────
  MANAGE_ASSETS = 'manage:assets',
  READ_ASSETS = 'read:assets',
  ASSIGN_ASSET = 'assign:asset',

  // ── Marketing (Sprint 5) ──────────────────────────────────────────────────
  MANAGE_LEADS = 'manage:leads',
  READ_LEADS = 'read:leads',
  MANAGE_CAMPAIGNS = 'manage:campaigns',
  READ_CAMPAIGNS = 'read:campaigns',
  VIEW_ANALYTICS = 'view:analytics',
}

// System role platform access — controls WHERE you go after login
export const SYSTEM_ROLE_ACCESS: Record<string, string[]> = {
  SUPER_ADMIN: ['platform_admin'],
  TENANT_ADMIN: ['company_admin'],
  EMPLOYEE: ['employee_home'],
};

// Default company role permissions — seeded for every new tenant
export const COMPANY_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  'Company Admin': [
    Permission.INVITE_USER,
    Permission.READ_USERS,
    Permission.UPDATE_USER,
    Permission.DEACTIVATE_USER,
    Permission.FORCE_RESET_USER,
    Permission.VIEW_PERMISSION_SETS,
    Permission.GRANT_PERMISSION,
    Permission.CREATE_EMPLOYEE,
    Permission.READ_EMPLOYEES,
    Permission.READ_OWN_PROFILE,
    Permission.UPDATE_EMPLOYEE,
    Permission.UPDATE_OWN_PROFILE,
    Permission.DELETE_EMPLOYEE,
    Permission.OFFBOARD_EMPLOYEE,
    Permission.SUBMIT_RESIGNATION,
    Permission.WITHDRAW_RESIGNATION,
    Permission.MANAGE_DOCUMENTS,
    Permission.EXPORT_EMPLOYEES,
    Permission.READ_HR_SETTINGS,
    Permission.MANAGE_HR_SETTINGS,
    Permission.CREATE_BRANCH,
    Permission.READ_BRANCHES,
    Permission.UPDATE_BRANCH,
    Permission.DELETE_BRANCH,
    Permission.CREATE_DEPARTMENT,
    Permission.READ_DEPARTMENTS,
    Permission.UPDATE_DEPARTMENT,
    Permission.DELETE_DEPARTMENT,
    Permission.MANAGE_ROLES,
    Permission.ASSIGN_ROLE,
    Permission.REQUEST_LEAVE,
    Permission.APPROVE_LEAVE,
    Permission.READ_ALL_LEAVES,
    Permission.READ_OWN_LEAVE,
    Permission.MANAGE_LEAVE_TYPES,
    Permission.CLOCK_IN_OUT,
    Permission.READ_ATTENDANCE,
    Permission.SUBMIT_TIME_CORRECTION,
    Permission.APPROVE_TIME_CORRECTION,
    Permission.READ_TIMESHEETS,
    Permission.APPROVE_TIMESHEET,
    Permission.MANAGE_SCHEDULES,
    Permission.READ_PAYROLL,
    Permission.RUN_PAYROLL,
    Permission.APPROVE_PAYROLL,
    Permission.READ_OWN_PAYSLIP,
    Permission.MANAGE_PAYROLL_SETTINGS,
    Permission.CONFIGURE_APPRAISAL,
    Permission.CREATE_APPRAISAL,
    Permission.READ_APPRAISALS,
    Permission.SUBMIT_SELF_ASSESSMENT,
    Permission.SUBMIT_MANAGER_REVIEW,
    Permission.READ_OWN_REVIEW,
  ],

  Employee: [
    Permission.READ_OWN_PROFILE,
    Permission.UPDATE_OWN_PROFILE,
    Permission.SUBMIT_RESIGNATION,
    Permission.WITHDRAW_RESIGNATION,
    Permission.REQUEST_LEAVE,
    Permission.READ_OWN_LEAVE,
    Permission.CLOCK_IN_OUT,
    Permission.SUBMIT_TIME_CORRECTION,
    Permission.READ_OWN_PAYSLIP,
    Permission.SUBMIT_SELF_ASSESSMENT,
    Permission.READ_OWN_REVIEW,
  ],
};
