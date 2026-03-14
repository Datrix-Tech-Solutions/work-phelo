import { Injectable, Logger } from '@nestjs/common';
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

  async sendEmailVerification(data: {
    userId: string;
    tenantId: string;
    email: string;
    firstName: string;
    otp: string;
  }) {
    const success = await this.email.sendEmailVerificationOtp(
      data.email,
      data.firstName,
      data.otp,
    );

    await this.log({
      userId: data.userId,
      tenantId: data.tenantId,
      type: 'EMAIL_VERIFICATION',
      channel: 'EMAIL',
      recipient: data.email,
      subject: 'Verify your email',
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendInvite(data: {
    userId: string;
    tenantId: string;
    email: string;
    firstName: string;
    inviteToken: string;
    tenantName: string;
  }) {
    const success = await this.email.sendInviteEmail(
      data.email,
      data.firstName,
      data.inviteToken,
      data.tenantName,
    );

    await this.log({
      userId: data.userId,
      tenantId: data.tenantId,
      type: 'INVITE_USER',
      channel: 'EMAIL',
      recipient: data.email,
      subject: `Invitation to ${data.tenantName}`,
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendPasswordResetLink(data: {
    userId: string;
    tenantId: string;
    email: string;
    firstName: string;
    resetToken: string;
  }) {
    const success = await this.email.sendPasswordResetLink(
      data.email,
      data.firstName,
      data.resetToken,
    );

    await this.log({
      userId: data.userId,
      tenantId: data.tenantId,
      type: 'PASSWORD_RESET_LINK',
      channel: 'EMAIL',
      recipient: data.email,
      subject: 'Reset your password',
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendPasswordResetOtp(data: {
    userId: string;
    tenantId: string;
    email: string;
    firstName: string;
    otp: string;
  }) {
    const success = await this.email.sendPasswordResetOtp(
      data.email,
      data.firstName,
      data.otp,
    );

    await this.log({
      userId: data.userId,
      tenantId: data.tenantId,
      type: 'PASSWORD_RESET_OTP',
      channel: 'EMAIL',
      recipient: data.email,
      subject: 'Password reset code',
      status: success ? 'SENT' : 'FAILED',
    });
  }

  async sendSmsOtp(data: {
    userId: string;
    tenantId: string;
    phone: string;
    otp: string;
    context: string;
  }) {
    const success = await this.sms.sendOtp(data.phone, data.otp, data.context);

    await this.log({
      userId: data.userId,
      tenantId: data.tenantId,
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
