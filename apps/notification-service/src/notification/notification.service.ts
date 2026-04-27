import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '../../prisma/generated/client';
import { InviteUserKind } from '@work-phelo/types';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../channels/email.service';
import { SmsService } from '../channels/sms.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly sms: SmsService,
  ) {}

  private async isDuplicate(
    recipient: string,
    type: NotificationType,
  ): Promise<boolean> {
    const since = new Date(Date.now() - 2 * 60 * 1000);
    const existing = await this.prisma.notificationLog.findFirst({
      where: { recipient, type, status: 'SENT', sentAt: { gt: since } },
    });
    return !!existing;
  }

  async sendEmailVerification(data: {
    userId?: string;
    tenantId?: string;
    email: string;
    firstName: string;
    otp: string;
    tenantName?: string;
  }) {
    if (
      await this.isDuplicate(data.email, NotificationType.EMAIL_VERIFICATION)
    ) {
      this.logger.warn(
        `Duplicate EMAIL_VERIFICATION suppressed for ${data.email}`,
      );
      return;
    }
    const success = await this.email.sendEmailVerificationOtp(
      data.email,
      data.firstName,
      data.otp,
    );
    await this.log({
      userId: data.userId ?? 'system',
      tenantId: data.tenantId ?? 'system',
      type: 'EMAIL_VERIFICATION',
      channel: 'EMAIL',
      recipient: data.email,
      subject: 'Verify your email',
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendInvite(data: {
    userId?: string;
    tenantId?: string;
    email: string;
    firstName: string;
    inviteToken?: string;
    acceptInviteUrl: string;
    tenantName: string;
    inviteKind?: InviteUserKind;
  }) {
    if (await this.isDuplicate(data.email, NotificationType.INVITE_USER)) {
      this.logger.warn(`Duplicate INVITE_USER suppressed for ${data.email}`);
      return;
    }
    const isTenantAdminInvite = data.inviteKind === 'TENANT_ADMIN';
    const success = isTenantAdminInvite
      ? await this.email.sendTenantAdminWelcomeEmail(
          data.email,
          data.firstName,
          data.tenantName,
          data.acceptInviteUrl,
        )
      : await this.email.sendEmployeeInviteEmail(
          data.email,
          data.firstName,
          data.tenantName,
          data.acceptInviteUrl,
        );
    await this.log({
      userId: data.userId ?? 'system',
      tenantId: data.tenantId ?? 'system',
      type: 'INVITE_USER',
      channel: 'EMAIL',
      recipient: data.email,
      subject: isTenantAdminInvite
        ? `Welcome to ${data.tenantName}`
        : `Invitation to ${data.tenantName}`,
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendPasswordResetLink(data: {
    userId?: string;
    tenantId?: string;
    email: string;
    firstName: string;
    resetLink: string;
    otpCode?: string;
    tenantName?: string;
  }) {
    if (
      await this.isDuplicate(data.email, NotificationType.PASSWORD_RESET_LINK)
    ) {
      this.logger.warn(
        `Duplicate PASSWORD_RESET_LINK suppressed for ${data.email}`,
      );
      return;
    }
    const success = await this.email.sendPasswordResetLink(
      data.email,
      data.firstName,
      data.resetLink,
      data.otpCode,
    );
    await this.log({
      userId: data.userId ?? 'system',
      tenantId: data.tenantId ?? 'system',
      type: 'PASSWORD_RESET_LINK',
      channel: 'EMAIL',
      recipient: data.email,
      subject: 'Reset your password',
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendPasswordResetOtp(data: {
    userId?: string;
    tenantId?: string;
    phone?: string;
    email?: string;
    firstName: string;
    otp: string;
  }) {
    const recipient = data.email ?? data.phone ?? 'unknown';
    if (
      await this.isDuplicate(recipient, NotificationType.PASSWORD_RESET_OTP)
    ) {
      this.logger.warn(
        `Duplicate PASSWORD_RESET_OTP suppressed for ${recipient}`,
      );
      return;
    }
    const success = data.email
      ? await this.email.sendPasswordResetLink(
          data.email,
          data.firstName,
          data.otp,
        )
      : false;
    await this.log({
      userId: data.userId ?? 'system',
      tenantId: data.tenantId ?? 'system',
      type: 'PASSWORD_RESET_OTP',
      channel: 'EMAIL',
      recipient,
      subject: 'Password reset code',
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendTerminationNotice(data: {
    tenantId: string;
    employeeId: string;
    email: string;
    firstName: string;
    lastName: string;
    reason: string;
    lastWorkingDate: string;
  }) {
    if (
      await this.isDuplicate(data.email, NotificationType.EMPLOYEE_TERMINATION)
    ) {
      this.logger.warn(
        `Duplicate EMPLOYEE_TERMINATION suppressed for ${data.email}`,
      );
      return;
    }
    const success = await this.email.sendTerminationNotice(
      data.email,
      data.firstName,
      data.lastName,
      data.reason,
      data.lastWorkingDate,
    );
    await this.log({
      userId: data.employeeId,
      tenantId: data.tenantId,
      type: 'EMPLOYEE_TERMINATION',
      channel: 'EMAIL',
      recipient: data.email,
      subject: 'Important notice regarding your employment',
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendResignationSubmittedNotification(data: {
    tenantId: string;
    adminEmail: string;
    employeeId: string;
    employeeFirstName: string;
    employeeLastName: string;
    lastWorkingDate: string;
    reason?: string;
    additionalNotes?: string;
    detailLink?: string;
  }) {
    if (
      await this.isDuplicate(
        data.adminEmail,
        NotificationType.RESIGNATION_SUBMITTED,
      )
    ) {
      this.logger.warn(
        `Duplicate RESIGNATION_SUBMITTED suppressed for ${data.adminEmail}`,
      );
      return;
    }

    const success = await this.email.sendResignationSubmittedNotification(
      data.adminEmail,
      data.employeeFirstName,
      data.employeeLastName,
      data.lastWorkingDate,
      data.reason,
      data.additionalNotes,
      data.detailLink,
    );

    await this.log({
      userId: data.employeeId,
      tenantId: data.tenantId,
      type: 'RESIGNATION_SUBMITTED',
      channel: 'EMAIL',
      recipient: data.adminEmail,
      subject: `Resignation submitted by ${data.employeeFirstName} ${data.employeeLastName}`,
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendLeaveRequestedNotification(data: {
    tenantId: string;
    employeeId: string;
    employeeFirstName: string;
    employeeLastName: string;
    managerEmail: string;
    leaveTypeName: string;
    startDate: string;
    endDate: string;
    totalDays: number;
    reason?: string;
    detailLink?: string;
  }) {
    if (
      await this.isDuplicate(
        data.managerEmail,
        NotificationType.LEAVE_REQUESTED,
      )
    ) {
      this.logger.warn(
        `Duplicate LEAVE_REQUESTED suppressed for ${data.managerEmail}`,
      );
      return;
    }
    const success = await this.email.sendLeaveRequestedNotification(
      data.managerEmail,
      data.employeeFirstName,
      data.employeeLastName,
      data.leaveTypeName,
      data.startDate,
      data.endDate,
      data.totalDays,
      data.reason,
      data.detailLink,
    );
    await this.log({
      userId: data.employeeId,
      tenantId: data.tenantId,
      type: 'LEAVE_REQUESTED',
      channel: 'EMAIL',
      recipient: data.managerEmail,
      subject: `Leave request from ${data.employeeFirstName} ${data.employeeLastName}`,
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendLeaveReviewedNotification(data: {
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
  }) {
    if (
      await this.isDuplicate(
        data.employeeEmail,
        NotificationType.LEAVE_REVIEWED,
      )
    ) {
      this.logger.warn(
        `Duplicate LEAVE_REVIEWED suppressed for ${data.employeeEmail}`,
      );
      return;
    }
    const success = await this.email.sendLeaveReviewedNotification(
      data.employeeEmail,
      data.employeeFirstName,
      data.status,
      data.leaveTypeName,
      data.startDate,
      data.endDate,
      data.totalDays,
      data.note,
    );
    await this.log({
      userId: data.employeeId,
      tenantId: data.tenantId,
      type: 'LEAVE_REVIEWED',
      channel: 'EMAIL',
      recipient: data.employeeEmail,
      subject: `Your ${data.leaveTypeName} request has been ${data.status.toLowerCase()}`,
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendLeaveCancelledNotification(data: {
    tenantId: string;
    employeeId: string;
    employeeFirstName: string;
    employeeLastName: string;
    managerEmail: string;
    leaveTypeName: string;
    startDate: string;
    endDate: string;
    totalDays: number;
  }) {
    if (
      await this.isDuplicate(
        data.managerEmail,
        NotificationType.LEAVE_CANCELLED,
      )
    ) {
      this.logger.warn(
        `Duplicate LEAVE_CANCELLED suppressed for ${data.managerEmail}`,
      );
      return;
    }
    const success = await this.email.sendLeaveCancelledNotification(
      data.managerEmail,
      data.employeeFirstName,
      data.employeeLastName,
      data.leaveTypeName,
      data.startDate,
      data.endDate,
      data.totalDays,
    );
    await this.log({
      userId: data.employeeId,
      tenantId: data.tenantId,
      type: 'LEAVE_CANCELLED',
      channel: 'EMAIL',
      recipient: data.managerEmail,
      subject: `Leave request cancelled — ${data.employeeFirstName} ${data.employeeLastName}`,
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendTimeCorrectionSubmittedNotification(data: {
    tenantId: string;
    correctionId: string;
    employeeId: string;
    employeeFirstName: string;
    employeeLastName: string;
    attendanceDate: string;
    requestedIn: string | null;
    requestedOut: string | null;
    reason: string;
    adminEmail: string | null;
    managerEmail: string | null;
    detailLink?: string;
  }) {
    const employeeFullName = `${data.employeeFirstName} ${data.employeeLastName}`;
    const recipients: { email: string; firstName: string }[] = [];

    if (data.adminEmail) {
      recipients.push({ email: data.adminEmail, firstName: 'Admin' });
    } else {
      this.logger.warn(
        `[TIME_CORRECTION_SUBMITTED] No admin email for tenant ${data.tenantId} — skipping admin email`,
      );
    }

    if (data.managerEmail && data.managerEmail !== data.adminEmail) {
      recipients.push({ email: data.managerEmail, firstName: 'Manager' });
    } else if (!data.managerEmail) {
      this.logger.warn(
        `[TIME_CORRECTION_SUBMITTED] No manager email for employee ${data.employeeId} — skipping manager email`,
      );
    }

    for (const recipient of recipients) {
      if (
        await this.isDuplicate(
          recipient.email,
          NotificationType.TIME_CORRECTION_SUBMITTED,
        )
      ) {
        this.logger.warn(
          `Duplicate TIME_CORRECTION_SUBMITTED suppressed for ${recipient.email}`,
        );
        continue;
      }

      const success = await this.email.sendTimeCorrectionNotification(
        recipient.email,
        recipient.firstName,
        employeeFullName,
        data.attendanceDate,
        data.requestedIn,
        data.requestedOut,
        data.reason,
        data.detailLink,
      );

      await this.log({
        userId: data.employeeId,
        tenantId: data.tenantId,
        type: 'TIME_CORRECTION_SUBMITTED',
        channel: 'EMAIL',
        recipient: recipient.email,
        subject: `Time correction request pending your approval — ${employeeFullName}`,
        status: success ? 'SENT' : 'FAILED',
      });
    }
  }

  async sendSmsOtp(data: {
    userId?: string;
    tenantId?: string;
    phone: string;
    otp: string;
    context: string;
  }) {
    if (await this.isDuplicate(data.phone, NotificationType.SMS_OTP)) {
      this.logger.warn(`Duplicate SMS_OTP suppressed for ${data.phone}`);
      return;
    }
    const success = await this.sms.sendOtp(data.phone, data.otp, data.context);
    await this.log({
      userId: data.userId ?? 'system',
      tenantId: data.tenantId ?? 'system',
      type: 'SMS_OTP',
      channel: 'SMS',
      recipient: data.phone,
      status: success ? 'SENT' : 'FAILED',
    });
  }

  private async log(entry: {
    userId: string;
    tenantId: string;
    type: any;
    channel: any;
    recipient: string;
    subject?: string;
    status: any;
    error?: string;
  }) {
    try {
      await this.prisma.notificationLog.create({
        data: {
          ...entry,
          sentAt: entry.status === 'SENT' ? new Date() : undefined,
        },
      });
    } catch (err) {
      this.logger.error('Failed to log notification', err);
    }
  }
}
