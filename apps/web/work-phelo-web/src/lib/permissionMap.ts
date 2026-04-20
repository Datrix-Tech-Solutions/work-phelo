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
  GRANT_PERMISSION = 'grant:permission',

  // ── Company Roles ─────────────────────────────────────────────────────────
  MANAGE_COMPANY_ROLES = 'manage:company_roles',
  READ_COMPANY_ROLES = 'read:company_roles',

  // ── Employees ─────────────────────────────────────────────────────────────
  CREATE_EMPLOYEE = 'create:employee',
  READ_EMPLOYEES = 'read:employees',
  READ_TEAM_EMPLOYEES = 'read:team_employees',
  READ_OWN_PROFILE = 'read:own_profile',
  UPDATE_EMPLOYEE = 'update:employee',
  UPDATE_OWN_PROFILE = 'update:own_profile',
  DELETE_EMPLOYEE = 'delete:employee',
  OFFBOARD_EMPLOYEE = 'offboard:employee',
  MANAGE_DOCUMENTS = 'manage:documents',
  EXPORT_EMPLOYEES = 'export:employees',

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
  APPROVE_TEAM_LEAVE = 'approve:team_leave',
  READ_ALL_LEAVES = 'read:all_leaves',
  READ_TEAM_LEAVES = 'read:team_leaves',
  READ_OWN_LEAVE = 'read:own_leave',
  MANAGE_LEAVE_TYPES = 'manage:leave_types',

  // ── Time Management ───────────────────────────────────────────────────────
  CLOCK_IN_OUT = 'clock:in_out',
  READ_ATTENDANCE = 'read:attendance',
  READ_TEAM_ATTENDANCE = 'read:team_attendance',
  SUBMIT_TIME_CORRECTION = 'submit:time_correction',
  APPROVE_TIME_CORRECTION = 'approve:time_correction',
  APPROVE_TEAM_TIME = 'approve:team_time',
  READ_TIMESHEETS = 'read:timesheets',
  APPROVE_TIMESHEET = 'approve:timesheet',
  MANAGE_SCHEDULES = 'manage:schedules',
  MANAGE_TEAM_SCHEDULES = 'manage:team_schedules',

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
  READ_TEAM_APPRAISALS = 'read:team_appraisals',
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

  // ── Marketing ─────────────────────────────────────────────────────────────
  MANAGE_LEADS = 'manage:leads',
  READ_LEADS = 'read:leads',
  MANAGE_CAMPAIGNS = 'manage:campaigns',
  READ_CAMPAIGNS = 'read:campaigns',
  VIEW_ANALYTICS = 'view:analytics',
}

