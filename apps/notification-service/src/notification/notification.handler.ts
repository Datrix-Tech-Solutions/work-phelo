import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { NotificationService } from './notification.service';
import {
  WithMeta,
  EmailVerificationEvent,
  InviteUserEvent,
  PasswordResetLinkEvent,
  PasswordResetOtpEvent,
  SmsOtpEvent,
  EmployeeTerminationEvent,
} from '@work-phelo/types';

@Controller()
export class NotificationHandler {
  private readonly logger = new Logger(NotificationHandler.name);

  constructor(private readonly notificationService: NotificationService) {}

  @EventPattern('notification.email_verification')
  async handleEmailVerification(
    @Payload() data: WithMeta<EmailVerificationEvent>,
  ) {
    this.logger.log(
      `[notification.email_verification] Received | email=${data.email} | corrId=${data._meta?.correlationId}`,
    );
    await this.notificationService.sendEmailVerification(data);
  }

  @EventPattern('notification.invite_user')
  async handleInviteUser(@Payload() data: WithMeta<InviteUserEvent>) {
    this.logger.log(
      `[notification.invite_user] Received | email=${data.email} | corrId=${data._meta?.correlationId}`,
    );
    await this.notificationService.sendInvite(data);
  }

  @EventPattern('notification.password_reset_link')
  async handlePasswordResetLink(
    @Payload() data: WithMeta<PasswordResetLinkEvent>,
  ) {
    this.logger.log(
      `[notification.password_reset_link] Received | email=${data.email} | corrId=${data._meta?.correlationId}`,
    );
    await this.notificationService.sendPasswordResetLink(data);
  }

  @EventPattern('notification.password_reset_otp')
  async handlePasswordResetOtp(
    @Payload() data: WithMeta<PasswordResetOtpEvent>,
  ) {
    this.logger.log(
      `[notification.password_reset_otp] Received | phone=${data.phone} | corrId=${data._meta?.correlationId}`,
    );
    await this.notificationService.sendPasswordResetOtp(data);
  }

  @EventPattern('notify.employee_termination')
  async handleEmployeeTermination(
    @Payload() data: WithMeta<EmployeeTerminationEvent>,
  ) {
    this.logger.log(
      `[notify.employee_termination] Received | email=${data.email} | corrId=${data._meta?.correlationId}`,
    );
    await this.notificationService.sendTerminationNotice(data);
  }

  @EventPattern('notification.sms_otp')
  async handleSmsOtp(@Payload() data: WithMeta<SmsOtpEvent>) {
    this.logger.log(
      `[notification.sms_otp] Received | phone=${data.phone} | corrId=${data._meta?.correlationId}`,
    );
    await this.notificationService.sendSmsOtp(data);
  }
}
