// ── Event Infrastructure ───────────────────────────────────────────────────

/**
 * Metadata injected into every event envelope by the publisher.
 * Consumers can use messageId for idempotency and correlationId for tracing.
 */
export interface EventMeta {
  /** Unique ID for this specific message — use for idempotency checks */
  messageId: string;
  /** Traces a chain of events back to the originating request */
  correlationId: string;
  /** ISO timestamp of when the event was published */
  timestamp: string;
}

/** Utility: the full envelope shape a consumer receives */
export type WithMeta<T> = T & { _meta: EventMeta };

// ── Event Pattern Constants ────────────────────────────────────────────────

export const EventPatterns = {
  // Auth → HR
  HR_TENANT_APPROVED: 'hr.tenant_approved',
  HR_EMPLOYEE_ACTIVATED: 'hr.employee_activated',
  HR_PROVISION_TENANT_WORKSPACE: 'hr.provision_tenant_workspace',
  HR_LINK_EMPLOYEE_IDENTITY: 'hr.link_employee_identity',

  // HR → Auth
  AUTH_INVITE_EMPLOYEE: 'auth.invite_employee',
  AUTH_EMPLOYEE_OFFBOARDED: 'hr.employee_offboarded',
  AUTH_RESEND_EMPLOYEE_INVITE: 'auth.resend_employee_invite',
  AUTH_PROVISION_EMPLOYEE_INVITE: 'auth.provision_employee_invite',
  AUTH_DELETE_PENDING_EMPLOYEE_INVITE: 'auth.delete_pending_employee_invite',

  // Auth → Notification
  NOTIFICATION_EMAIL_VERIFICATION: 'notification.email_verification',
  NOTIFICATION_INVITE_USER: 'notification.invite_user',
  NOTIFICATION_PASSWORD_RESET_LINK: 'notification.password_reset_link',
  NOTIFICATION_PASSWORD_RESET_OTP: 'notification.password_reset_otp',
  NOTIFICATION_SMS_OTP: 'notification.sms_otp',

  // HR → Notification
  NOTIFY_EMPLOYEE_TERMINATION: 'notify.employee_termination',
  NOTIFY_RESIGNATION_SUBMITTED: 'notify.resignation_submitted',
  NOTIFY_LEAVE_REQUESTED: 'notify.leave_requested',
  NOTIFY_LEAVE_REVIEWED: 'notify.leave_reviewed',
  NOTIFY_LEAVE_CANCELLED: 'notify.leave_cancelled',
  NOTIFY_TIME_CORRECTION_SUBMITTED: 'notify.time_correction_submitted',
} as const;

export type EventPattern = (typeof EventPatterns)[keyof typeof EventPatterns];

// ── Auth → HR Events ───────────────────────────────────────────────────────

export interface TenantApprovedEvent {
  tenantId: string;
  adminEmail: string;
  adminUserId?: string;
}

export interface EmployeeActivatedEvent {
  tenantId: string;
  email: string;
  userId: string;
}

export interface ProvisionTenantWorkspaceCommand {
  tenantId: string;
  adminEmail: string;
  adminUserId?: string;
}

export interface ProvisionTenantWorkspaceResult {
  provisioned: boolean;
}

export interface LinkEmployeeIdentityCommand {
  tenantId: string;
  email: string;
  userId: string;
}

export interface LinkEmployeeIdentityResult {
  linked: boolean;
  employeeId: string;
}

// ── HR → Auth Events ───────────────────────────────────────────────────────

export interface InviteEmployeeEvent {
  tenantId: string;
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface EmployeeOffboardedEvent {
  tenantId: string;
  userId: string;
  email: string;
  reason: string;
}

export interface ResendEmployeeInviteEvent {
  tenantId: string;
  employeeId: string;
  email: string;
  firstName: string;
  lastName?: string;
}

export interface ProvisionEmployeeInviteCommand {
  tenantId: string;
  employeeId?: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
}

export interface ProvisionEmployeeInviteResult {
  userId: string;
  email: string;
  inviteSent: boolean;
}

export interface DeletePendingEmployeeInviteCommand {
  tenantId: string;
  userId?: string;
  email: string;
}

export interface DeletePendingEmployeeInviteResult {
  deleted: boolean;
}

// ── Auth/HR → Notification Events ─────────────────────────────────────────

export interface EmailVerificationEvent {
  userId?: string;
  tenantId?: string;
  email: string;
  firstName: string;
  otp: string;
  tenantName: string;
}

export type InviteUserKind = 'EMPLOYEE' | 'TENANT_ADMIN';

export interface InviteUserEvent {
  userId?: string;
  tenantId?: string;
  email: string;
  firstName: string;
  inviteToken?: string;
  acceptInviteUrl: string;
  tenantName: string;
  inviteKind?: InviteUserKind;
}

export interface PasswordResetLinkEvent {
  userId?: string;
  tenantId?: string;
  email: string;
  firstName: string;
  resetLink: string;
  otpCode?: string;
  tenantName: string;
}

export interface PasswordResetOtpEvent {
  userId?: string;
  tenantId?: string;
  phone: string;
  otp: string;
  firstName: string;
}

export interface SmsOtpEvent {
  userId?: string;
  tenantId?: string;
  phone: string;
  otp: string;
  context: string;
}

// ── HR → Notification Events ───────────────────────────────────────────────

export interface EmployeeTerminationEvent {
  tenantId: string;
  employeeId: string;
  email: string;
  firstName: string;
  lastName: string;
  reason: string;
  lastWorkingDate: string;
}

export interface ResignationSubmittedEvent {
  tenantId: string;
  adminEmail: string;
  employeeId: string;
  employeeFirstName: string;
  employeeLastName: string;
  lastWorkingDate: string;
  reason?: string;
  additionalNotes?: string;
  detailLink?: string;
}

export interface LeaveRequestedEvent {
  tenantId: string;
  employeeId: string;
  employeeFirstName: string;
  employeeLastName: string;
  /** Manager's email — null if the employee has no assigned manager */
  managerEmail: string | null;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason?: string;
  detailLink?: string;
}

export interface LeaveReviewedEvent {
  tenantId: string;
  employeeId: string;
  employeeEmail: string;
  employeeFirstName: string;
  status: 'APPROVED' | 'REJECTED';
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  note?: string;
}

export interface LeaveCancelledEvent {
  tenantId: string;
  employeeId: string;
  employeeFirstName: string;
  employeeLastName: string;
  /** Manager's email — null if no manager found */
  managerEmail: string | null;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
}

export interface TimeCorrectionSubmittedEvent {
  tenantId: string;
  correctionId: string;
  employeeId: string;
  employeeFirstName: string;
  employeeLastName: string;
  attendanceDate: string;
  requestedIn: string | null;
  requestedOut: string | null;
  reason: string;
  /** Company Admin email from TenantConfig — null if not configured */
  adminEmail: string | null;
  /** Manager's email — null if employee has no assigned manager */
  managerEmail: string | null;
  detailLink?: string;
}