// Maps each Permission to the resource:ACTION strings returned in effectivePermissions.
// Action values match the backend PermissionAction enum: VIEW, CREATE, EDIT, DELETE, APPROVE, RUN, EXPORT, ASSIGN
export const PERMISSION_MAP: Record<string, string[]> = {
  // Tenant / Platform
  [Permission.READ_TENANT]: ['tenants:VIEW'],
  [Permission.UPDATE_TENANT]: ['tenants:EDIT'],
  [Permission.MANAGE_MODULES]: ['tenants:EDIT'],
  [Permission.VIEW_AUDIT_LOGS]: ['audit-logs:VIEW'],

  // Users
  [Permission.INVITE_USER]: ['users:CREATE'],
  [Permission.READ_USERS]: ['users:VIEW'],
  [Permission.UPDATE_USER]: ['users:EDIT'],
  [Permission.DEACTIVATE_USER]: ['users:DELETE'],
  [Permission.FORCE_RESET_USER]: ['users:EDIT'],
  [Permission.GRANT_PERMISSION]: ['permission-sets:ASSIGN'],

  // Company Roles
  [Permission.MANAGE_COMPANY_ROLES]: ['company-roles:CREATE', 'company-roles:EDIT'],
  [Permission.READ_COMPANY_ROLES]: ['company-roles:VIEW'],

  // Employees
  [Permission.CREATE_EMPLOYEE]: ['employees:CREATE'],
  [Permission.READ_EMPLOYEES]: ['employees:VIEW'],
  [Permission.READ_TEAM_EMPLOYEES]: ['employees:VIEW'],
  [Permission.READ_OWN_PROFILE]: ['employees:VIEW'],
  [Permission.UPDATE_EMPLOYEE]: ['employees:EDIT'],
  [Permission.UPDATE_OWN_PROFILE]: ['employees:EDIT'],
  [Permission.DELETE_EMPLOYEE]: ['employees:DELETE'],
  [Permission.OFFBOARD_EMPLOYEE]: ['employees:DELETE'],
  [Permission.MANAGE_DOCUMENTS]: ['documents:CREATE', 'documents:EDIT'],
  [Permission.EXPORT_EMPLOYEES]: ['employees:EXPORT'],

  // Departments
  [Permission.CREATE_DEPARTMENT]: ['departments:CREATE'],
  [Permission.READ_DEPARTMENTS]: ['departments:VIEW'],
  [Permission.UPDATE_DEPARTMENT]: ['departments:EDIT'],
  [Permission.DELETE_DEPARTMENT]: ['departments:DELETE'],
  [Permission.MANAGE_ROLES]: ['company-roles:EDIT'],
  [Permission.ASSIGN_ROLE]: ['company-roles:ASSIGN'],

  // Leave
  [Permission.REQUEST_LEAVE]: ['leave:CREATE'],
  [Permission.APPROVE_LEAVE]: ['leave:APPROVE'],
  [Permission.APPROVE_TEAM_LEAVE]: ['leave:APPROVE'],
  [Permission.READ_ALL_LEAVES]: ['leave:VIEW'],
  [Permission.READ_TEAM_LEAVES]: ['leave:VIEW'],
  [Permission.READ_OWN_LEAVE]: ['leave:VIEW'],
  [Permission.MANAGE_LEAVE_TYPES]: ['leave:CREATE', 'leave:EDIT'],

  // Time Management
  [Permission.CLOCK_IN_OUT]: ['attendance:CREATE'],
  [Permission.READ_ATTENDANCE]: ['attendance:VIEW'],
  [Permission.READ_TEAM_ATTENDANCE]: ['attendance:VIEW'],
  [Permission.SUBMIT_TIME_CORRECTION]: ['time-corrections:CREATE'],
  [Permission.APPROVE_TIME_CORRECTION]: ['time-corrections:APPROVE'],
  [Permission.APPROVE_TEAM_TIME]: ['time-corrections:APPROVE'],
  [Permission.READ_TIMESHEETS]: ['timesheets:VIEW'],
  [Permission.APPROVE_TIMESHEET]: ['timesheets:APPROVE'],
  [Permission.MANAGE_SCHEDULES]: ['schedules:CREATE', 'schedules:EDIT'],
  [Permission.MANAGE_TEAM_SCHEDULES]: ['schedules:CREATE', 'schedules:EDIT'],

  // Payroll
  [Permission.READ_PAYROLL]: ['payroll:VIEW'],
  [Permission.RUN_PAYROLL]: ['payroll:RUN'],
  [Permission.APPROVE_PAYROLL]: ['payroll:APPROVE'],
  [Permission.READ_OWN_PAYSLIP]: ['payroll:VIEW'],
  [Permission.MANAGE_PAYROLL_SETTINGS]: ['payroll:EDIT'],

  // Appraisal
  [Permission.CONFIGURE_APPRAISAL]: ['appraisals:EDIT'],
  [Permission.CREATE_APPRAISAL]: ['appraisals:CREATE'],
  [Permission.READ_APPRAISALS]: ['appraisals:VIEW'],
  [Permission.READ_TEAM_APPRAISALS]: ['appraisals:VIEW'],
  [Permission.SUBMIT_SELF_ASSESSMENT]: ['appraisals:EDIT'],
  [Permission.SUBMIT_MANAGER_REVIEW]: ['appraisals:EDIT'],
  [Permission.READ_OWN_REVIEW]: ['appraisals:VIEW'],

  // Projects
  [Permission.CREATE_PROJECT]: ['projects:CREATE'],
  [Permission.READ_PROJECTS]: ['projects:VIEW'],
  [Permission.UPDATE_PROJECT]: ['projects:EDIT'],
  [Permission.ASSIGN_PROJECT]: ['projects:ASSIGN'],

  // Assets
  [Permission.MANAGE_ASSETS]: ['assets:CREATE', 'assets:EDIT'],
  [Permission.READ_ASSETS]: ['assets:VIEW'],
  [Permission.ASSIGN_ASSET]: ['assets:ASSIGN'],

  // Marketing
  [Permission.MANAGE_LEADS]: ['leads:CREATE', 'leads:EDIT'],
  [Permission.READ_LEADS]: ['leads:VIEW'],
  [Permission.MANAGE_CAMPAIGNS]: ['campaigns:CREATE', 'campaigns:EDIT'],
  [Permission.READ_CAMPAIGNS]: ['campaigns:VIEW'],
  [Permission.VIEW_ANALYTICS]: ['analytics:VIEW'],
};

