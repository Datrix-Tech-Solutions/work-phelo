import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationService } from './notification.service';

@Controller()
export class NotificationHandler {
  private readonly logger = new Logger(NotificationHandler.name);

  constructor(private readonly notificationService: NotificationService) {}

  @EventPattern('notification.email_verification')
  async handleEmailVerification(
    @Payload()
    data: {
      userId?: string;
      tenantId?: string;
      email: string;
      firstName: string;
      otp: string;
      tenantName: string;
    },
  ) {
    this.logger.log(`Handling email verification for ${data.email}`);
    await this.notificationService.sendEmailVerification(data);
  }

  @EventPattern('notification.invite_user')
  async handleInviteUser(
    @Payload()
    data: {
      userId?: string;
      tenantId?: string;
      email: string;
      firstName: string;
      inviteToken: string;
      acceptInviteUrl: string;
      tenantName: string;
    },
  ) {
    this.logger.log(`Handling invite for ${data.email}`);
    await this.notificationService.sendInvite(data);
  }

  @EventPattern('notification.password_reset_link')
  async handlePasswordResetLink(
    @Payload()
    data: {
      userId?: string;
      tenantId?: string;
      email: string;
      firstName: string;
      resetLink: string;
      otpCode?: string;
      tenantName: string;
    },
  ) {
    this.logger.log(`Handling password reset link for ${data.email}`);
    await this.notificationService.sendPasswordResetLink(data);
  }

  @EventPattern('notification.password_reset_otp')
  async handlePasswordResetOtp(
    @Payload()
    data: {
      userId?: string;
      tenantId?: string;
      phone: string;
      otp: string;
      firstName: string;
    },
  ) {
    this.logger.log(`Handling password reset OTP for ${data.phone}`);
    await this.notificationService.sendPasswordResetOtp(data);
  }

  @EventPattern('notify.employee_termination')
  async handleEmployeeTermination(
    @Payload()
    data: {
      tenantId: string;
      employeeId: string;
      email: string;
      firstName: string;
      lastName: string;
      reason: string;
      lastWorkingDate: string;
    },
  ) {
    this.logger.log(`Handling termination notice for ${data.email}`);
    await this.notificationService.sendTerminationNotice(data);
  }

  @EventPattern('notification.sms_otp')
  async handleSmsOtp(
    @Payload()
    data: {
      userId?: string;
      tenantId?: string;
      phone: string;
      otp: string;
      context: string;
    },
  ) {
    this.logger.log(`Handling SMS OTP for ${data.phone}`);
    await this.notificationService.sendSmsOtp(data);
  }
}
