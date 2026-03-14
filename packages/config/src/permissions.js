"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ROLE_PERMISSIONS = exports.Permission = void 0;
var Permission;
(function (Permission) {
    // ── Tenant ────────────────────────────────────────────────────────────────
    Permission["READ_TENANT"] = "read:tenant";
    Permission["UPDATE_TENANT"] = "update:tenant";
    // ── Users ─────────────────────────────────────────────────────────────────
    Permission["INVITE_USER"] = "invite:user";
    Permission["READ_USERS"] = "read:users";
    Permission["UPDATE_USER"] = "update:user";
    Permission["DEACTIVATE_USER"] = "deactivate:user";
    Permission["FORCE_RESET_USER"] = "force_reset:user";
    Permission["GRANT_PERMISSION"] = "grant:permission";
    // ── Employees ─────────────────────────────────────────────────────────────
    Permission["CREATE_EMPLOYEE"] = "create:employee";
    Permission["READ_EMPLOYEES"] = "read:employees";
    Permission["READ_OWN_PROFILE"] = "read:own_profile";
    Permission["UPDATE_EMPLOYEE"] = "update:employee";
    Permission["DELETE_EMPLOYEE"] = "delete:employee";
    Permission["MANAGE_DOCUMENTS"] = "manage:documents";
    // ── Departments ───────────────────────────────────────────────────────────
    Permission["CREATE_DEPARTMENT"] = "create:department";
    Permission["READ_DEPARTMENTS"] = "read:departments";
    Permission["UPDATE_DEPARTMENT"] = "update:department";
    Permission["DELETE_DEPARTMENT"] = "delete:department";
    // ── Leave ─────────────────────────────────────────────────────────────────
    Permission["REQUEST_LEAVE"] = "request:leave";
    Permission["APPROVE_LEAVE"] = "approve:leave";
    Permission["READ_ALL_LEAVES"] = "read:all_leaves";
    Permission["READ_OWN_LEAVE"] = "read:own_leave";
    Permission["MANAGE_LEAVE_TYPES"] = "manage:leave_types";
    // ── Time Management ───────────────────────────────────────────────────────
    Permission["CLOCK_IN_OUT"] = "clock:in_out";
    Permission["READ_TIMESHEETS"] = "read:timesheets";
    Permission["APPROVE_TIMESHEET"] = "approve:timesheet";
    Permission["MANAGE_SCHEDULES"] = "manage:schedules";
    // ── Payroll ───────────────────────────────────────────────────────────────
    Permission["READ_PAYROLL"] = "read:payroll";
    Permission["RUN_PAYROLL"] = "run:payroll";
    Permission["APPROVE_PAYROLL"] = "approve:payroll";
    Permission["READ_OWN_PAYSLIP"] = "read:own_payslip";
    Permission["MANAGE_PAYROLL_SETTINGS"] = "manage:payroll_settings";
    // ── Appraisal ─────────────────────────────────────────────────────────────
    Permission["CREATE_APPRAISAL"] = "create:appraisal";
    Permission["READ_APPRAISALS"] = "read:appraisals";
    Permission["SUBMIT_REVIEW"] = "submit:review";
    Permission["READ_OWN_REVIEW"] = "read:own_review";
    // ── Projects ──────────────────────────────────────────────────────────────
    Permission["CREATE_PROJECT"] = "create:project";
    Permission["READ_PROJECTS"] = "read:projects";
    Permission["UPDATE_PROJECT"] = "update:project";
    Permission["ASSIGN_PROJECT"] = "assign:project";
    // ── Assets ────────────────────────────────────────────────────────────────
    Permission["MANAGE_ASSETS"] = "manage:assets";
    Permission["READ_ASSETS"] = "read:assets";
    Permission["ASSIGN_ASSET"] = "assign:asset";
    // ── Marketing ─────────────────────────────────────────────────────────────
    Permission["MANAGE_LEADS"] = "manage:leads";
    Permission["READ_LEADS"] = "read:leads";
    Permission["MANAGE_CAMPAIGNS"] = "manage:campaigns";
    Permission["READ_CAMPAIGNS"] = "read:campaigns";
    Permission["VIEW_ANALYTICS"] = "view:analytics";
})(Permission || (exports.Permission = Permission = {}));
// Base permissions per role — hardcoded, always enforced
exports.ROLE_PERMISSIONS = {
    SUPER_ADMIN: Object.values(Permission), // All permissions
    TENANT_ADMIN: [
        Permission.READ_TENANT,
        Permission.UPDATE_TENANT,
        Permission.INVITE_USER,
        Permission.READ_USERS,
        Permission.UPDATE_USER,
        Permission.DEACTIVATE_USER,
        Permission.FORCE_RESET_USER,
        Permission.GRANT_PERMISSION,
        Permission.CREATE_EMPLOYEE,
        Permission.READ_EMPLOYEES,
        Permission.UPDATE_EMPLOYEE,
        Permission.DELETE_EMPLOYEE,
        Permission.MANAGE_DOCUMENTS,
        Permission.CREATE_DEPARTMENT,
        Permission.READ_DEPARTMENTS,
        Permission.UPDATE_DEPARTMENT,
        Permission.DELETE_DEPARTMENT,
        Permission.APPROVE_LEAVE,
        Permission.READ_ALL_LEAVES,
        Permission.MANAGE_LEAVE_TYPES,
        Permission.READ_TIMESHEETS,
        Permission.APPROVE_TIMESHEET,
        Permission.MANAGE_SCHEDULES,
        Permission.READ_PAYROLL,
        Permission.RUN_PAYROLL,
        Permission.APPROVE_PAYROLL,
        Permission.MANAGE_PAYROLL_SETTINGS,
        Permission.READ_APPRAISALS,
        Permission.CREATE_APPRAISAL,
        Permission.CREATE_PROJECT,
        Permission.READ_PROJECTS,
        Permission.UPDATE_PROJECT,
        Permission.ASSIGN_PROJECT,
        Permission.MANAGE_ASSETS,
        Permission.READ_ASSETS,
        Permission.ASSIGN_ASSET,
        Permission.MANAGE_LEADS,
        Permission.READ_LEADS,
        Permission.MANAGE_CAMPAIGNS,
        Permission.READ_CAMPAIGNS,
        Permission.VIEW_ANALYTICS,
    ],
    HR_MANAGER: [
        Permission.INVITE_USER,
        Permission.READ_USERS,
        Permission.UPDATE_USER,
        Permission.CREATE_EMPLOYEE,
        Permission.READ_EMPLOYEES,
        Permission.UPDATE_EMPLOYEE,
        Permission.MANAGE_DOCUMENTS,
        Permission.READ_DEPARTMENTS,
        Permission.CREATE_DEPARTMENT,
        Permission.UPDATE_DEPARTMENT,
        Permission.REQUEST_LEAVE,
        Permission.APPROVE_LEAVE,
        Permission.READ_ALL_LEAVES,
        Permission.MANAGE_LEAVE_TYPES,
        Permission.READ_OWN_LEAVE,
        Permission.CLOCK_IN_OUT,
        Permission.READ_TIMESHEETS,
        Permission.APPROVE_TIMESHEET,
        Permission.MANAGE_SCHEDULES,
        Permission.READ_PAYROLL,
        Permission.RUN_PAYROLL,
        Permission.READ_OWN_PAYSLIP,
        Permission.CREATE_APPRAISAL,
        Permission.READ_APPRAISALS,
        Permission.SUBMIT_REVIEW,
        Permission.READ_OWN_REVIEW,
        Permission.CREATE_PROJECT,
        Permission.READ_PROJECTS,
        Permission.UPDATE_PROJECT,
        Permission.ASSIGN_PROJECT,
        Permission.READ_ASSETS,
        Permission.ASSIGN_ASSET,
    ],
    HR_STAFF: [
        Permission.READ_EMPLOYEES,
        Permission.UPDATE_EMPLOYEE,
        Permission.MANAGE_DOCUMENTS,
        Permission.READ_DEPARTMENTS,
        Permission.REQUEST_LEAVE,
        Permission.READ_ALL_LEAVES,
        Permission.READ_OWN_LEAVE,
        Permission.CLOCK_IN_OUT,
        Permission.READ_TIMESHEETS,
        Permission.READ_OWN_PAYSLIP,
        Permission.READ_APPRAISALS,
        Permission.SUBMIT_REVIEW,
        Permission.READ_OWN_REVIEW,
        Permission.READ_PROJECTS,
        Permission.READ_ASSETS,
    ],
    EMPLOYEE: [
        Permission.READ_OWN_PROFILE,
        Permission.REQUEST_LEAVE,
        Permission.READ_OWN_LEAVE,
        Permission.CLOCK_IN_OUT,
        Permission.READ_OWN_PAYSLIP,
        Permission.SUBMIT_REVIEW,
        Permission.READ_OWN_REVIEW,
        Permission.READ_PROJECTS,
    ],
    ACCOUNTANT: [
        Permission.READ_EMPLOYEES,
        Permission.READ_DEPARTMENTS,
        Permission.READ_PAYROLL,
        Permission.RUN_PAYROLL,
        Permission.APPROVE_PAYROLL,
        Permission.READ_OWN_PAYSLIP,
        Permission.MANAGE_PAYROLL_SETTINGS,
        Permission.READ_PROJECTS,
    ],
    MARKETING_MANAGER: [
        Permission.INVITE_USER,
        Permission.READ_USERS,
        Permission.MANAGE_LEADS,
        Permission.READ_LEADS,
        Permission.MANAGE_CAMPAIGNS,
        Permission.READ_CAMPAIGNS,
        Permission.VIEW_ANALYTICS,
        Permission.READ_PROJECTS,
        Permission.CREATE_PROJECT,
        Permission.UPDATE_PROJECT,
        Permission.ASSIGN_PROJECT,
    ],
    MARKETING_STAFF: [
        Permission.READ_LEADS,
        Permission.MANAGE_LEADS,
        Permission.READ_CAMPAIGNS,
        Permission.VIEW_ANALYTICS,
        Permission.READ_PROJECTS,
    ],
};
//# sourceMappingURL=permissions.js.map