// ── Role permission matrix integration ────────────────────────────────────────
//
// Maps each PermissionMatrix UI action (CREATE/VIEW/EDIT/DELETE) per feature key
// to one or more { resource, action } pairs that the backend PermissionSet expects.
// Resources match seed-resources.ts names; actions match the PermissionAction enum.

type BackendPerm = { resource: string; action: string };
type FeatureActionMapping = Record<string, BackendPerm[]>; // uiAction → backend permissions

export const FEATURE_PERMISSION_MAPPING: Record<string, FeatureActionMapping> = {
  // resource: 'departments'
  departments: {
    CREATE: [{ resource: 'departments', action: 'CREATE' }],
    VIEW: [{ resource: 'departments', action: 'VIEW' }],
    EDIT: [{ resource: 'departments', action: 'EDIT' }],
    DELETE: [{ resource: 'departments', action: 'DELETE' }],
  },

  // resource: 'branches' (not yet seeded — wire up when branch resource is added)
  branches: {
    CREATE: [{ resource: 'branches', action: 'CREATE' }],
    VIEW: [{ resource: 'branches', action: 'VIEW' }],
    EDIT: [{ resource: 'branches', action: 'EDIT' }],
    DELETE: [{ resource: 'branches', action: 'DELETE' }],
  },

  // resource: 'employees'
  employees: {
    CREATE: [{ resource: 'employees', action: 'CREATE' }],
    VIEW: [{ resource: 'employees', action: 'VIEW' }],
    EDIT: [{ resource: 'employees', action: 'EDIT' }],
    DELETE: [{ resource: 'employees', action: 'DELETE' }], // offboard
  },

  // resource: 'leave' — DELETE col maps to APPROVE (not delete a leave record)
  leave: {
    CREATE: [{ resource: 'leave', action: 'CREATE' }],
    VIEW: [{ resource: 'leave', action: 'VIEW' }],
    EDIT: [{ resource: 'leave', action: 'EDIT' }], // manage leave types
    DELETE: [{ resource: 'leave', action: 'APPROVE' }], // approve/reject leave
  },

  // resource: 'appraisals' — DELETE col maps to APPROVE
  appraisal: {
    CREATE: [{ resource: 'appraisals', action: 'CREATE' }],
    VIEW: [{ resource: 'appraisals', action: 'VIEW' }],
    EDIT: [{ resource: 'appraisals', action: 'EDIT' }], // configure cycles
    DELETE: [{ resource: 'appraisals', action: 'APPROVE' }],
  },

  // resources: 'attendance', 'time-corrections', 'timesheets', 'schedules'
  // CREATE → clock in/out + submit correction
  // VIEW   → view all time resources
  // EDIT   → approve corrections/timesheets + manage schedules
  // DELETE → delete schedules
  timeclock: {
    CREATE: [
      { resource: 'attendance', action: 'CREATE' },
      { resource: 'time-corrections', action: 'CREATE' },
    ],
    VIEW: [
      { resource: 'attendance', action: 'VIEW' },
      { resource: 'time-corrections', action: 'VIEW' },
      { resource: 'timesheets', action: 'VIEW' },
      { resource: 'schedules', action: 'VIEW' },
    ],
    EDIT: [
      { resource: 'time-corrections', action: 'APPROVE' },
      { resource: 'timesheets', action: 'APPROVE' },
      { resource: 'schedules', action: 'CREATE' },
      { resource: 'schedules', action: 'EDIT' },
    ],
    DELETE: [{ resource: 'schedules', action: 'DELETE' }],
  },

  // resource: 'projects' (not yet seeded) — DELETE col maps to ASSIGN
  projects: {
    CREATE: [{ resource: 'projects', action: 'CREATE' }],
    VIEW: [{ resource: 'projects', action: 'VIEW' }],
    EDIT: [{ resource: 'projects', action: 'EDIT' }],
    DELETE: [{ resource: 'projects', action: 'ASSIGN' }], // assign project to employee
  },

  // resource: 'payroll' — CREATE → RUN, DELETE → APPROVE
  payroll: {
    CREATE: [{ resource: 'payroll', action: 'RUN' }], // run payroll
    VIEW: [{ resource: 'payroll', action: 'VIEW' }],
    EDIT: [{ resource: 'payroll', action: 'EDIT' }], // manage payroll settings
    DELETE: [{ resource: 'payroll', action: 'APPROVE' }], // approve payroll run
  },

  // resource: 'assets' (not yet seeded) — DELETE col maps to ASSIGN
  assets: {
    CREATE: [{ resource: 'assets', action: 'CREATE' }],
    VIEW: [{ resource: 'assets', action: 'VIEW' }],
    EDIT: [{ resource: 'assets', action: 'EDIT' }],
    DELETE: [{ resource: 'assets', action: 'ASSIGN' }], // assign asset to employee
  },

  // resources: 'company-roles', 'permission-sets', 'audit-logs'
  management: {
    CREATE: [
      { resource: 'company-roles', action: 'CREATE' },
      { resource: 'permission-sets', action: 'CREATE' },
    ],
    VIEW: [
      { resource: 'company-roles', action: 'VIEW' },
      { resource: 'permission-sets', action: 'VIEW' },
      { resource: 'audit-logs', action: 'VIEW' },
    ],
    EDIT: [
      { resource: 'company-roles', action: 'EDIT' },
      { resource: 'permission-sets', action: 'EDIT' },
    ],
    DELETE: [{ resource: 'company-roles', action: 'DELETE' }],
  },
};

