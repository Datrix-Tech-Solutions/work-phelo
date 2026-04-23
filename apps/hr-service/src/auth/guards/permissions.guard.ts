import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '@work-phelo/config';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

type PermissionRule = { resource: string; actions: string[] };

const DENY_MESSAGE =
  "You don't have permission to access this. Contact your administrator.";

const PERMISSION_TO_RULES: Record<string, PermissionRule[]> = {
  // ── Employees ────────────────────────────────────────────────────────────
  [Permission.CREATE_EMPLOYEE]: [
    { resource: 'employees', actions: ['CREATE'] },
  ],
  [Permission.READ_EMPLOYEES]: [{ resource: 'employees', actions: ['VIEW'] }],
  [Permission.READ_TEAM_EMPLOYEES]: [
    { resource: 'employees', actions: ['VIEW'] },
  ],
  [Permission.READ_OWN_PROFILE]: [{ resource: 'employees', actions: ['VIEW'] }],
  [Permission.UPDATE_EMPLOYEE]: [{ resource: 'employees', actions: ['EDIT'] }],
  [Permission.UPDATE_OWN_PROFILE]: [
    { resource: 'employees', actions: ['EDIT'] },
  ],
  [Permission.DELETE_EMPLOYEE]: [
    { resource: 'employees', actions: ['DELETE'] },
  ],
  [Permission.OFFBOARD_EMPLOYEE]: [
    { resource: 'employees', actions: ['DELETE'] },
  ],
  [Permission.SUBMIT_RESIGNATION]: [
    { resource: 'resignations', actions: ['CREATE'] },
  ],
  [Permission.WITHDRAW_RESIGNATION]: [
    { resource: 'resignations', actions: ['DELETE'] },
  ],
  [Permission.MANAGE_DOCUMENTS]: [
    { resource: 'documents', actions: ['CREATE', 'EDIT'] },
  ],
  [Permission.EXPORT_EMPLOYEES]: [
    { resource: 'employees', actions: ['EXPORT'] },
  ],
  [Permission.READ_HR_SETTINGS]: [
    { resource: 'hr-settings', actions: ['VIEW'] },
  ],
  [Permission.MANAGE_HR_SETTINGS]: [
    { resource: 'hr-settings', actions: ['EDIT'] },
  ],

  // ── Departments ───────────────────────────────────────────────────────────
  [Permission.CREATE_DEPARTMENT]: [
    { resource: 'departments', actions: ['CREATE'] },
    { resource: 'branches', actions: ['CREATE'] },
  ],
  [Permission.READ_DEPARTMENTS]: [
    { resource: 'departments', actions: ['VIEW'] },
    { resource: 'branches', actions: ['VIEW'] },
  ],
  [Permission.UPDATE_DEPARTMENT]: [
    { resource: 'departments', actions: ['EDIT'] },
    { resource: 'branches', actions: ['EDIT'] },
  ],
  [Permission.DELETE_DEPARTMENT]: [
    { resource: 'departments', actions: ['DELETE'] },
    { resource: 'branches', actions: ['DELETE'] },
  ],

  // ── Leave ─────────────────────────────────────────────────────────────────
  [Permission.REQUEST_LEAVE]: [{ resource: 'leave', actions: ['CREATE'] }],
  [Permission.APPROVE_LEAVE]: [{ resource: 'leave', actions: ['APPROVE'] }],
  [Permission.APPROVE_TEAM_LEAVE]: [
    { resource: 'leave', actions: ['APPROVE'] },
  ],
  [Permission.READ_ALL_LEAVES]: [{ resource: 'leave', actions: ['VIEW'] }],
  [Permission.READ_TEAM_LEAVES]: [{ resource: 'leave', actions: ['VIEW'] }],
  [Permission.READ_OWN_LEAVE]: [{ resource: 'leave', actions: ['VIEW'] }],
  [Permission.MANAGE_LEAVE_TYPES]: [{ resource: 'leave', actions: ['EDIT'] }],

  // ── Time Management ───────────────────────────────────────────────────────
  [Permission.CLOCK_IN_OUT]: [{ resource: 'attendance', actions: ['CREATE'] }],
  [Permission.READ_ATTENDANCE]: [{ resource: 'attendance', actions: ['VIEW'] }],
  [Permission.READ_TEAM_ATTENDANCE]: [
    { resource: 'attendance', actions: ['VIEW'] },
  ],
  [Permission.SUBMIT_TIME_CORRECTION]: [
    { resource: 'time-corrections', actions: ['CREATE'] },
  ],
  [Permission.APPROVE_TIME_CORRECTION]: [
    { resource: 'time-corrections', actions: ['APPROVE'] },
  ],
  [Permission.APPROVE_TEAM_TIME]: [
    { resource: 'time-corrections', actions: ['APPROVE'] },
  ],
  [Permission.READ_TIMESHEETS]: [{ resource: 'timesheets', actions: ['VIEW'] }],
  [Permission.APPROVE_TIMESHEET]: [
    { resource: 'timesheets', actions: ['APPROVE'] },
  ],
  [Permission.MANAGE_SCHEDULES]: [
    { resource: 'schedules', actions: ['CREATE', 'EDIT'] },
  ],
  [Permission.MANAGE_TEAM_SCHEDULES]: [
    { resource: 'schedules', actions: ['CREATE', 'EDIT'] },
  ],

  // ── Payroll ───────────────────────────────────────────────────────────────
  [Permission.READ_PAYROLL]: [{ resource: 'payroll', actions: ['VIEW'] }],
  [Permission.RUN_PAYROLL]: [{ resource: 'payroll', actions: ['RUN'] }],
  [Permission.APPROVE_PAYROLL]: [{ resource: 'payroll', actions: ['APPROVE'] }],
  [Permission.READ_OWN_PAYSLIP]: [{ resource: 'payroll', actions: ['VIEW'] }],
  [Permission.MANAGE_PAYROLL_SETTINGS]: [
    { resource: 'payroll', actions: ['EDIT'] },
  ],

  // ── Appraisals ────────────────────────────────────────────────────────────
  [Permission.CONFIGURE_APPRAISAL]: [
    { resource: 'appraisals', actions: ['CREATE'] },
  ],
  [Permission.CREATE_APPRAISAL]: [
    { resource: 'appraisals', actions: ['CREATE'] },
  ],
  [Permission.READ_APPRAISALS]: [{ resource: 'appraisals', actions: ['VIEW'] }],
  [Permission.READ_TEAM_APPRAISALS]: [
    { resource: 'appraisals', actions: ['VIEW'] },
  ],
  [Permission.SUBMIT_SELF_ASSESSMENT]: [
    { resource: 'appraisals', actions: ['EDIT'] },
  ],
  [Permission.SUBMIT_MANAGER_REVIEW]: [
    { resource: 'appraisals', actions: ['EDIT'] },
  ],
  [Permission.READ_OWN_REVIEW]: [{ resource: 'appraisals', actions: ['VIEW'] }],
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) throw new ForbiddenException(DENY_MESSAGE);

    if (user.role === 'SUPER_ADMIN' || user.role === 'TENANT_ADMIN')
      return true;

    const userPerms = new Set<string>(user.permissions ?? []);

    for (const permission of requiredPermissions) {
      const rules = PERMISSION_TO_RULES[permission];
      if (!rules || rules.length === 0) {
        throw new ForbiddenException(DENY_MESSAGE);
      }

      const hasPermission = rules.some((rule) =>
        rule.actions.some((action) =>
          userPerms.has(`${rule.resource}:${action}`),
        ),
      );

      if (!hasPermission) throw new ForbiddenException(DENY_MESSAGE);
    }

    return true;
  }
}
