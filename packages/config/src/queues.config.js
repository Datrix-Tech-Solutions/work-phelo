"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.QUEUES = exports.ROUTING_KEYS = exports.EXCHANGES = void 0;
exports.EXCHANGES = {
    ERP_EVENTS: 'erp.events',
};
exports.ROUTING_KEYS = {
    LEAVE_APPROVED: 'leave.approved',
    LEAVE_REJECTED: 'leave.rejected',
    PAYSLIP_GENERATED: 'payslip.generated',
    EMPLOYEE_ONBOARDED: 'employee.onboarded',
    EMPLOYEE_OFFBOARDED: 'employee.offboarded',
    SUBSCRIPTION_EXPIRING: 'subscription.expiring',
    SUBSCRIPTION_EXPIRED: 'subscription.expired',
    WORKFLOW_TASK_ASSIGNED: 'workflow.task.assigned',
    TENANT_APPROVED: 'tenant.approved',
    TENANT_REJECTED: 'tenant.rejected',
    SHIFT_PUBLISHED: 'shift.published',
    APPRAISAL_DUE: 'appraisal.due',
};
exports.QUEUES = {
    NOTIFICATIONS: 'notifications',
    PAYROLL: 'payroll',
    EMAIL: 'email',
    SMS: 'sms',
    PUSH: 'push',
};
//# sourceMappingURL=queues.config.js.map