/**
 * Reverse of transformFeaturePermissions.
 * Converts the backend resource:action format back to the PermissionMatrix UI state.
 * Input:  { leave: ['CREATE', 'APPROVE'], payroll: ['VIEW', 'RUN'] }
 * Output: { leave: ['CREATE', 'DELETE'], payroll: ['VIEW', 'CREATE'] }
 */
export function reverseTransformFeaturePermissions(
  backendPermissions: Record<string, string[]>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const [featureKey, actionMapping] of Object.entries(FEATURE_PERMISSION_MAPPING)) {
    for (const [uiAction, backendPerms] of Object.entries(actionMapping)) {
      const hasAny = backendPerms.some(({ resource, action }) =>
        (backendPermissions[resource] ?? []).includes(action),
      );
      if (hasAny) {
        if (!result[featureKey]) result[featureKey] = [];
        if (!result[featureKey].includes(uiAction)) result[featureKey].push(uiAction);
      }
    }
  }

  return result;
}

/**
 * Transforms PermissionMatrix UI state into the backend PermissionSet format.
 * Input:  { leave: ['CREATE', 'DELETE'], payroll: ['VIEW'] }
 * Output: { leave: ['CREATE', 'APPROVE'], payroll: ['VIEW'] }
 */
export function transformFeaturePermissions(
  featurePermissions: Record<string, string[]>,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};

  for (const [featureKey, uiActions] of Object.entries(featurePermissions)) {
    if (!uiActions.length) continue;
    const mapping = FEATURE_PERMISSION_MAPPING[featureKey];
    if (!mapping) continue;

    for (const uiAction of uiActions) {
      const backendPerms = mapping[uiAction] ?? [];
      for (const { resource, action } of backendPerms) {
        if (!result[resource]) result[resource] = [];
        if (!result[resource].includes(action)) result[resource].push(action);
      }
    }
  }

  return result;
}
