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

  // HR → Auth
  AUTH_INVITE_EMPLOYEE: 'auth.invite_employee',
  AUTH_EMPLOYEE_OFFBOARDED: 'hr.employee_offboarded',
  AUTH_RESEND_EMPLOYEE_INVITE: 'auth.resend_employee_invite',

  // Auth → Notification
  NOTIFICATION_EMAIL_VERIFICATION: 'notification.email_verification',
  NOTIFICATION_INVITE_USER: 'notification.invite_user',
  NOTIFICATION_PASSWORD_RESET_LINK: 'notification.password_reset_link',
  NOTIFICATION_PASSWORD_RESET_OTP: 'notification.password_reset_otp',
  NOTIFICATION_SMS_OTP: 'notification.sms_otp',

  // HR → Notification
  NOTIFY_EMPLOYEE_TERMINATION: 'notify.employee_termination',
} as const;

export type EventPattern = (typeof EventPatterns)[keyof typeof EventPatterns];

// ── Auth → HR Events ───────────────────────────────────────────────────────

export interface TenantApprovedEvent {
  tenantId: string;
}

export interface EmployeeActivatedEvent {
  tenantId: string;
  email: string;
  userId: string;
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

// ── Auth/HR → Notification Events ─────────────────────────────────────────

export interface EmailVerificationEvent {
  userId?: string;
  tenantId?: string;
  email: string;
  firstName: string;
  otp: string;
  tenantName: string;
}

export interface InviteUserEvent {
  userId?: string;
  tenantId?: string;
  email: string;
  firstName: string;
  inviteToken?: string;
  acceptInviteUrl: string;
  tenantName: string;
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
