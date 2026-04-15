import { Injectable, Logger } from '@nestjs/common';
import { NotificationType } from '../../prisma/generated/client';
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
    inviteToken: string;
    acceptInviteUrl: string;
    tenantName: string;
  }) {
    if (await this.isDuplicate(data.email, NotificationType.INVITE_USER)) {
      this.logger.warn(`Duplicate INVITE_USER suppressed for ${data.email}`);
      return;
    }
    // Use workspace-aware URL built by auth service
    const success = await this.email.sendInviteEmail(
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
      subject: `Invitation to ${data.tenantName}`,
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
